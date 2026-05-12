export interface Contact {
  id: string
  name: string
  emoji?: string
  address: string
  privacyAddress?: string
  note?: string
  createdAt: string
  lastInteractionAt?: string
  sentCount?: number
}
