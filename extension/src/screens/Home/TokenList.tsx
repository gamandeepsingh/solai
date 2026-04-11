import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { TokenBalance } from '../../types/tokens'
import SparklineChart from '../../components/ui/SparklineChart'
import { getPriceHistory } from '../../lib/prices'

function sample(arr: { price: number }[], count: number): number[] {
  if (arr.length <= count) return arr.map(p => p.price)
  const step = arr.length / count
  return Array.from({ length: count }, (_, i) => arr[Math.floor(i * step)].price)
}

function fmtAmount(token: TokenBalance): string {
  const { symbol } = token.meta
  if (symbol === 'SOL') return token.amount.toFixed(4)
  if (symbol === 'BONK') return token.amount > 1_000_000 ? `${(token.amount / 1_000_000).toFixed(2)}M` : token.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return token.amount.toFixed(2)
}

function fmtUsd(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(2)}k`
  return `$${v.toFixed(2)}`
}

function TokenRow({
  token,
  sparkline,
  index,
  dim = false,
}: {
  token: TokenBalance
  sparkline?: number[]
  index: number
  dim?: boolean
}) {
  const navigate = useNavigate()
  const change = token.change24h ?? 0
  const positive = change >= 0
  const hasBalance = token.amount > 0

  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: dim ? 0.5 : 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={() => navigate('/token', { state: { token } })}
      className="w-full flex items-center justify-between py-3 px-4 hover:bg-white/5 transition-colors text-left"
    >
      <div className="flex items-center gap-3">
        {token.meta.logoUri ? (
          <img
            src={token.meta.logoUri}
            alt={token.meta.symbol}
            className="w-8 h-8 rounded-full shrink-0"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[var(--color-border)] flex items-center justify-center text-[10px] font-bold opacity-60 shrink-0">
            {token.meta.symbol.slice(0, 2)}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold">{token.meta.symbol}</p>
          <p className="text-[10px] opacity-40 truncate">{token.meta.name}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {sparkline && sparkline.length >= 2 && (
          <SparklineChart data={sparkline} positive={positive} width={52} height={24} />
        )}
        <div className="text-right min-w-[68px]">
          {hasBalance ? (
            <>
              <p className="text-sm font-medium">{fmtAmount(token)}</p>
              {token.usdValue !== undefined ? (
                <p className="text-[10px] opacity-40">{fmtUsd(token.usdValue)}</p>
              ) : (
                <p className={`text-[10px] ${positive ? 'text-[#ABFF7A]' : 'text-[#FF6B6B]'}`}>
                  {positive ? '+' : ''}{change.toFixed(2)}%
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm opacity-25">—</p>
              {change !== 0 && (
                <p className={`text-[10px] ${positive ? 'text-[#ABFF7A]/50' : 'text-[#FF6B6B]/50'}`}>
                  {positive ? '+' : ''}{change.toFixed(2)}%
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </motion.button>
  )
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-1.5">
      <p className="text-[11px] font-semibold opacity-40 uppercase tracking-wider">{title}</p>
      {count !== undefined && (
        <span className="text-[9px] opacity-25">{count}</span>
      )}
    </div>
  )
}

interface Props {
  ownedBalances: TokenBalance[]
  allTokenBalances: TokenBalance[]
}

export default function TokenList({ ownedBalances, allTokenBalances }: Props) {
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({})
  const [showAll, setShowAll] = useState(false)

  // Tokens in the curated list that user doesn't own
  const zeroTokens = allTokenBalances.filter(t => t.amount === 0)
  const displayZero = showAll ? zeroTokens : zeroTokens.slice(0, 5)

  const allSparklineTokens = [...ownedBalances, ...zeroTokens].filter(b => b.meta.coingeckoId)

  useEffect(() => {
    if (!allSparklineTokens.length) return
    let cancelled = false
    ;(async () => {
      for (const token of allSparklineTokens) {
        if (cancelled) break
        if (sparklines[token.meta.mint]) continue
        try {
          const history = await getPriceHistory(token.meta.coingeckoId!, 7)
          const pts = sample(history, 20)
          if (!cancelled) setSparklines(prev => ({ ...prev, [token.meta.mint]: pts }))
        } catch {}
        await new Promise(r => setTimeout(r, 250))
      }
    })()
    return () => { cancelled = true }
  }, [ownedBalances.map(b => b.meta.mint).join(','), allTokenBalances.length])

  return (
    <div className="mx-4">
      {/* ── Your Tokens ─────────────────────────────── */}
      {ownedBalances.length > 0 && (
        <>
          <SectionHeader title="Your Tokens" count={ownedBalances.length} />
          <div className="card-bg rounded-3xl overflow-hidden">
            {ownedBalances.map((token, i) => (
              <div key={token.meta.mint}>
                <TokenRow token={token} sparkline={sparklines[token.meta.mint]} index={i} />
                {i < ownedBalances.length - 1 && <div className="mx-4 h-px bg-[var(--color-border)]" />}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Popular Tokens ───────────────────────────── */}
      {zeroTokens.length > 0 && (
        <>
          <SectionHeader title="Popular Tokens" count={zeroTokens.length} />
          <div className="card-bg rounded-3xl overflow-hidden mb-14">
            {displayZero.map((token, i) => (
              <div key={token.meta.mint}>
                <TokenRow token={token} sparkline={sparklines[token.meta.mint]} index={ownedBalances.length + i} dim />
                {i < displayZero.length - 1 && <div className="mx-4 h-px bg-[var(--color-border)]" />}
              </div>
            ))}

            {zeroTokens.length > 5 && (
              <button
                onClick={() => setShowAll(v => !v)}
                className="w-full py-3 text-xs text-primary/70 hover:text-primary transition-colors text-center border-t border-[var(--color-border)]"
              >
                {showAll ? 'Show less' : `Show ${zeroTokens.length - 5} more`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
