import type { ActionParams, ActionState, AgentWallet } from './agent'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  action?: ActionParams
  actionState?: ActionState
  txSignature?: string
  errorMessage?: string
  agentWallets?: AgentWallet[]
  selectedAgentId?: string | null
}

export interface AISettings {
  apiKey: string
  model: string
}
