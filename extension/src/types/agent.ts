export type AgentToken = 'SOL' | 'USDC'
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

export type ActionParams =
  | { kind: 'send'; params: SendParams }
  | { kind: 'swap'; params: SwapParams }
  | { kind: 'schedule'; params: ScheduleParams }
  | { kind: 'conditional'; params: ConditionalParams }
  | { kind: 'balance'; params: { solBalance: number; usdcBalance: number } }

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
