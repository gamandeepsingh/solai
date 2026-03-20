import { motion } from 'framer-motion'
import type { TokenBalance } from '../../types/tokens'
import Spinner from '../../components/ui/Spinner'

interface Props {
  balances: TokenBalance[]
  isLoading: boolean
}

export default function BalanceCard({ balances, isLoading }: Props) {
  const sol = balances.find(b => b.meta.symbol === 'SOL')
  const hasUsdValues = balances.some(b => b.usdValue !== undefined)
  const totalUsd = hasUsdValues
    ? balances.reduce((sum, b) => sum + (b.usdValue ?? 0), 0)
    : null

  return (
    <div className="flex flex-col items-center py-4">
      <p className="text-[10px] opacity-40 uppercase tracking-widest mb-1">Total Balance</p>
      {isLoading && !sol ? (
        <Spinner size="sm" className="my-2" />
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col items-center gap-1"
        >
          {totalUsd !== null ? (
            <>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold tracking-tight">
                  ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-[10px] opacity-35">
                {(sol?.amount ?? 0).toFixed(4)} SOL
              </p>
            </>
          ) : (
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold tracking-tight">{(sol?.amount ?? 0).toFixed(4)}</span>
              <span className="text-lg font-medium opacity-60 mb-1">SOL</span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
