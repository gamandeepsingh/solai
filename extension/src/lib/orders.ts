import { getLocal, setLocal } from './storage'
import type { ConditionalOrder, OrderStatus } from '../types/orders'

export async function getOrders(): Promise<ConditionalOrder[]> {
  return (await getLocal('conditionalOrders')) ?? []
}

export async function getPendingOrders(): Promise<ConditionalOrder[]> {
  const all = await getOrders()
  return all.filter(o => o.status === 'pending')
}

export async function saveOrder(data: Omit<ConditionalOrder, 'id'>): Promise<ConditionalOrder> {
  const order: ConditionalOrder = { id: crypto.randomUUID(), ...data }
  const existing = await getOrders()
  await setLocal('conditionalOrders', [...existing, order])
  return order
}

export async function updateOrder(id: string, patch: Partial<ConditionalOrder>): Promise<ConditionalOrder> {
  const all = await getOrders()
  const idx = all.findIndex(o => o.id === id)
  if (idx === -1) throw new Error('Order not found')
  const updated = { ...all[idx], ...patch }
  all[idx] = updated
  await setLocal('conditionalOrders', all)
  return updated
}

export async function cancelOrder(id: string): Promise<void> {
  const all = await getOrders()
  await setLocal('conditionalOrders', all.filter(o => o.id !== id))
}
