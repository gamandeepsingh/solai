import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Header from '../../components/layout/Header'
import BottomNav from '../../components/layout/BottomNav'
import Spinner from '../../components/ui/Spinner'
import { useWallet } from '../../context/WalletContext'
import { fetchTxHistory, timeAgo } from '../../lib/history'
import type { TxRecord } from '../../types/history'

function TypeIcon({ type }: { type: TxRecord['type'] }) {
  if (type === 'send') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
    </svg>
  )
  if (type === 'receive') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
    </svg>
  )
  if (type === 'swap') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

const typeColors: Record<TxRecord['type'], string> = {
  send: 'bg-orange-500/20 text-orange-400',
  receive: 'bg-green-500/20 text-green-400',
  swap: 'bg-blue-500/20 text-blue-400',
  unknown: 'bg-[var(--color-border)] opacity-60',
}

export default function HistoryScreen() {
  const { account, network } = useWallet()
  const [records, setRecords] = useState<TxRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!account) return
    fetchTxHistory(account.publicKey, network)
      .then(setRecords)
      .finally(() => setIsLoading(false))
  }, [account, network])

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      <Header />
      <div className="flex-1 flex flex-col px-4 pb-16 overflow-y-auto">
        <div className="flex items-center justify-between py-3">
          <h2 className="text-lg font-bold">History</h2>
          <span className="text-[10px] opacity-30">Last 7 days</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center mt-10"><Spinner /></div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center gap-3 mt-10 opacity-40">
            <span className="text-4xl">📋</span>
            <p className="text-sm">No transactions yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {records.map((r, i) => (
              <motion.a
                key={r.sig}
                href={`https://solscan.io/tx/${r.sig}`}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="card-bg rounded-2xl p-3.5 flex items-center gap-3 hover:border-primary/20 border border-transparent transition-colors"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${typeColors[r.type]}`}>
                  <TypeIcon type={r.type} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold capitalize">{r.type === 'unknown' ? 'Transaction' : r.type}</span>
                    {r.status === 'error' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">failed</span>
                    )}
                  </div>
                  {r.amount != null && r.token ? (
                    <p className="text-[10px] opacity-50">{r.amount} {r.token}</p>
                  ) : (
                    <p className="text-[10px] opacity-30 font-mono truncate">{r.sig.slice(0, 16)}…</p>
                  )}
                  {r.toOrFrom && (
                    <p className="text-[9px] opacity-30 font-mono truncate">{r.toOrFrom.slice(0, 8)}…{r.toOrFrom.slice(-8)}</p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <p className="text-[10px] opacity-30">{timeAgo(r.timestamp)}</p>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-20 ml-auto mt-1">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </div>
              </motion.a>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
