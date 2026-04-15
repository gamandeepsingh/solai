import { PublicKey } from '@solana/web3.js'
import { getConnection } from './solana'
import { getLocal, setLocal } from './storage'
import type { TxRecord } from '../types/history'
import type { Network } from '../types/wallet'

const MAX_LOG_SIZE = 1000

export async function logTx(record: TxRecord): Promise<void> {
  const existing = (await getLocal('txLog')) ?? []
  const updated = [record, ...existing.filter(t => t.sig !== record.sig)].slice(0, MAX_LOG_SIZE)
  await setLocal('txLog', updated)
}

export async function fetchTxHistory(publicKey: string, network: Network): Promise<TxRecord[]> {
  const localLog = (await getLocal('txLog')) ?? []
  const localSigs = new Set(localLog.map(t => t.sig))

  try {
    const conn = getConnection(network)
    const signatures = await conn.getSignaturesForAddress(new PublicKey(publicKey), { limit: 50 })

    const onChain: TxRecord[] = signatures
      .filter(s => !localSigs.has(s.signature))
      .map(s => ({
        sig: s.signature,
        type: 'unknown' as const,
        timestamp: (s.blockTime ?? 0) * 1000,
        status: s.err ? 'error' as const : 'success' as const,
      }))

    return [...localLog, ...onChain].sort((a, b) => b.timestamp - a.timestamp)
  } catch {
    return localLog.sort((a, b) => b.timestamp - a.timestamp)
  }
}

export function groupByMonth(records: TxRecord[]): { label: string; records: TxRecord[] }[] {
  const groups: Map<string, TxRecord[]> = new Map()
  for (const r of records) {
    const d = new Date(r.timestamp)
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' })
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(r)
  }
  return Array.from(groups.entries()).map(([label, records]) => ({ label, records }))
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}
