export interface TxRecord {
  sig: string
  type: 'send' | 'swap' | 'receive' | 'unknown'
  timestamp: number
  amount?: number
  token?: string
  toOrFrom?: string
  status: 'success' | 'error'
}
