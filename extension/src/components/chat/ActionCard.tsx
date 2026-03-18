import { motion, AnimatePresence } from 'framer-motion'
import type { ChatMessage } from '../../types/ai'
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
      { label: 'SOL', value: `${params.solBalance.toFixed(4)} SOL` },
      { label: 'USDC', value: `${params.usdcBalance.toFixed(2)} USDC` },
    ]

    return []
  }

  const kindLabels: Record<string, string> = {
    send: '💸 Send',
    swap: '💱 Swap',
    schedule: '🔁 Recurring Payment',
    conditional: '⚡ Conditional Order',
    balance: '💰 Wallet Balance',
  }

  const networkLabel = kind === 'swap' ? 'mainnet' : undefined

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
