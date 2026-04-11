import { callWithTools } from './openrouter'
import { getContacts } from './contacts'
import { isValidSolanaAddress } from './solana'
import { convertUsdToToken, getTokenPrice } from './prices'
import { getSwapQuote, parseQuoteForDisplay } from './jupiter'
import { getScheduledJobs } from './scheduler'
import type { ChatMessage } from '../types/ai'
import type { ActionParams, SendParams, AgentToken } from '../types/agent'
import type { Network } from '../types/wallet'

export type AgentResult = ActionParams | string | null

// 890,880 lamports rent-exempt + ~5,000 lamports fee = ~895,880. Use 0.00095 SOL as reserve.
export const SOL_RESERVE = 0.00095

export interface AgentTokenBalance {
  symbol: string
  amount: number
  usdValue?: number
}

export interface AgentContext {
  publicKey: string
  network: Network
  solBalance: number
  solMaxSendable: number  // solBalance - SOL_RESERVE (pre-computed, use this for send amounts)
  usdcBalance: number
  usdtBalance: number
  solUsdValue: number
  totalUsdValue: number
  /** All tokens the user currently holds (amount > 0) */
  allBalances: AgentTokenBalance[]
}

const INTERVAL_MAP: Record<string, number> = {
  hourly: 3_600_000,
  daily: 86_400_000,
  weekly: 604_800_000,
  monthly: 2_592_000_000,
}

function normalizeInterval(label: string): { intervalMs: number; intervalLabel: string } {
  const l = label.toLowerCase()
  if (l.includes('hour')) return { intervalMs: INTERVAL_MAP.hourly, intervalLabel: 'every hour' }
  if (l.includes('week')) return { intervalMs: INTERVAL_MAP.weekly, intervalLabel: 'every week' }
  if (l.includes('month')) return { intervalMs: INTERVAL_MAP.monthly, intervalLabel: 'every month' }
  return { intervalMs: INTERVAL_MAP.daily, intervalLabel: 'every day' }
}

async function resolveRecipient(raw: string): Promise<{ address: string; label: string }> {
  if (isValidSolanaAddress(raw)) {
    return { address: raw, label: `${raw.slice(0, 4)}…${raw.slice(-4)}` }
  }
  const contacts = await getContacts()
  const match = contacts.find(c => c.name.toLowerCase() === raw.toLowerCase())
  if (!match) throw new Error(`Contact "${raw}" not found — add them in Contacts first`)
  return { address: match.address, label: match.name }
}

async function resolveSendParams(args: {
  recipient: string
  amount: number
  token: AgentToken
  amountIsUsd?: boolean
}): Promise<SendParams> {
  const { address, label } = await resolveRecipient(args.recipient)
  const tokenAmount = args.amountIsUsd ? await convertUsdToToken(args.amount, args.token) : args.amount
  return {
    recipient: address,
    recipientLabel: label,
    amount: tokenAmount,
    token: args.token,
    usdEquivalent: args.amountIsUsd ? args.amount : undefined,
  }
}

