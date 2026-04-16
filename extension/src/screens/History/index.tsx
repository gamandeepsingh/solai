import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Header from '../../components/layout/Header'
import BottomNav from '../../components/layout/BottomNav'
import Spinner from '../../components/ui/Spinner'
import { useWallet } from '../../context/WalletContext'
import { fetchTxHistory, groupByMonth, timeAgo } from '../../lib/history'
import { getContacts } from '../../lib/contacts'
import type { TxRecord } from '../../types/history'

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function SpendingHeatmap({ records }: { records: TxRecord[] }) {
  const WEEKS = 13
  const today = new Date(); today.setHours(0,0,0,0)

  const countMap: Record<string, number> = {}
  for (const r of records) {
    const d = new Date(r.timestamp); d.setHours(0,0,0,0)
    countMap[d.toISOString().slice(0,10)] = (countMap[d.toISOString().slice(0,10)] ?? 0) + 1
  }

  // Build weeks: each column = one week (Mon→Sun), newest on the right
  const totalDays = WEEKS * 7
  const cols: { date: string; count: number; month: number }[][] = []
  for (let w = WEEKS - 1; w >= 0; w--) {
    const week: typeof cols[0] = []
    for (let d = 6; d >= 0; d--) {
      const date = new Date(today)
      date.setDate(date.getDate() - (w * 7 + d))
      const key = date.toISOString().slice(0,10)
      week.push({ date: key, count: countMap[key] ?? 0, month: date.getMonth() })
    }
    week.reverse()
    cols.push(week)
  }

  // Month labels: find where the month changes across columns
  const monthLabels: { col: number; label: string }[] = []
  let lastMonth = -1
  cols.forEach((week, wi) => {
    const m = week[0].month
    if (m !== lastMonth) {
      monthLabels.push({ col: wi, label: new Date(today.getFullYear(), m, 1).toLocaleString('default', { month: 'short' }) })
      lastMonth = m
    }
  })

  function cellStyle(n: number) {
    if (n === 0) return { opacity: 0.12, backgroundColor: 'var(--color-text)' }
    if (n === 1) return { opacity: 0.35, backgroundColor: 'var(--color-primary)' }
    if (n <= 3) return { opacity: 0.65, backgroundColor: 'var(--color-primary)' }
    return { opacity: 1, backgroundColor: 'var(--color-primary)' }
  }

  const totalActive = Object.keys(countMap).length
  const totalTx = records.length

  return (
    <div className="card-bg rounded-2xl px-4 pt-3 pb-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-semibold opacity-60">Activity</p>
        <p className="text-[10px] opacity-30">{totalTx} tx across {totalActive} days</p>
      </div>

      {/* Month labels */}
      <div className="flex mb-1" style={{ gap: 2 }}>
        <div style={{ width: 12 }} /> {/* day-label offset */}
        {cols.map((_, wi) => {
          const label = monthLabels.find(m => m.col === wi)
          return (
            <div key={wi} className="flex-1 text-[8px] opacity-30 font-medium">
              {label?.label ?? ''}
            </div>
          )
        })}
      </div>

      {/* Grid */}
      <div className="flex" style={{ gap: 2 }}>
        {/* Day labels */}
        <div className="flex flex-col justify-between" style={{ gap: 2, width: 10, marginRight: 2 }}>
          {DAY_LABELS.map((d, i) => (
            <div key={i} className="text-[7px] opacity-25 font-medium leading-none h-3 flex items-center">{i % 2 === 0 ? d : ''}</div>
          ))}
        </div>

        {/* Week columns */}
        {cols.map((week, wi) => (
          <div key={wi} className="flex flex-col flex-1" style={{ gap: 2 }}>
            {week.map(cell => (
              <div
                key={cell.date}
                className="rounded-sm h-3 transition-opacity"
                style={cellStyle(cell.count)}
                title={cell.count > 0 ? `${cell.date}: ${cell.count} tx` : cell.date}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-2.5 justify-end">
        <span className="text-[8px] opacity-25">Less</span>
        {[0, 1, 2, 4].map(n => (
          <div key={n} className="w-3 h-3 rounded-sm" style={cellStyle(n)} />
        ))}
        <span className="text-[8px] opacity-25">More</span>
      </div>
    </div>
  )
}

function TxStats({ records }: { records: TxRecord[] }) {
  const counts = { send: 0, receive: 0, swap: 0, unknown: 0 }
  let totalSent = 0
  for (const r of records) {
    counts[r.type]++
    if (r.type === 'send' && r.amount) totalSent += r.amount
  }
  const total = records.length
  if (total === 0) return null
  const bars: { label: string; key: TxRecord['type']; color: string }[] = [
    { label: 'Sends', key: 'send', color: 'bg-orange-400' },
    { label: 'Receives', key: 'receive', color: 'bg-primary' },
    { label: 'Swaps', key: 'swap', color: 'bg-blue-400' },
  ]
  return (
    <div className="card-bg rounded-2xl p-3">
      <p className="text-[10px] opacity-40 uppercase tracking-widest mb-2.5">Transaction Breakdown</p>
      <div className="flex gap-1 h-2 rounded-full overflow-hidden mb-3">
        {bars.map(b => counts[b.key] > 0 && (
          <div key={b.key} className={`${b.color}`} style={{ flex: counts[b.key] }} />
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        {bars.map(b => (
          <div key={b.key} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${b.color}`} />
            <span className="text-[10px] opacity-60">{b.label}</span>
            <span className="text-[10px] font-semibold">{counts[b.key]}</span>
          </div>
        ))}
      </div>
      {totalSent > 0 && (
        <p className="text-[10px] opacity-40 mt-2">Total sent: <span className="opacity-80 font-medium">{totalSent.toFixed(4)} SOL</span></p>
      )}
    </div>
  )
}

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

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

export default function HistoryScreen() {
  const { account, network } = useWallet()
  const [records, setRecords] = useState<TxRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [contactMap, setContactMap] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    getContacts().then(contacts => {
      setContactMap(new Map(contacts.map(c => [c.address, c.name])))
    })
  }, [])

  useEffect(() => {
    if (!account) return
    fetchTxHistory(account.publicKey, network)
      .then(setRecords)
      .finally(() => setIsLoading(false))
  }, [account, network])

  function resolveLabel(address: string): string {
    return contactMap.get(address) ?? shortAddr(address)
  }

  function getSubtitle(r: TxRecord): string | null {
    if (!r.amount || !r.token) return null
    if (r.type === 'swap') return `${r.amount} ${r.token}`
    const direction = r.type === 'send' ? '→' : 'from'
    const counterpart = r.toOrFrom ? ` ${direction} ${resolveLabel(r.toOrFrom)}` : ''
    return `${r.amount} ${r.token}${counterpart}`
  }

  const grouped = groupByMonth(records)

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      <Header />
      <div className="flex-1 flex flex-col px-4 pb-16 overflow-y-auto">
        <div className="flex items-center justify-between py-3">
          <h2 className="text-lg font-bold">History</h2>
          {records.length > 0 && (
            <span className="text-[10px] opacity-30">{records.length} transactions</span>
          )}
        </div>

        {!isLoading && records.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            <SpendingHeatmap records={records} />
            <TxStats records={records} />
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center mt-10"><Spinner /></div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center gap-3 mt-10 opacity-40">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/></svg>
            <p className="text-sm">No transactions yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {grouped.map(({ label, records: groupRecords }) => (
              <div key={label}>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[10px] font-semibold opacity-40 uppercase tracking-widest">{label}</p>
                  <span className="text-[9px] opacity-20 bg-[var(--color-border)] px-1.5 py-0.5 rounded-full">{groupRecords.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {groupRecords.map((r, i) => {
                    const subtitle = getSubtitle(r)
                    return (
                      <motion.a
                        key={r.sig}
                        href={`https://solscan.io/tx/${r.sig}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
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
                          {subtitle ? (
                            <p className="text-[10px] opacity-60 truncate">{subtitle}</p>
                          ) : (
                            <p className="text-[10px] opacity-30 font-mono truncate">{shortAddr(r.sig)}</p>
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
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
