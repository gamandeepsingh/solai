import type { ActionParams, ActionState } from './agent'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  action?: ActionParams
  actionState?: ActionState
  txSignature?: string
  errorMessage?: string
}

export interface AISettings {
  apiKey: string
  model: string
}
