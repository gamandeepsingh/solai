import { callWithTools } from './openrouter'
import { getLocal } from './storage'
import { fetchContacts } from './api'
import { isValidSolanaAddress } from './solana'
import { convertUsdToToken } from './prices'
import { getSwapQuote, parseQuoteForDisplay } from './jupiter'
import { getScheduledJobs } from './scheduler'
import type { ChatMessage } from '../types/ai'
import type { ActionParams, SendParams, AgentToken } from '../types/agent'
import type { Network } from '../types/wallet'

export type AgentResult = ActionParams | string | null

export interface AgentContext {
  publicKey: string
  network: Network
  solBalance: number
  usdcBalance: number
  usdtBalance: number
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
  const cached = await getLocal('contacts')
  const contacts = cached?.length ? cached : await fetchContacts()
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
      description: 'Send SOL or USDC to a recipient. Use when the user wants to transfer tokens to someone.',
      parameters: {
        type: 'object',
        properties: {
          recipient: { type: 'string', description: 'Solana wallet address OR contact name (e.g. "Alice", "mom")' },
          amount: { type: 'number', description: 'Amount to send' },
          token: { type: 'string', enum: ['SOL', 'USDC', 'USDT'] },
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
      description: 'Swap between SOL and USDC via Jupiter DEX. Use for "buy SOL", "swap USDC to SOL", "exchange" etc.',
      parameters: {
        type: 'object',
        properties: {
          inputToken: { type: 'string', enum: ['SOL', 'USDC', 'USDT'] },
          outputToken: { type: 'string', enum: ['SOL', 'USDC', 'USDT'] },
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
          token: { type: 'string', enum: ['SOL', 'USDC', 'USDT'] },
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
      name: 'conditional_order',
      description: 'Create a conditional order triggered by price. Use for "buy SOL if price drops X%", "alert when price reaches $Y".',
      parameters: {
        type: 'object',
        properties: {
          token: { type: 'string', enum: ['SOL', 'USDC', 'USDT'] },
          condition: { type: 'string', enum: ['below', 'above'] },
          targetPriceUsd: { type: 'number', description: 'Target price in USD that triggers the action' },
          actionKind: { type: 'string', enum: ['swap', 'send'] },
          actionAmount: { type: 'number' },
          actionToken: { type: 'string', enum: ['SOL', 'USDC', 'USDT'] },
        },
        required: ['token', 'condition', 'targetPriceUsd', 'actionKind', 'actionAmount', 'actionToken'],
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
]

export async function runAgentTurn(
  userContent: string,
  history: ChatMessage[],
  apiKey: string,
  model: string,
  ctx: AgentContext
): Promise<AgentResult> {
  const systemPrompt = `You are SOLAI, an agentic Solana wallet assistant.
Wallet address: ${ctx.publicKey}
Network: ${ctx.network}
SOL balance: ${ctx.solBalance.toFixed(4)} SOL
USDC balance: ${ctx.usdcBalance.toFixed(2)} USDC
USDT balance: ${ctx.usdtBalance.toFixed(2)} USDT

For actionable requests (send, swap, schedule, balance check, conditional orders) — call the appropriate tool.
For questions about crypto, Solana, DeFi, tokens, wallets, or blockchain — reply in plain text.
For anything unrelated to crypto or wallets (math, essays, general knowledge, etc.) — politely decline and remind the user you are a wallet assistant.
When user says "$X" or "X dollars", set amountIsUsd=true.
When user names a contact (e.g. "mom", "Alice"), pass the name as-is to recipient.
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
      const available = params.token === 'SOL' ? ctx.solBalance : params.token === 'USDC' ? ctx.usdcBalance : ctx.usdtBalance
      const eps = params.token === 'SOL' ? 1e-9 : 1e-6
      if (params.amount > available + eps) {
        const have = params.token === 'SOL' ? ctx.solBalance.toFixed(4) : available.toFixed(2)
        throw new Error(`Insufficient ${params.token} — you have ${have} ${params.token}`)
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

    case 'conditional_order': {
      const token = args.token as AgentToken
      const actionToken = args.actionToken as AgentToken
      const actionLabel = args.actionKind === 'swap'
        ? `Swap ${args.actionAmount} ${actionToken}`
        : `Send ${args.actionAmount} ${actionToken}`
      return {
        kind: 'conditional',
        params: {
          token,
          condition: args.condition,
          targetPriceUsd: args.targetPriceUsd,
          action: args.actionKind === 'swap'
            ? { inputToken: actionToken, outputToken: actionToken === 'SOL' ? 'USDC' : 'SOL', inputAmount: args.actionAmount, slippageBps: 50 }
            : { recipient: ctx.publicKey, recipientLabel: 'self', amount: args.actionAmount, token: actionToken },
          actionLabel,
        },
      }
    }

    case 'get_balance': {
      return {
        kind: 'balance',
        params: { solBalance: ctx.solBalance, usdcBalance: ctx.usdcBalance, usdtBalance: ctx.usdtBalance },
      }
    }

    case 'add_contact': {
      if (!isValidSolanaAddress(args.address)) {
        throw new Error(`"${args.address}" is not a valid Solana address`)
      }
      return { kind: 'add_contact', params: { name: args.name, address: args.address } }
    }

    case 'get_contacts': {
      const contacts = await fetchContacts()
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

    default:
      return null
  }
}
