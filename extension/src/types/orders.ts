import type { AgentToken } from './agent'

export type OrderStatus = 'pending' | 'executed' | 'cancelled' | 'failed'

export interface ConditionalOrder {
  id: string
  buyToken: AgentToken
  spendToken: AgentToken
  spendAmount: number
  triggerPrice: number
  basePrice: number
  percentChange: number
  direction: 'below' | 'above'
  status: OrderStatus
  createdAt: string
  executedAt?: string
  txSignature?: string
  errorMessage?: string
}
