import { getLocal, setLocal } from './storage'
import type { TokenAllowance } from '../types/agent'

export async function getAllowances(): Promise<TokenAllowance[]> {
  return (await getLocal('tokenAllowances')) ?? []
}

export async function getAgentAllowances(agentId: string): Promise<TokenAllowance[]> {
  const all = await getAllowances()
  return all.filter(a => a.agentId === agentId && a.expiresAt > Date.now())
}

export async function saveAllowance(data: Omit<TokenAllowance, 'id' | 'createdAt' | 'spentAmount'>): Promise<TokenAllowance> {
  const allowance: TokenAllowance = {
    ...data,
    id: crypto.randomUUID(),
    spentAmount: 0,
    createdAt: Date.now(),
  }
  const all = await getAllowances()
  // Replace existing allowance for same agentId + origin + token
  const filtered = all.filter(a => !(a.agentId === data.agentId && a.origin === data.origin && a.token === data.token))
  await setLocal('tokenAllowances', [...filtered, allowance])
  return allowance
}

export async function consumeAllowance(id: string, amount: number): Promise<TokenAllowance | null> {
  const all = await getAllowances()
  const idx = all.findIndex(a => a.id === id)
  if (idx === -1) return null
  const updated = { ...all[idx], spentAmount: all[idx].spentAmount + amount }
  all[idx] = updated
  await setLocal('tokenAllowances', all)
  return updated
}

export async function revokeAllowance(id: string): Promise<void> {
  const all = await getAllowances()
  await setLocal('tokenAllowances', all.filter(a => a.id !== id))
}

export async function revokeAgentAllowances(agentId: string): Promise<void> {
  const all = await getAllowances()
  await setLocal('tokenAllowances', all.filter(a => a.agentId !== agentId))
}
