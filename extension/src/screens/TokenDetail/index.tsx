import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { TokenBalance } from '../../types/tokens'
import { getPriceHistory, getMarketData } from '../../lib/prices'

type Range = '1D' | '1W' | '1M' | '3M'
const RANGE_DAYS: Record<Range, number> = { '1D': 1, '1W': 7, '1M': 30, '3M': 90 }

// SVG coordinate space
const VW = 300
const VH = 140
// Padding: leave room for y-labels on left, x-labels on bottom
const PAD = { top: 8, bottom: 20, left: 46, right: 8 }
const CW = VW - PAD.left - PAD.right   // chart inner width
const CH = VH - PAD.top - PAD.bottom   // chart inner height

function buildPath(pts: [number, number][]) {
  return pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ')
}

function buildFill(pts: [number, number][]) {
  return [
    `M${pts[0][0]},${PAD.top + CH}`,
    ...pts.map(([x, y]) => `L${x},${y}`),
    `L${pts[pts.length - 1][0]},${PAD.top + CH}`,
    'Z',
  ].join(' ')
}

function fmtDate(ts: number, range: Range) {
  const d = new Date(ts)
  if (range === '1D') return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function fmtPrice(v: number) {
  if (v >= 10000) return `$${(v / 1000).toFixed(1)}k`
  if (v >= 1) return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return `$${v.toFixed(6)}`
}

interface ChartProps {
  data: { timestamp: number; price: number }[]
  positive: boolean
  range: Range
}

function InteractiveChart({ data, positive, range }: ChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center opacity-30 text-xs" style={{ height: VH }}>
        No data
      </div>
    )
  }

  const prices = data.map(d => d.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range_ = max - min || 1

  const pts: [number, number][] = data.map((d, i) => [
    PAD.left + (i / (data.length - 1)) * CW,
    PAD.top + CH - ((d.price - min) / range_) * CH,
  ])

  const color = positive ? '#ABFF7A' : '#FF6B6B'
  const gradId = `fcg-${positive ? 'p' : 'n'}`

  // 3 Y-axis labels
  const yLabels = [max, (max + min) / 2, min].map((v, i) => ({
    v,
    y: PAD.top + (i * CH) / 2,
  }))

  // 3 X-axis labels
  const xIdxs = [0, Math.floor((data.length - 1) / 2), data.length - 1]

  function getIdx(e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) {
    if (!svgRef.current) return null
    const rect = svgRef.current.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const scaleX = VW / rect.width
    const mouseX = (clientX - rect.left) * scaleX - PAD.left
    const idx = Math.round((mouseX / CW) * (data.length - 1))
    return Math.max(0, Math.min(data.length - 1, idx))
  }

  const displayed = hoverIdx !== null ? data[hoverIdx] : null

  return (
    <div>
      {/* Hover info / default spacer */}
      <div className="h-9 px-1 flex items-center gap-3 mb-1">
        <AnimatePresence mode="wait">
          {displayed ? (
            <motion.div
              key="hover"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="flex items-baseline gap-2"
            >
              <span className="text-base font-bold">{fmtPrice(displayed.price)}</span>
              <span className="text-[10px] opacity-40">{fmtDate(displayed.timestamp, range)}</span>
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-5" />
          )}
        </AnimatePresence>
      </div>

      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="none"
        style={{ display: 'block', cursor: 'crosshair', touchAction: 'pan-y' }}
        onMouseMove={e => setHoverIdx(getIdx(e))}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchMove={e => setHoverIdx(getIdx(e))}
        onTouchEnd={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines + Y labels */}
        {yLabels.map(({ v, y }) => (
          <g key={y}>
            <line
              x1={PAD.left} y1={y} x2={PAD.left + CW} y2={y}
              stroke="currentColor" strokeOpacity="0.08" strokeWidth="1"
            />
            <text
              x={PAD.left - 4} y={y + 3.5}
              fontSize="8" fill="currentColor" fillOpacity="0.4" textAnchor="end"
            >
              {fmtPrice(v)}
            </text>
          </g>
        ))}

        {/* Fill + line */}
        <path d={buildFill(pts)} fill={`url(#${gradId})`} />
        <path d={buildPath(pts)} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

        {/* X labels */}
        {xIdxs.map(idx => (
          <text
            key={idx}
            x={pts[idx][0]}
            y={VH - 4}
            fontSize="7.5"
            fill="currentColor"
            fillOpacity="0.35"
            textAnchor={idx === 0 ? 'start' : idx === data.length - 1 ? 'end' : 'middle'}
          >
            {fmtDate(data[idx].timestamp, range)}
          </text>
        ))}

        {/* Hover crosshair */}
        {hoverIdx !== null && (
          <>
            <line
              x1={pts[hoverIdx][0]} y1={PAD.top}
              x2={pts[hoverIdx][0]} y2={PAD.top + CH}
              stroke={color} strokeWidth="1" strokeOpacity="0.5" strokeDasharray="3,3"
            />
            <circle cx={pts[hoverIdx][0]} cy={pts[hoverIdx][1]} r="3.5" fill={color} />
            <circle cx={pts[hoverIdx][0]} cy={pts[hoverIdx][1]} r="6" fill={color} fillOpacity="0.2" />
          </>
        )}
      </svg>
    </div>
  )
}

