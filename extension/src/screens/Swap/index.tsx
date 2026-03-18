import { useState } from 'react'
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
import type { JupiterQuote } from '../../lib/jupiter'

type Token = 'SOL' | 'USDC'
type Step = 'form' | 'confirm' | 'done'

export default function SwapScreen() {
  const navigate = useNavigate()
  const { keypair, network } = useWallet()
  const { balances } = useBalance()
  const { toast } = useToast()

  const [inputToken, setInputToken] = useState<Token>('SOL')
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [isLoading, setIsLoading] = useState(false)
  const [quote, setQuote] = useState<JupiterQuote | null>(null)
  const [quoteDisplay, setQuoteDisplay] = useState<ReturnType<typeof parseQuoteForDisplay> | null>(null)
  const [txSig, setTxSig] = useState('')
  const [error, setError] = useState('')

  const outputToken: Token = inputToken === 'SOL' ? 'USDC' : 'SOL'
  const inputBalance = balances.find(b => b.meta.symbol === inputToken)?.amount ?? 0

  async function handleGetQuote() {
    if (network !== 'mainnet') return setError('Swaps require mainnet — go to Settings → Network → Mainnet')
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return setError('Enter a valid amount')
    if (amt > inputBalance) return setError('Insufficient balance')
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
    } catch (e: any) {
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
    setInputToken(outputToken)
    setAmount('')
    setQuote(null)
    setQuoteDisplay(null)
    setError('')
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

              <div className="flex gap-3 items-center">
                <div className="flex-1">
                  <p className="text-[10px] opacity-40 mb-1.5">From</p>
                  <div className="card-bg rounded-2xl px-4 py-3 font-semibold text-sm border border-[var(--color-border)]">{inputToken}</div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.85, rotate: 180 }}
                  onClick={flipTokens}
                  className="mt-5 w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                </motion.button>
                <div className="flex-1">
                  <p className="text-[10px] opacity-40 mb-1.5">To</p>
                  <div className="card-bg rounded-2xl px-4 py-3 font-semibold text-sm border border-[var(--color-border)]">{outputToken}</div>
                </div>
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
              <p className="text-[10px] opacity-40 -mt-2">Available: {inputBalance.toFixed(inputToken === 'SOL' ? 6 : 2)} {inputToken}</p>

              <Button fullWidth isLoading={isLoading} onClick={handleGetQuote}>Get Quote</Button>
            </motion.div>
          )}

          {step === 'confirm' && quoteDisplay && (
            <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4 mt-4">
              <button onClick={() => setStep('form')} className="text-sm opacity-50 self-start">← Back</button>
              <h2 className="text-xl font-bold mb-1">Confirm Swap</h2>
              <div className="card-bg rounded-3xl p-5 flex flex-col gap-3">
                <Row label="From" value={`${amount} ${inputToken}`} />
                <Row label="To (est.)" value={`${quoteDisplay.estimatedOutput.toFixed(outputToken === 'SOL' ? 6 : 2)} ${outputToken}`} />
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
                <span className="text-3xl">✓</span>
              </div>
              <h2 className="text-xl font-bold">Swapped!</h2>
              <a
                href={`https://solscan.io/tx/${txSig}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary underline"
              >
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
