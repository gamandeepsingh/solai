import { PublicKey } from '@solana/web3.js'
import { getConnection } from './solana'
import { getLocal, setLocal } from './storage'
import type { TxRecord } from '../types/history'
import type { Network } from '../types/wallet'

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

export async function logTx(record: TxRecord): Promise<void> {
  const existing = (await getLocal('txLog')) ?? []
  const updated = [record, ...existing.filter(t => t.sig !== record.sig)].slice(0, 200)
  await setLocal('txLog', updated)
}

export async function fetchTxHistory(publicKey: string, network: Network): Promise<TxRecord[]> {
  const cutoff = Math.floor((Date.now() - SEVEN_DAYS) / 1000)
  const localLog = (await getLocal('txLog')) ?? []
  const localRecent = localLog.filter(t => t.timestamp >= Date.now() - SEVEN_DAYS)
  const localSigs = new Set(localRecent.map(t => t.sig))

  try {
    const conn = getConnection(network)
    const signatures = await conn.getSignaturesForAddress(new PublicKey(publicKey), { limit: 50 })
    const recentSigs = signatures.filter(s => s.blockTime != null && s.blockTime >= cutoff)

    const onChain: TxRecord[] = recentSigs
      .filter(s => !localSigs.has(s.signature))
      .map(s => ({
        sig: s.signature,
        type: 'unknown' as const,
        timestamp: (s.blockTime ?? 0) * 1000,
        status: s.err ? 'error' as const : 'success' as const,
      }))

    return [...localRecent, ...onChain].sort((a, b) => b.timestamp - a.timestamp)
  } catch {
    return localRecent.sort((a, b) => b.timestamp - a.timestamp)
  }
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
