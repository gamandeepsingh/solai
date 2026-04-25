export type AgentToken = 'SOL' | 'USDC' | 'USDT' | 'JUP' | 'BONK' | 'PYTH' | 'HNT' | 'RAY' | 'JTO' | 'ORCA' | 'GMT' | 'SRM' | 'COPE'
export type ActionState = 'pending' | 'executing' | 'done' | 'cancelled' | 'error'

export interface SendParams {
  recipient: string
  recipientLabel: string
  amount: number
  token: AgentToken
  usdEquivalent?: number
}

export interface SwapParams {
  inputToken: AgentToken
  outputToken: AgentToken
  inputAmount: number
  slippageBps: number
  estimatedOutput?: number
  priceImpactPct?: string
  routeLabel?: string
  quoteResponse?: unknown
}

export interface ScheduleParams {
  action: SendParams
  intervalMs: number
  intervalLabel: string
  nextRun: number
}

export interface ConditionalOrderParams {
  buyToken: AgentToken
  spendToken: AgentToken
  spendAmount: number
  triggerPrice: number
  basePrice: number
  percentChange: number
  direction: 'below' | 'above'
}

export interface AddContactParams {
  name: string
  address: string
}

export type ActionParams =
  | { kind: 'send'; params: SendParams }
  | { kind: 'swap'; params: SwapParams }
  | { kind: 'schedule'; params: ScheduleParams }
  | { kind: 'conditional_order'; params: ConditionalOrderParams }
  | { kind: 'balance'; params: { solBalance: number; usdcBalance: number; usdtBalance: number; solUsdValue: number; totalUsdValue: number } }
  | { kind: 'add_contact'; params: AddContactParams }
  | { kind: 'list_schedules'; params: { jobs: ScheduledJob[] } }

export interface ScheduledJob {
  id: string
  action: SendParams
  intervalMs: number
  intervalLabel: string
  nextRun: number
  createdAt: number
  agentId?: string
}

export interface TokenBudget {
  daily: number  // in token units, 0 = unlimited
  perTx: number  // in token units, 0 = unlimited
}

export interface AgentGuardrails {
  dailyBudgetSol: number
  perTxLimitSol: number
  allowedOrigins: string[]
  cooldownMs: number
  allowedTokens: string[]                     // empty = any token allowed
  tokenBudgets: Record<string, TokenBudget>   // token symbol → budget
}

export interface TokenSpendStat {
  daily: number
  total: number
  dailyResetAt: number
}

export interface AgentStats {
  totalSpentSol: number
  dailySpentSol: number
  dailyResetAt: number
  lastPaymentAt: number
  txCount: number
  tokenSpend: Record<string, TokenSpendStat>  // token symbol → stats
}

export interface AgentAutoRefill {
  enabled: boolean
  thresholdSol: number
  refillAmountSol: number
}

export interface AgentWallet {
  id: string
  walletId: string
  index: number
  publicKey: string
  name: string
  enabled: boolean
  guardrails: AgentGuardrails
  stats: AgentStats
  autoRefill?: AgentAutoRefill
}

export interface TokenAllowance {
  id: string
  agentId: string
  origin: string
  label: string
  token: string
  maxAmount: number
  spentAmount: number
  expiresAt: number
  createdAt: number
}
