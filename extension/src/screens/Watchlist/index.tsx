import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Header from '../../components/layout/Header'
import BottomNav from '../../components/layout/BottomNav'
import { getLocal, setLocal } from '../../lib/storage'
import { useToast } from '../../components/ui/Toast'

interface TokenPrice {
  id: string
  symbol: string
  name: string
  current_price: number
  price_change_percentage_24h: number
  image: string
}

const CURATED_IDS: { id: string; symbol: string; name: string }[] = [
  { id: 'solana',                     symbol: 'SOL',   name: 'Solana' },
  { id: 'usd-coin',                   symbol: 'USDC',  name: 'USD Coin' },
  { id: 'tether',                     symbol: 'USDT',  name: 'Tether' },
  { id: 'jupiter-exchange-solana',    symbol: 'JUP',   name: 'Jupiter' },
  { id: 'bonk',                       symbol: 'BONK',  name: 'Bonk' },
  { id: 'jito-governance-token',      symbol: 'JTO',   name: 'Jito' },
  { id: 'raydium',                    symbol: 'RAY',   name: 'Raydium' },
  { id: 'orca',                       symbol: 'ORCA',  name: 'Orca' },
  { id: 'helium',                     symbol: 'HNT',   name: 'Helium' },
  { id: 'pyth-network',               symbol: 'PYTH',  name: 'Pyth' },
]

function fmt(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  if (n >= 1)    return `$${n.toFixed(2)}`
  if (n >= 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(6)}`
}

export default function WatchlistScreen() {
  const { toast } = useToast()
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [prices, setPrices] = useState<Record<string, TokenPrice>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    getLocal('watchlist').then(w => setWatchlist(w ?? ['solana', 'usd-coin']))
  }, [])

  const fetchPrices = useCallback(async (ids: string[]) => {
    if (!ids.length) return
    setIsLoading(true)
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(',')}&order=market_cap_desc&per_page=50&sparkline=false`
      )
      const data: TokenPrice[] = await res.json()
      const map: Record<string, TokenPrice> = {}
      for (const t of data) map[t.id] = t
      setPrices(map)
    } catch {
      toast('Could not fetch prices', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (watchlist.length) fetchPrices(watchlist)
  }, [watchlist])

  async function addToken(id: string) {
    if (watchlist.includes(id)) return
    const updated = [...watchlist, id]
    await setLocal('watchlist', updated)
    setWatchlist(updated)
    setShowAdd(false)
    fetchPrices(updated)
  }

  async function removeToken(id: string) {
    const updated = watchlist.filter(w => w !== id)
    await setLocal('watchlist', updated)
    setWatchlist(updated)
  }

  const [untrackedPrices, setUntrackedPrices] = useState<Record<string, TokenPrice>>({})
  const [loadingUntracked, setLoadingUntracked] = useState(false)

  const untracked = CURATED_IDS.filter(t => !watchlist.includes(t.id))

  async function openAddSheet() {
    setShowAdd(true)
    if (!untracked.length) return
    setLoadingUntracked(true)
    try {
      const ids = untracked.map(t => t.id).join(',')
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=20&sparkline=false`)
      const data: TokenPrice[] = await res.json()
      const map: Record<string, TokenPrice> = {}
      for (const t of data) map[t.id] = t
      setUntrackedPrices(map)
    } catch {} finally {
      setLoadingUntracked(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      <Header />
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        <div className="flex items-center justify-between py-3">
          <h2 className="text-lg font-bold">Watchlist</h2>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={openAddSheet}
            className="w-8 h-8 rounded-full bg-primary text-black flex items-center justify-center font-bold text-lg"
          >+</motion.button>
        </div>

        {watchlist.length === 0 ? (
          <div className="flex flex-col items-center gap-3 mt-10 opacity-40">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <p className="text-sm">No tokens tracked</p>
            <p className="text-xs">Tap + to add tokens</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {watchlist.map(id => {
              const p = prices[id]
              const meta = CURATED_IDS.find(t => t.id === id)
              const name = p?.name ?? meta?.name ?? id
              const symbol = p?.symbol?.toUpperCase() ?? meta?.symbol ?? ''
              const change = p?.price_change_percentage_24h ?? 0
              const positive = change >= 0
              return (
                <motion.div
                  key={id}
                  layout
                  className="card-bg rounded-2xl px-4 py-3 flex items-center gap-3"
                >
                  {p?.image ? (
                    <img src={p.image} alt={symbol} className="w-8 h-8 rounded-full shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {symbol.slice(0,2)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{name}</p>
                    <p className="text-[10px] opacity-40 uppercase">{symbol}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {isLoading && !p ? (
                      <div className="w-16 h-4 bg-[var(--color-border)] rounded animate-pulse" />
                    ) : p ? (
                      <>
                        <p className="text-sm font-semibold">{fmt(p.current_price)}</p>
                        <p className={`text-[10px] font-medium ${positive ? 'text-green-400' : 'text-red-400'}`}>
                          {positive ? '+' : ''}{change.toFixed(2)}%
                        </p>
                      </>
                    ) : (
                      <p className="text-[10px] opacity-30">—</p>
                    )}
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => removeToken(id)}
                    className="w-6 h-6 rounded-full flex items-center justify-center opacity-20 hover:opacity-60 hover:text-red-400 transition-all shrink-0"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </motion.button>
                </motion.div>
              )
            })}

            <button
              onClick={() => fetchPrices(watchlist)}
              disabled={isLoading}
              className="w-full py-2 text-xs opacity-40 hover:opacity-70 flex items-center justify-center gap-1.5 disabled:opacity-20"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              Refresh prices
            </button>
          </div>
        )}
      </div>
      <BottomNav />

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-end z-50"
            onClick={() => setShowAdd(false)}
          >
            <motion.div initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
              className="w-full bg-[var(--color-card)] rounded-t-3xl flex flex-col max-h-[75%]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--color-border)] shrink-0">
                <p className="text-sm font-semibold">Add Token</p>
                <button onClick={() => setShowAdd(false)} className="opacity-40 hover:opacity-70">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-2">
                {untracked.length === 0 ? (
                  <p className="text-xs opacity-40 text-center py-6">All available tokens are already tracked</p>
                ) : loadingUntracked ? (
                  <div className="flex justify-center py-6">
                    <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {untracked.map(t => {
                      const p = untrackedPrices[t.id]
                      const change = p?.price_change_percentage_24h ?? 0
                      const positive = change >= 0
                      return (
                        <button key={t.id} onClick={() => addToken(t.id)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-primary/5 transition-colors w-full text-left">
                          {p?.image ? (
                            <img src={p.image} alt={t.symbol} className="w-8 h-8 rounded-full shrink-0"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                              {t.symbol.slice(0,2)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{t.name}</p>
                            <p className="text-[10px] opacity-40 uppercase">{t.symbol}</p>
                          </div>
                          {p && (
                            <div className="text-right shrink-0">
                              <p className="text-xs font-medium">{fmt(p.current_price)}</p>
                              <p className={`text-[10px] ${positive ? 'text-green-400' : 'text-red-400'}`}>
                                {positive ? '+' : ''}{change.toFixed(2)}%
                              </p>
                            </div>
                          )}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="px-4 pb-5 pt-2 shrink-0">
                <button onClick={() => setShowAdd(false)} className="w-full py-2.5 rounded-2xl border border-[var(--color-border)] text-sm opacity-50 hover:opacity-80 transition-opacity">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
