export type AgentToken = 'SOL' | 'USDC' | 'USDT'
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
}


