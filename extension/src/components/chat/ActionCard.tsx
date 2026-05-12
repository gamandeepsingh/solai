import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ChatMessage } from '../../types/ai'
import type { ScheduledJob } from '../../types/agent'
import { removeScheduledJob } from '../../lib/scheduler'
import Spinner from '../ui/Spinner'

interface Row {
  label: string
  value: string
}

function CardRows({ rows }: { rows: Row[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map(r => (
        <div key={r.label} className="flex justify-between items-center text-xs">
          <span className="opacity-40">{r.label}</span>
          <span className="font-medium text-right max-w-[60%] truncate">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

interface ActionCardProps {
  message: ChatMessage
  onConfirm: () => void
  onCancel: () => void
  onSelectAgent?: (agentId: string | null) => void
}

export default function ActionCard({ message, onConfirm, onCancel, onSelectAgent }: ActionCardProps) {
  const { action, actionState, txSignature, errorMessage, agentWallets, selectedAgentId } = message
  if (!action) return null

  const { kind, params } = action as any
  const isPending = actionState === 'pending'
  const isExecuting = actionState === 'executing'
  const isDone = actionState === 'done'
  const isCancelled = actionState === 'cancelled'
  const isError = actionState === 'error'

  function buildRows(): Row[] {
    if (kind === 'send') return [
      { label: 'To', value: params.recipientLabel },
      { label: 'Amount', value: `${params.amount.toFixed(params.token === 'SOL' ? 6 : 2)} ${params.token}` },
      ...(params.usdEquivalent ? [{ label: 'USD Value', value: `$${params.usdEquivalent.toFixed(2)}` }] : []),
      { label: 'Est. Fee', value: '~0.000005 SOL' },
    ]

    if (kind === 'swap') return [
      { label: 'From', value: `${params.inputAmount} ${params.inputToken}` },
      { label: 'To (est.)', value: params.estimatedOutput ? `${params.estimatedOutput.toFixed(params.outputToken === 'SOL' ? 6 : 2)} ${params.outputToken}` : '—' },
      { label: 'Route', value: params.routeLabel ?? 'Jupiter' },
      { label: 'Price Impact', value: params.priceImpactPct ? `${params.priceImpactPct}%` : '<0.01%' },
      { label: 'Slippage', value: `${(params.slippageBps / 100).toFixed(1)}%` },
    ]

    if (kind === 'schedule') return [
      { label: 'Send', value: `${params.action.amount.toFixed(params.action.token === 'SOL' ? 6 : 2)} ${params.action.token}` },
      { label: 'To', value: params.action.recipientLabel },
      { label: 'Frequency', value: params.intervalLabel },
      { label: 'Next Run', value: new Date(params.nextRun).toLocaleDateString() },
    ]

    if (kind === 'conditional_order') return [
      { label: 'Buy', value: `${params.spendAmount} ${params.spendToken} → ${params.buyToken}` },
      { label: 'Trigger', value: `${params.buyToken} ${params.direction === 'below' ? 'drops to' : 'rises to'} $${params.triggerPrice.toFixed(2)}` },
      { label: 'Change', value: `${params.percentChange > 0 ? '+' : ''}${params.percentChange}% from $${params.basePrice.toFixed(2)}` },
      { label: 'Execution', value: 'Auto via Jupiter' },
    ]

    if (kind === 'balance') {
      const rows: Row[] = (params.allBalances ?? []).map((b: { symbol: string; amount: number; usdValue?: number }) => {
        const amt = b.symbol === 'SOL'
          ? b.amount.toFixed(4)
          : b.amount < 0.001
          ? b.amount.toExponential(2)
          : b.symbol === 'BONK'
          ? b.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })
          : b.amount.toFixed(2)
        const usd = b.usdValue ? ` (~$${b.usdValue.toFixed(2)})` : ''
        return { label: b.symbol, value: `${amt} ${b.symbol}${usd}` }
      })
      if (params.totalUsdValue) rows.push({ label: 'Total', value: `$${params.totalUsdValue.toFixed(2)} USD` })
      return rows
    }

    if (kind === 'add_contact') return [
      { label: 'Name', value: params.name },
      { label: 'Address', value: `${params.address.slice(0, 8)}...${params.address.slice(-8)}` },
    ]

    return []
  }

  const kindMeta = {
    send: { label: 'Send', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> },
    swap: { label: 'Swap', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> },
    schedule: { label: 'Recurring Payment', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> },
    conditional_order: { label: 'Conditional Order', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> },
    balance: { label: 'Wallet Balance', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
    add_contact: { label: 'Add Contact', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg> },
    list_schedules: { label: 'Recurring Payments', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> },
  }

  const meta = kindMeta[kind as keyof typeof kindMeta]
  const networkLabel = kind === 'swap' ? 'mainnet' : undefined

  if (kind === 'list_schedules') {
    return <ScheduleListCard jobs={params.jobs} />
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: isCancelled ? 0.4 : 1, y: 0 }}
      className="w-[260px] rounded-3xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-card)]"
    >
      <div className="px-4 pt-3.5 pb-1 border-b border-[var(--color-border)]/50">
        <div className="flex items-center gap-1.5">
          <span className="opacity-60">{meta?.icon}</span>
          <p className="text-xs font-semibold">{meta?.label ?? kind}</p>
        </div>
        {networkLabel && <p className="text-[10px] opacity-30 capitalize">{networkLabel}</p>}
      </div>

      <div className="px-4 py-3">
        <CardRows rows={buildRows()} />
      </div>

      <AnimatePresence mode="wait">
        {isPending && kind !== 'balance' && (
          <motion.div
            key="pending"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-2 px-4 pb-4"
          >
            {(kind === 'schedule' || kind === 'conditional_order') && agentWallets && agentWallets.length > 0 && (
              <div>
                <p className="text-[9px] opacity-40 mb-1.5">Execute from</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => onSelectAgent?.(null)}
                    className={`text-[10px] px-2.5 py-1 rounded-xl border transition-colors ${
                      selectedAgentId === null || selectedAgentId === undefined
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-[var(--color-border)] opacity-50'
                    }`}
                  >
                    Main Wallet
                  </button>
                  {agentWallets.map(a => (
                    <button
                      key={a.id}
                      onClick={() => onSelectAgent?.(a.id)}
                      className={`text-[10px] px-2.5 py-1 rounded-xl border transition-colors ${
                        selectedAgentId === a.id
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-[var(--color-border)] opacity-50'
                      }`}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onConfirm}
                className="flex-1 py-2 rounded-2xl text-xs font-semibold bg-primary text-black"
              >
                Confirm
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onCancel}
                className="flex-1 py-2 rounded-2xl text-xs font-medium border border-[var(--color-border)] opacity-60"
              >
                Cancel
              </motion.button>
            </div>
          </motion.div>
        )}

        {isExecuting && (
          <motion.div key="executing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="px-4 pb-4 flex items-center gap-2">
            <Spinner size="sm" />
            <span className="text-xs opacity-50">Processing…</span>
          </motion.div>
        )}

        {isDone && (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="px-4 pb-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><polyline points="20 6 9 17 4 12"/></svg>
              <p className="text-xs text-green-400 font-medium">Done</p>
            </div>
            {txSignature && (
              <a
                href={`https://solscan.io/tx/${txSignature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-primary underline truncate"
              >
                View on Solscan →
              </a>
            )}
          </motion.div>
        )}

        {isCancelled && (
          <motion.div key="cancelled" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="px-4 pb-3">
            <p className="text-xs opacity-30">Cancelled</p>
          </motion.div>
        )}

        {isError && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="px-4 pb-4 flex flex-col gap-2">
            <p className="text-xs text-red-400">{errorMessage}</p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onConfirm}
              className="py-2 rounded-2xl text-xs font-semibold bg-primary text-black"
            >
              Try Again
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ScheduleListCard({ jobs }: { jobs: ScheduledJob[] }) {
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set())

  async function handleStop(id: string) {
    await removeScheduledJob(id)
    setCancelledIds(prev => new Set([...prev, id]))
  }

  const visible = jobs.filter(j => !cancelledIds.has(j.id))

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-[260px] rounded-3xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-card)]"
    >
      <div className="px-4 pt-3.5 pb-1 border-b border-[var(--color-border)]/50">
        <div className="flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          <p className="text-xs font-semibold">Recurring Payments</p>
        </div>
        <p className="text-[10px] opacity-30">{visible.length} active</p>
      </div>

      <div className="px-4 py-3 flex flex-col gap-2.5">
        {visible.length === 0 ? (
          <p className="text-xs opacity-40">All recurring payments stopped.</p>
        ) : visible.map(job => (
          <div key={job.id} className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {job.action.amount.toFixed(job.action.token === 'SOL' ? 6 : 2)} {job.action.token} → {job.action.recipientLabel}
              </p>
              <p className="text-[10px] opacity-40">{job.intervalLabel}</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => handleStop(job.id)}
              className="shrink-0 px-2.5 py-1 rounded-xl text-[10px] font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Stop
            </motion.button>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
