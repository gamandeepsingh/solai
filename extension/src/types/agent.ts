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

export interface ConditionalParams {
  token: AgentToken
  condition: 'below' | 'above'
  targetPriceUsd: number
  action: SwapParams | SendParams
  actionLabel: string
}

export interface AddContactParams {
  name: string
  address: string
}

export type ActionParams =
  | { kind: 'send'; params: SendParams }
  | { kind: 'swap'; params: SwapParams }
  | { kind: 'schedule'; params: ScheduleParams }
  | { kind: 'conditional'; params: ConditionalParams }
  | { kind: 'balance'; params: { solBalance: number; usdcBalance: number; usdtBalance: number } }
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

export interface ConditionalOrder {
  id: string
  token: AgentToken
  condition: 'below' | 'above'
  targetPriceUsd: number
  action: SwapParams | SendParams
  actionLabel: string
  createdAt: number
}