export default function TokenDetailScreen() {
  const navigate = useNavigate()
  const { state } = useLocation() as { state: { token: TokenBalance } | null }
  const token = state?.token

  const [range, setRange] = useState<Range>('1W')
  const [history, setHistory] = useState<{ timestamp: number; price: number }[]>([])
  const [marketData, setMarketData] = useState<{ price: number; change24h: number } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchData = useCallback(async (coinId: string, days: number) => {
    setIsLoading(true)
    try {
      const [hist, mkt] = await Promise.all([
        getPriceHistory(coinId, days),
        getMarketData(coinId).catch(() => null),
      ])
      setHistory(hist)
      if (mkt) setMarketData({ price: mkt.price, change24h: mkt.change24h })
    } catch {}
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (!token?.meta.coingeckoId) return
    fetchData(token.meta.coingeckoId, RANGE_DAYS[range])
  }, [token?.meta.coingeckoId, range, fetchData])

  if (!token) {
    navigate('/home')
    return null
  }

  const price = marketData?.price
  const change = marketData?.change24h ?? token.change24h ?? 0
  const positive = change >= 0

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-[var(--color-card)] flex items-center justify-center shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        {token.meta.logoUri ? (
          <img src={token.meta.logoUri} alt={token.meta.symbol} className="w-8 h-8 rounded-full shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[var(--color-border)] flex items-center justify-center text-xs font-bold opacity-60 shrink-0">{token.meta.symbol.slice(0, 2)}</div>
        )}
        <div>
          <p className="text-sm font-bold">{token.meta.name}</p>
          <p className="text-[10px] opacity-40">{token.meta.symbol}</p>
        </div>
      </div>

      {/* Price summary */}
      <div className="px-4 pb-1">
        {price !== undefined ? (
          <p className="text-3xl font-bold">{fmtPrice(price)}</p>
        ) : (
          <p className="text-2xl font-bold">{token.amount.toFixed(token.meta.symbol === 'SOL' ? 4 : 2)} {token.meta.symbol}</p>
        )}
        <p className={`text-sm mt-0.5 ${positive ? 'text-[#ABFF7A]' : 'text-[#FF6B6B]'}`}>
          {positive ? '+' : ''}{change.toFixed(2)}% (24h)
        </p>
      </div>

      {/* Chart */}
      <div className="px-4 mt-1">
        {isLoading ? (
          <div className="flex items-center justify-center" style={{ height: VH + 36 }}>
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !token.meta.coingeckoId ? (
          <div className="flex items-center justify-center opacity-30 text-xs" style={{ height: VH + 36 }}>
            No price chart available for this token
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <InteractiveChart data={history} positive={positive} range={range} />
          </motion.div>
        )}
      </div>

      {/* Range tabs */}
      {token.meta.coingeckoId && (
        <div className="flex gap-1 px-4 mt-2">
          {(['1D', '1W', '1M', '3M'] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                range === r ? 'bg-primary text-black' : 'bg-[var(--color-card)] opacity-50 hover:opacity-80'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {/* Balance card */}
      <div className="flex-1 px-4 mt-4">
        <div className="card-bg rounded-2xl p-4 flex justify-between text-sm">
          <div>
            <p className="text-[10px] opacity-40 mb-0.5">Balance</p>
            <p className="font-semibold">{token.amount.toFixed(token.meta.symbol === 'SOL' ? 4 : 2)} {token.meta.symbol}</p>
          </div>
          {token.usdValue !== undefined && (
            <div className="text-right">
              <p className="text-[10px] opacity-40 mb-0.5">USD Value</p>
              <p className="font-semibold">${token.usdValue.toFixed(2)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
