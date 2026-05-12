import { useState } from 'react'
import { motion } from 'framer-motion'
import type { TokenBalance } from '../../types/tokens'
import Spinner from '../../components/ui/Spinner'

interface Props {
  balances: TokenBalance[]
  isLoading: boolean
}

export default function BalanceCard({ balances, isLoading }: Props) {
  const [hidden, setHidden] = useState(false)
  const sol = balances.find(b => b.meta.symbol === 'SOL')
  const hasUsdValues = balances.some(b => b.usdValue !== undefined)
  const totalUsd = hasUsdValues ? balances.reduce((sum, b) => sum + (b.usdValue ?? 0), 0) : null

  const solChange = sol?.change24h ?? 0
  const positive = solChange >= 0
  const usdChange = totalUsd != null ? (totalUsd * solChange) / 100 : null

  return (
    <div className="flex flex-col items-center pt-5 pb-3 px-4">
      <button
        onClick={() => setHidden(v => !v)}
        className="flex items-center gap-1.5 mb-2 opacity-40 hover:opacity-60 transition-opacity"
      >
        <p className="text-[10px] uppercase tracking-widest font-medium">Total Balance</p>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {hidden
            ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>
            : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
          }
        </svg>
      </button>

      {isLoading && !sol ? (
        <Spinner size="sm" className="my-3" />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex flex-col items-center gap-2"
        >
          {totalUsd !== null ? (
            <>
              <div className="flex items-baseline gap-0.5">
                <span className="text-[13px] font-semibold opacity-60 mt-1">$</span>
                <span className={`text-5xl font-bold tracking-tight ${hidden ? 'blur-sm select-none' : ''}`}>
                  {hidden ? '••••••' : totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {!hidden && solChange !== 0 && usdChange !== null && (
                <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold ${
                  positive
                    ? 'bg-[#ABFF7A]/15 text-[#ABFF7A]'
                    : 'bg-red-500/15 text-red-400'
                }`}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    {positive ? <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></> : <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>}
                  </svg>
                  {positive ? '+' : ''}${Math.abs(usdChange).toFixed(2)} · {positive ? '+' : ''}{solChange.toFixed(2)}% today
                </div>
              )}
            </>
          ) : (
            <div className="flex items-end gap-2">
              <span className={`text-5xl font-bold tracking-tight ${hidden ? 'blur-sm' : ''}`}>
                {hidden ? '••••' : (sol?.amount ?? 0).toFixed(4)}
              </span>
              <span className="text-lg font-medium opacity-50 mb-1">SOL</span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