export const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'send_token',
      description: 'Send any Solana token to a recipient. Use when the user wants to transfer tokens to someone.',
      parameters: {
        type: 'object',
        properties: {
          recipient: { type: 'string', description: 'Solana wallet address OR contact name (e.g. "Alice", "mom")' },
          amount: { type: 'number', description: 'Amount to send' },
          token: { type: 'string', enum: ['SOL', 'USDC', 'USDT', 'JUP', 'BONK', 'PYTH', 'HNT', 'RAY', 'JTO', 'ORCA', 'GMT', 'SRM', 'COPE'] },
          amountIsUsd: { type: 'boolean', description: 'True if amount is in USD (e.g. "$5")' },
        },
        required: ['recipient', 'amount', 'token'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'swap_tokens',
      description: 'Swap between any Solana tokens via Jupiter DEX. Use for "buy SOL", "swap USDC to SOL", "swap JUP to BONK", "exchange" etc.',
      parameters: {
        type: 'object',
        properties: {
          inputToken: { type: 'string', enum: ['SOL', 'USDC', 'USDT', 'JUP', 'BONK', 'PYTH', 'HNT', 'RAY', 'JTO', 'ORCA', 'GMT', 'SRM', 'COPE'] },
          outputToken: { type: 'string', enum: ['SOL', 'USDC', 'USDT', 'JUP', 'BONK', 'PYTH', 'HNT', 'RAY', 'JTO', 'ORCA', 'GMT', 'SRM', 'COPE'] },
          inputAmount: { type: 'number', description: 'Amount of input token to swap' },
          slippageBps: { type: 'number', description: 'Slippage in basis points, default 50' },
        },
        required: ['inputToken', 'outputToken', 'inputAmount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'schedule_payment',
      description: 'Set up a recurring payment. Use for "send X every day/week", "recurring payment".',
      parameters: {
        type: 'object',
        properties: {
          recipient: { type: 'string' },
          amount: { type: 'number' },
          token: { type: 'string', enum: ['SOL', 'USDC', 'USDT', 'JUP', 'BONK', 'PYTH', 'HNT', 'RAY', 'JTO', 'ORCA', 'GMT', 'SRM', 'COPE'] },
          amountIsUsd: { type: 'boolean' },
          intervalLabel: { type: 'string', description: 'One of: hourly, daily, weekly, monthly' },
        },
        required: ['recipient', 'amount', 'token', 'intervalLabel'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_conditional_order',
      description: 'Create a conditional buy order that auto-executes when price drops or rises by a percent. Use for "buy SOL if price drops 10%", "buy 50 USDC of SOL if SOL drops 15%".',
      parameters: {
        type: 'object',
        properties: {
          buyToken: { type: 'string', enum: ['SOL', 'USDC', 'USDT', 'JUP', 'BONK', 'PYTH', 'HNT', 'RAY', 'JTO', 'ORCA', 'GMT', 'SRM', 'COPE'], description: 'Token to receive' },
          spendToken: { type: 'string', enum: ['SOL', 'USDC', 'USDT', 'JUP', 'BONK', 'PYTH', 'HNT', 'RAY', 'JTO', 'ORCA', 'GMT', 'SRM', 'COPE'], description: 'Token to spend' },
          spendAmount: { type: 'number', description: 'Amount of spendToken to use' },
          percentChange: { type: 'number', description: 'Percent change to trigger. Negative = drop (e.g. -10 for 10% drop), positive = rise.' },
        },
        required: ['buyToken', 'spendToken', 'spendAmount', 'percentChange'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_balance',
      description: 'Show the current wallet balances. Use when user asks about balance, holdings, or how much they have.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_contact',
      description: 'Save a new contact. Use when user says "add contact", "save this address as", "remember X address".',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Contact name' },
          address: { type: 'string', description: 'Solana wallet address' },
        },
        required: ['name', 'address'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_contacts',
      description: 'List saved contacts or look up a specific contact address. Use when user asks "show my contacts", "what is X address", "do I have X saved".',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Optional: filter by contact name' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_schedules',
      description: 'Show all active recurring payments. Use when user asks "show my recurring payments", "what scheduled payments do I have", "list my recurring tasks".',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'respond_to_user',
      description: 'Send a plain-text reply. Use ONLY for general questions, explanations, or anything that is NOT a wallet action. Never use this for send, swap, schedule, balance, or contact actions — use the specific tool for those instead.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'The response text to show the user' },
        },
        required: ['message'],
      },
    },
  },
]

export async function runAgentTurn(
  userContent: string,
  history: ChatMessage[],
  apiKey: string,
  model: string,
  ctx: AgentContext
): Promise<AgentResult> {
  const balanceLines = ctx.allBalances.length
    ? ctx.allBalances.map(b => `  ${b.symbol}: ${b.amount} ${b.usdValue !== undefined ? `(~$${b.usdValue.toFixed(2)})` : ''}`).join('\n')
    : '  No tokens held'

  const systemPrompt = `You are SOLAI, an agentic Solana wallet assistant. You MUST always call a tool — never reply with plain text.

Wallet address: ${ctx.publicKey}
Network: ${ctx.network}
Total portfolio: ~$${ctx.totalUsdValue.toFixed(2)} USD

Current balances:
${balanceLines}

TOOL USAGE RULES (follow exactly):
- "send X TOKEN to Y" → call send_token immediately. recipient can be a wallet address OR a contact name (e.g. "aman", "mom", "Alice"). Pass the name as-is.
- "swap X for Y" / "buy X" / "exchange" → call swap_tokens
- "every day/week/month" payment → call schedule_payment
- "buy X if price drops/rises Y%" → call create_conditional_order
- "my balance" / "how much do I have" → call get_balance
- "add contact" / "save address" → call add_contact
- "show contacts" / "what is X address" → call get_contacts
- "recurring payments" / "scheduled" → call list_schedules
- Everything else (questions, explanations) → call respond_to_user with your answer

CRITICAL: NEVER use respond_to_user for send/swap/schedule/balance actions. ALWAYS call the specific action tool.
Supported tokens: SOL, USDC, USDT, JUP, BONK, PYTH, HNT, RAY, JTO, ORCA, GMT, SRM, COPE.
When sending SOL, NEVER exceed ${ctx.solMaxSendable.toFixed(6)} SOL (fee reserved).
When user says "$X" or "X dollars", set amountIsUsd=true.
For conditional orders, only use tokens with a CoinGecko price feed (SOL, USDC, USDT).
percentChange is negative for drops (e.g. -10 for 10% drop), positive for rises.
Never ask for private keys or seed phrases.`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-16).map(m => ({ role: m.role === 'system' ? 'assistant' : m.role, content: m.content || '' })),
    { role: 'user', content: userContent },
  ]

  const { toolCalls } = await callWithTools(messages, apiKey, model, AGENT_TOOLS)

  if (!toolCalls?.length) return null

  const call = toolCalls[0]
  const args = JSON.parse(call.function.arguments)

  switch (call.function.name) {
    case 'send_token': {
      const params = await resolveSendParams(args)

      if (params.amount <= 0) throw new Error('Amount must be greater than 0')

      const held = ctx.allBalances.find(b => b.symbol === params.token)
      const rawBalance = held?.amount ?? 0
      const available = params.token === 'SOL' ? Math.max(0, rawBalance - SOL_RESERVE) : rawBalance

      if (available === 0) throw new Error(`You don't have any ${params.token} to send`)

      const eps = 1e-6
      if (params.amount > available + eps) {
        const have = params.token === 'SOL'
          ? available.toFixed(6)
          : available < 0.001 ? available.toExponential(2) : available.toFixed(4)
        throw new Error(`Insufficient ${params.token} — max sendable is ${have} ${params.token}${params.token === 'SOL' ? ' (fee reserved)' : ''}`)
      }
      return { kind: 'send', params }
    }

    case 'swap_tokens': {
      const inputToken = args.inputToken as AgentToken
      const outputToken = args.outputToken as AgentToken
      const slippageBps = args.slippageBps ?? 50
      const quote = await getSwapQuote(inputToken, outputToken, args.inputAmount, slippageBps)
      const display = parseQuoteForDisplay(quote, outputToken)
      return {
        kind: 'swap',
        params: {
          inputToken,
          outputToken,
          inputAmount: args.inputAmount,
          slippageBps,
          estimatedOutput: display.estimatedOutput,
          priceImpactPct: display.priceImpactPct,
          routeLabel: display.routeLabel,
          quoteResponse: quote,
        },
      }
    }

    case 'schedule_payment': {
      const sendParams = await resolveSendParams(args)
      const { intervalMs, intervalLabel } = normalizeInterval(args.intervalLabel)
      return {
        kind: 'schedule',
        params: {
          action: sendParams,
          intervalMs,
          intervalLabel,
          nextRun: Date.now() + intervalMs,
        },
      }
    }

    case 'create_conditional_order': {
      const buyToken = args.buyToken as AgentToken
      const spendToken = args.spendToken as AgentToken
      const coingeckoId = buyToken === 'SOL' ? 'solana' : buyToken === 'USDC' ? 'usd-coin' : 'tether'
      const basePrice = await getTokenPrice(coingeckoId)
      const triggerPrice = basePrice * (1 + args.percentChange / 100)
      const direction: 'below' | 'above' = args.percentChange < 0 ? 'below' : 'above'
      return {
        kind: 'conditional_order',
        params: {
          buyToken,
          spendToken,
          spendAmount: args.spendAmount,
          triggerPrice,
          basePrice,
          percentChange: args.percentChange,
          direction,
        },
      }
    }

    case 'get_balance': {
      return {
        kind: 'balance',
        params: {
          solBalance: ctx.solBalance,
          usdcBalance: ctx.usdcBalance,
          usdtBalance: ctx.usdtBalance,
          solUsdValue: ctx.solUsdValue,
          totalUsdValue: ctx.totalUsdValue,
        },
      }
    }

    case 'add_contact': {
      if (!isValidSolanaAddress(args.address)) {
        throw new Error(`"${args.address}" is not a valid Solana address`)
      }
      return { kind: 'add_contact', params: { name: args.name, address: args.address } }
    }

    case 'get_contacts': {
      const contacts = await getContacts()
      if (!contacts.length) return 'You have no saved contacts yet. Add contacts in the Contacts tab.'
      const filter = args.name?.toLowerCase()
      const list = filter ? contacts.filter(c => c.name.toLowerCase().includes(filter)) : contacts
      if (!list.length) return `No contact found matching "${args.name}".`
      const lines = list.map(c => `• **${c.name}** — \`${c.address.slice(0, 8)}...${c.address.slice(-8)}\``)
      return `Your contacts:\n${lines.join('\n')}`
    }

    case 'list_schedules': {
      const jobs = await getScheduledJobs()
      if (!jobs.length) return 'You have no active recurring payments.'
      return { kind: 'list_schedules', params: { jobs } }
    }

    case 'respond_to_user':
      return args.message as string

    default:
      return null
  }
}
