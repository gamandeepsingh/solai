import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Header from '../../components/layout/Header'
import BottomNav from '../../components/layout/BottomNav'
import Spinner from '../../components/ui/Spinner'
import SparklineChart from '../../components/ui/SparklineChart'
import { getTopTokenMarkets, getTrendingCoins, type MarketToken, type TrendingCoin } from '../../lib/prices'

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

function openTwitter(url: string) {
  chrome.tabs.create({ url })
}

const CRYPTO_ACCOUNTS = [
  { handle: 'solana', name: 'Solana', desc: 'Official Solana account' },
  { handle: 'VitalikButerin', name: 'Vitalik Buterin', desc: 'Ethereum co-founder' },
  { handle: 'cz_binance', name: 'CZ Binance', desc: 'Former Binance CEO' },
  { handle: 'SBF_FTX', name: 'Crypto News', desc: 'Market updates & alpha' },
  { handle: 'Bybit_Official', name: 'Bybit', desc: 'Crypto exchange updates' },
  { handle: 'coingecko', name: 'CoinGecko', desc: 'Market data & rankings' },
  { handle: 'DefiLlama', name: 'DeFi Llama', desc: 'DeFi TVL tracker' },
  { handle: 'Uniswap', name: 'Uniswap', desc: 'Leading DEX protocol' },
]

const CRYPTO_HASHTAGS = [
  { tag: 'Solana', label: '#Solana' },
  { tag: 'DeFi', label: '#DeFi' },
  { tag: 'NFT', label: '#NFT' },
  { tag: 'Web3', label: '#Web3' },
  { tag: 'altcoin', label: '#Altcoin' },
  { tag: 'Bitcoin', label: '#Bitcoin' },
]

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

function TrendingCoinRow({ coin, index }: { coin: TrendingCoin; index: number }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => openTwitter(`https://twitter.com/search?q=%24${coin.symbol}+crypto&src=typed_query&f=live`)}
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
    >
      <div className="flex items-center gap-3">
        <span className="text-xs opacity-30 w-5 text-right shrink-0">{index + 1}</span>
        {coin.image ? (
          <img src={coin.image} alt={coin.symbol} className="w-8 h-8 rounded-full shrink-0"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[var(--color-border)] flex items-center justify-center text-[10px] font-bold opacity-60 shrink-0">
            {coin.symbol.slice(0, 2)}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold">${coin.symbol}</p>
          <p className="text-[10px] opacity-40 truncate max-w-[120px]">{coin.name}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 opacity-40">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        <span className="text-[10px]">X</span>
      </div>
    </motion.button>
  )
}

function TwitterTab() {
  const [trending, setTrending] = useState<TrendingCoin[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setIsLoading(true)
    getTrendingCoins()
      .then(t => { setTrending(t); setError('') })
      .catch(() => setError('Failed to load trending'))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="space-y-3">
      <div className="card-bg rounded-3xl mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)]">
          <span className="text-xs font-semibold opacity-60">Trending on X</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="opacity-40">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : error ? (
          <div className="py-8 text-center text-xs opacity-40">{error}</div>
        ) : (
          trending.map((coin, i) => (
            <div key={coin.id}>
              <TrendingCoinRow coin={coin} index={i} />
              {i < trending.length - 1 && <div className="mx-4 h-px bg-[var(--color-border)]" />}
            </div>
          ))
        )}
      </div>

      <div className="card-bg rounded-3xl mx-4 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--color-border)]">
          <span className="text-xs font-semibold opacity-60">Trending Hashtags</span>
        </div>
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {CRYPTO_HASHTAGS.map(({ tag, label }) => (
            <motion.button
              key={tag}
              whileTap={{ scale: 0.95 }}
              onClick={() => openTwitter(`https://twitter.com/search?q=%23${tag}&src=typed_query&f=live`)}
              className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              {label}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="card-bg rounded-3xl mx-4 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--color-border)]">
          <span className="text-xs font-semibold opacity-60">Accounts to Follow</span>
        </div>
        {CRYPTO_ACCOUNTS.map((acc, i) => (
          <div key={acc.handle}>
            <motion.button
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => openTwitter(`https://twitter.com/${acc.handle}`)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-border)] flex items-center justify-center text-[10px] font-bold opacity-60 shrink-0">
                  {acc.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold">{acc.name}</p>
                  <p className="text-[10px] opacity-40">@{acc.handle}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 opacity-40">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </div>
            </motion.button>
            {i < CRYPTO_ACCOUNTS.length - 1 && <div className="mx-4 h-px bg-[var(--color-border)]" />}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ExploreScreen() {
  const [tokens, setTokens] = useState<MarketToken[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'markets' | 'twitter'>('markets')

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

        <div className="flex gap-1 p-1 rounded-2xl bg-[var(--color-card)] border border-[var(--color-border)] mb-3">
          <button
            onClick={() => setTab('markets')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-colors ${tab === 'markets' ? 'bg-primary text-black' : 'opacity-40'}`}
          >
            Markets
          </button>
          <button
            onClick={() => setTab('twitter')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${tab === 'twitter' ? 'bg-primary text-black' : 'opacity-40'}`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Crypto X
          </button>
        </div>

        {tab === 'markets' && (
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
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {tab === 'twitter' ? (
          <TwitterTab />
        ) : (
          <>
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
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
