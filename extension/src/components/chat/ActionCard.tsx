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
}

export default function ActionCard({ message, onConfirm, onCancel }: ActionCardProps) {
  const { action, actionState, txSignature, errorMessage } = message
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

    if (kind === 'conditional') return [
      { label: 'Watch', value: `${params.token} price` },
      { label: 'Trigger', value: `${params.condition} $${params.targetPriceUsd}` },
      { label: 'Action', value: params.actionLabel },
    ]

    if (kind === 'balance') return [
      { label: 'SOL', value: `${params.solBalance.toFixed(4)} SOL${params.solUsdValue ? ` (~$${params.solUsdValue.toFixed(2)})` : ''}` },
      { label: 'USDC', value: `${params.usdcBalance.toFixed(2)} USDC` },
      { label: 'USDT', value: `${params.usdtBalance.toFixed(2)} USDT` },
      ...(params.totalUsdValue ? [{ label: 'Total', value: `$${params.totalUsdValue.toFixed(2)} USD` }] : []),
    ]

    if (kind === 'add_contact') return [
      { label: 'Name', value: params.name },
      { label: 'Address', value: `${params.address.slice(0, 8)}...${params.address.slice(-8)}` },
    ]

    return []
  }

  const kindLabels: Record<string, string> = {
    send: '💸 Send',
    swap: '💱 Swap',
    schedule: '🔁 Recurring Payment',
    conditional: '⚡ Conditional Order',
    balance: '💰 Wallet Balance',
    add_contact: '👤 Add Contact',
    list_schedules: '🔁 Recurring Payments',
  }

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
        <p className="text-xs font-semibold">{kindLabels[kind] ?? kind}</p>
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
            className="px-4 pb-4 flex gap-2"
          >
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onConfirm}
              className="flex-1 py-2 rounded-2xl text-xs font-semibold bg-primary text-black"
            >
              Confirm ✓
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onCancel}
              className="flex-1 py-2 rounded-2xl text-xs font-medium border border-[var(--color-border)] opacity-60"
            >
              Cancel
            </motion.button>
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
            <p className="text-xs text-green-400 font-medium">✓ Done</p>
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
        <p className="text-xs font-semibold">🔁 Recurring Payments</p>
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
