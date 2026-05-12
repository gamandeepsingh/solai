import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Header from '../../components/layout/Header'
import BottomNav from '../../components/layout/BottomNav'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { useWallet } from '../../context/WalletContext'
import { useBalance } from '../../hooks/useBalance'
import { useToast } from '../../components/ui/Toast'
import { getSwapQuote, executeSwap, parseQuoteForDisplay } from '../../lib/jupiter'
import { logTx } from '../../lib/history'
import { track } from '../../lib/analytics'
import { CURATED_TOKENS } from '../../lib/tokens'
import type { JupiterQuote } from '../../lib/jupiter'
import type { AgentToken } from '../../types/agent'

type Step = 'form' | 'confirm' | 'done'

// All supported swap tokens (mainnet only — Jupiter)
const SWAP_TOKENS = CURATED_TOKENS.map(t => t.symbol) as AgentToken[]

interface TokenDropdownProps {
  label: string
  value: AgentToken
  exclude: AgentToken
  balances: Map<string, number>
  onChange: (t: AgentToken) => void
}

function TokenDropdown({ label, value, exclude, balances, onChange }: TokenDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = SWAP_TOKENS
    .filter(t => t !== exclude)
    .filter(t => !search || t.toLowerCase().includes(search.toLowerCase()))

  const meta = CURATED_TOKENS.find(t => t.symbol === value)
  const bal = balances.get(value) ?? 0

  return (
    <div className="flex-1 relative" ref={ref}>
      <p className="text-[10px] opacity-40 mb-1.5">{label}</p>
      <button
        onClick={() => { setOpen(v => !v); setSearch('') }}
        className="w-full flex items-center gap-2 card-bg border border-[var(--color-border)] rounded-2xl px-3 py-2.5 hover:border-primary/40 transition-colors"
      >
        {meta?.logoUri && (
          <img src={meta.logoUri} alt={value} className="w-5 h-5 rounded-full shrink-0"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        )}
        <span className="text-sm font-semibold">{value}</span>
        {bal > 0 && <span className="text-[9px] opacity-40 ml-auto">{bal < 0.0001 ? '<0.0001' : bal.toFixed(4)}</span>}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`opacity-40 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 top-full mt-1 w-full card-bg border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-xl"
          >
            <div className="p-2 border-b border-[var(--color-border)]">
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full text-xs bg-transparent outline-none placeholder:opacity-30 px-1"
              />
            </div>
            <div className="max-h-44 overflow-y-auto">
              {filtered.map(sym => {
                const m = CURATED_TOKENS.find(t => t.symbol === sym)
                const b = balances.get(sym) ?? 0
                return (
                  <button
                    key={sym}
                    onClick={() => { onChange(sym); setOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                  >
                    {m?.logoUri && (
                      <img src={m.logoUri} alt={sym} className="w-5 h-5 rounded-full shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    )}
                    <div className='flex flex-col justify-start items-center gap-0.5'>
                    <span className="text-sm font-medium">{sym}</span>
                    <span className="text-[9px] opacity-30 ml-1">{m?.name}</span>
                    </div>
                    {b > 0 && <span className="text-[9px] text-primary ml-auto">{b.toFixed(4)}</span>}
                  </button>
                )
              })}
              {filtered.length === 0 && <p className="text-xs opacity-30 text-center py-3">No tokens found</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function SwapScreen() {
  const navigate = useNavigate()
  const { keypair, network } = useWallet()
  const { ownedBalances } = useBalance()
  const { toast } = useToast()

  const balanceMap = new Map(ownedBalances.map(b => [b.meta.symbol, b.amount]))

  const [inputToken, setInputToken] = useState<AgentToken>('SOL')
  const [outputToken, setOutputToken] = useState<AgentToken>('USDC')
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [isLoading, setIsLoading] = useState(false)
  const [quote, setQuote] = useState<JupiterQuote | null>(null)
  const [quoteDisplay, setQuoteDisplay] = useState<ReturnType<typeof parseQuoteForDisplay> | null>(null)
  const [txSig, setTxSig] = useState('')
  const [error, setError] = useState('')

  const inputBalance = balanceMap.get(inputToken) ?? 0

  async function handleGetQuote() {
    if (network !== 'mainnet') return setError('Swaps require mainnet — go to Settings → Network → Mainnet')
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return setError('Enter a valid amount')
    if (amt > inputBalance) return setError(`Insufficient ${inputToken} balance`)
    setError('')
    setIsLoading(true)
    try {
      const q = await getSwapQuote(inputToken, outputToken, amt)
      setQuote(q)
      setQuoteDisplay(parseQuoteForDisplay(q, outputToken))
      setStep('confirm')
    } catch (e: any) {
      setError(e.message ?? 'Failed to fetch quote')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSwap() {
    if (!keypair || !quote) return
    setError('')
    setIsLoading(true)
    try {
      const freshQuote = await getSwapQuote(inputToken, outputToken, parseFloat(amount))
      const sig = await executeSwap(freshQuote, keypair)
      setTxSig(sig)
      setStep('done')
      toast('Swap successful!', 'success')
      logTx({ sig, type: 'swap', timestamp: Date.now(), amount: parseFloat(amount), token: `${inputToken}→${outputToken}`, status: 'success' })
      track('swap_completed', { from: inputToken, to: outputToken, amount: parseFloat(amount) })
    } catch (e: any) {
      track('transaction_failed', { type: 'swap', error: e.message })
      const raw = e.message ?? 'Swap failed'
      const msg = raw.toLowerCase().includes('slippage') || raw.toLowerCase().includes('simulation')
        ? 'Quote expired — tap Swap to retry'
        : raw
      setError(msg)
      toast(msg, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  function flipTokens() {
    const prev = inputToken
    setInputToken(outputToken)
    setOutputToken(prev)
    setAmount('')
    setQuote(null)
    setQuoteDisplay(null)
    setError('')
  }

  function selectInput(t: AgentToken) {
    setInputToken(t)
    if (t === outputToken) setOutputToken(SWAP_TOKENS.find(x => x !== t) ?? 'USDC')
    setAmount('')
    setQuote(null)
    setQuoteDisplay(null)
    setError('')
  }

  function selectOutput(t: AgentToken) {
    setOutputToken(t)
    if (t === inputToken) setInputToken(SWAP_TOKENS.find(x => x !== t) ?? 'SOL')
    setAmount('')
    setQuote(null)
    setQuoteDisplay(null)
    setError('')
  }

  function fmtBal(v: number, sym: AgentToken) {
    if (sym === 'SOL') return v.toFixed(6)
    if (sym === 'BONK') return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
    return v.toFixed(2)
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      <Header />
      <div className="flex-1 flex flex-col px-5 pt-2 pb-20 overflow-y-auto">
        <AnimatePresence mode="wait">
          {step === 'form' && (
            <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4 mt-4">
              <div>
                <h2 className="text-xl font-bold mb-1">Swap</h2>
                <p className="text-xs opacity-40">Jupiter DEX · Mainnet only</p>
              </div>

              <div className="flex gap-2 items-end">
                <TokenDropdown label="From" value={inputToken} exclude={outputToken} balances={balanceMap} onChange={selectInput} />
                <motion.button
                  whileTap={{ scale: 0.85, rotate: 180 }}
                  onClick={flipTokens}
                  className="mb-0.5 w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                </motion.button>
                <TokenDropdown label="To" value={outputToken} exclude={inputToken} balances={balanceMap} onChange={selectOutput} />
              </div>

              <Input
                label={`Amount (${inputToken})`}
                type="number"
                placeholder="0.00"
                min="0"
                value={amount}
                onChange={e => { const v = e.target.value; if (v === '' || parseFloat(v) >= 0) { setAmount(v); setError('') } }}
                error={error}
                onKeyDown={e => e.key === 'Enter' && handleGetQuote()}
                rightElement={
                  <button onClick={() => setAmount(String(inputBalance))} className="text-[10px] text-primary font-medium">MAX</button>
                }
              />
              <p className="text-[10px] opacity-40 -mt-2">
                Available: {fmtBal(inputBalance, inputToken)} {inputToken}
              </p>

              <Button fullWidth isLoading={isLoading} onClick={handleGetQuote}>Get Quote</Button>
            </motion.div>
          )}

          {step === 'confirm' && quoteDisplay && (
            <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4 mt-4">
              <button onClick={() => setStep('form')} className="text-sm opacity-50 self-start">← Back</button>
              <h2 className="text-xl font-bold mb-1">Confirm Swap</h2>
              <div className="card-bg rounded-3xl p-5 flex flex-col gap-3">
                <Row label="From" value={`${amount} ${inputToken}`} />
                <Row label="To (est.)" value={`${quoteDisplay.estimatedOutput.toFixed(6)} ${outputToken}`} />
                <Row label="Route" value={quoteDisplay.routeLabel} />
                <Row label="Price Impact" value={`${quoteDisplay.priceImpactPct}%`} />
                <Row label="Slippage" value="0.5%" />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <Button fullWidth isLoading={isLoading} onClick={handleSwap}>Swap Now</Button>
            </motion.div>
          )}

          {step === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5 mt-10">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h2 className="text-xl font-bold">Swapped!</h2>
              <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                View on Solscan →
              </a>
              <Button onClick={() => navigate('/home')}>Back to Home</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <BottomNav />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs opacity-40">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}
