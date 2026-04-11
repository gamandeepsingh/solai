import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Header from '../../components/layout/Header'
import BottomNav from '../../components/layout/BottomNav'
import Spinner from '../../components/ui/Spinner'
import SparklineChart from '../../components/ui/SparklineChart'
import { getTopTokenMarkets, type MarketToken } from '../../lib/prices'

function sample(arr: number[], n: number): number[] {
  if (arr.length <= n) return arr
  const step = arr.length / n
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)])
}

function fmt(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

function fmtPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  if (n >= 1) return `$${n.toFixed(2)}`
  if (n >= 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(6)}`
}

function TokenCard({ token, index }: { token: MarketToken; index: number }) {
  const navigate = useNavigate()
  const positive = token.change24h >= 0
  const spark = useMemo(() => sample(token.sparkline, 20), [token.sparkline])

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={() => navigate('/token', {
        state: {
          token: {
            meta: {
              symbol: token.symbol,
              name: token.name,
              decimals: 6,
              mint: token.id,
              logoUri: token.image,
              coingeckoId: token.id,
            },
            amount: 0,
            usdValue: undefined,
            change24h: token.change24h,
          },
        },
      })}
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
    >
      <div className="flex items-center gap-3">
        <span className="text-xs opacity-30 w-5 text-right shrink-0">{index + 1}</span>
        {token.image ? (
          <img src={token.image} alt={token.symbol} className="w-8 h-8 rounded-full shrink-0"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[var(--color-border)] flex items-center justify-center text-[10px] font-bold opacity-60 shrink-0">
            {token.symbol.slice(0, 2)}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold">{token.symbol}</p>
          <p className="text-[10px] opacity-40 truncate max-w-[100px]">{token.name}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {spark.length >= 2 && <SparklineChart data={spark} positive={positive} width={52} height={24} />}
        <div className="text-right min-w-[72px]">
          <p className="text-sm font-medium">{fmtPrice(token.price)}</p>
          <p className={`text-[10px] ${positive ? 'text-[#ABFF7A]' : 'text-[#FF6B6B]'}`}>
            {positive ? '+' : ''}{token.change24h.toFixed(2)}%
          </p>
        </div>
      </div>
    </motion.button>
  )
}

export default function ExploreScreen() {
  const [tokens, setTokens] = useState<MarketToken[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setIsLoading(true)
    getTopTokenMarkets()
      .then(t => { setTokens(t); setError('') })
      .catch(() => setError('Failed to load market data'))
      .finally(() => setIsLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return tokens
    const q = search.toLowerCase()
    return tokens.filter(t => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
  }, [tokens, search])

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      <Header />

      <div className="px-4 pt-1 pb-2">
        <h2 className="text-lg font-bold mb-2">Explore</h2>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tokens..."
            className="w-full rounded-2xl pl-8 pr-4 py-2.5 text-sm bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text)]/30 outline-none focus:border-primary/50 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {isLoading ? (
          <div className="flex justify-center mt-12"><Spinner /></div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 mt-12 text-sm opacity-40">
            <p>{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 mt-12 text-sm opacity-40">
            <p>No tokens found</p>
          </div>
        ) : (
          <div className="card-bg rounded-3xl mx-4 overflow-hidden">
            {/* Column headers */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)]">
              <span className="text-[10px] opacity-30 ml-8">Token</span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] opacity-30 w-[52px] text-center">7D</span>
                <span className="text-[10px] opacity-30 w-[72px] text-right">Price</span>
              </div>
            </div>

            {filtered.map((token, i) => (
              <div key={token.id}>
                <TokenCard token={token} index={i} />
                {i < filtered.length - 1 && <div className="mx-4 h-px bg-[var(--color-border)]" />}
              </div>
            ))}
          </div>
        )}

        {/* Market stats summary */}
        {!isLoading && tokens.length > 0 && (
          <div className="mx-4 mt-3 mb-2 grid grid-cols-2 gap-2">
            <div className="card-bg rounded-2xl px-3 py-2.5">
              <p className="text-[10px] opacity-40">Total Market Cap</p>
              <p className="text-sm font-semibold mt-0.5">{fmt(tokens.reduce((s, t) => s + t.marketCap, 0))}</p>
            </div>
            <div className="card-bg rounded-2xl px-3 py-2.5">
              <p className="text-[10px] opacity-40">24h Volume</p>
              <p className="text-sm font-semibold mt-0.5">{fmt(tokens.reduce((s, t) => s + t.volume24h, 0))}</p>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
