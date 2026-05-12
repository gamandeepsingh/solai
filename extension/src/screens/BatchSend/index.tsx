import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Header from '../../components/layout/Header'
import BottomNav from '../../components/layout/BottomNav'
import { useWallet } from '../../context/WalletContext'
import { useToast } from '../../components/ui/Toast'
import { sendSol } from '../../lib/solana'
import { logTx } from '../../lib/history'
import { isValidSolanaAddress } from '../../lib/solana'

interface BatchRow {
  address: string
  amount: string
  valid: boolean
  error?: string
}

function parseInput(raw: string): BatchRow[] {
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split(/[\s,\t]+/)
      const address = parts[0] ?? ''
      const amount = parts[1] ?? ''
      const amtNum = parseFloat(amount)
      if (!address) return { address, amount, valid: false, error: 'Missing address' }
      if (!isValidSolanaAddress(address)) return { address, amount, valid: false, error: 'Invalid address' }
      if (!amount || isNaN(amtNum) || amtNum <= 0) return { address, amount, valid: false, error: 'Invalid amount' }
      return { address, amount, valid: true }
    })
}

export default function BatchSendScreen() {
  const navigate = useNavigate()
  const { keypair, network } = useWallet()
  const { toast } = useToast()

  const [input, setInput] = useState('')
  const [rows, setRows] = useState<BatchRow[]>([])
  const [step, setStep] = useState<'input' | 'confirm' | 'sending' | 'done'>('input')
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<{ address: string; sig?: string; error?: string }[]>([])

  const validRows = rows.filter(r => r.valid)
  const totalSol = validRows.reduce((s, r) => s + parseFloat(r.amount), 0)

  function handleParse() {
    const parsed = parseInput(input)
    setRows(parsed)
    if (parsed.some(r => r.valid)) setStep('confirm')
  }

  async function handleSend() {
    if (!keypair || !validRows.length) return
    setStep('sending')
    setProgress(0)
    const res: typeof results = []
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i]
      try {
        const sig = await sendSol(keypair, row.address, parseFloat(row.amount), network)
        await logTx({ sig, type: 'send', timestamp: Date.now(), amount: parseFloat(row.amount), token: 'SOL', toOrFrom: row.address, status: 'success', network })
        res.push({ address: row.address, sig })
      } catch (e: any) {
        res.push({ address: row.address, error: e?.message ?? 'Failed' })
      }
      setProgress(i + 1)
    }
    setResults(res)
    setStep('done')
  }

  const succeeded = results.filter(r => r.sig).length
  const failed = results.filter(r => r.error).length

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      <Header />
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        <div className="flex items-center gap-3 py-3">
          <button onClick={() => step === 'input' ? navigate(-1) : setStep('input')} className="opacity-50">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <h2 className="text-lg font-bold">Batch Send</h2>
        </div>

        <AnimatePresence mode="wait">
          {step === 'input' && (
            <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
              <div className="card-bg rounded-2xl p-3">
                <p className="text-[10px] opacity-40 mb-1">Format: one recipient per line</p>
                <p className="text-[10px] font-mono opacity-60">ADDRESS AMOUNT_SOL</p>
                <p className="text-[10px] font-mono opacity-40 mt-0.5">7xKd...Abc3 0.05</p>
              </div>
              <textarea
                className="w-full rounded-2xl px-4 py-3 text-xs font-mono bg-[var(--color-card)] border border-[var(--color-border)] outline-none focus:border-primary/60 resize-none h-48"
                placeholder={"7xKdABC123... 0.05\n9mNpXYZ789... 0.1\nEtc..."}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handleParse()}
              />
              <button
                onClick={handleParse}
                disabled={!input.trim()}
                className="w-full py-3 rounded-2xl bg-primary text-black text-sm font-semibold disabled:opacity-40"
              >
                Preview
              </button>
            </motion.div>
          )}

          {step === 'confirm' && (
            <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
              <div className="card-bg rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-40">Recipients</p>
                  <p className="text-sm font-bold">{validRows.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-40">Total SOL</p>
                  <p className="text-sm font-bold">{totalSol.toFixed(6)}</p>
                </div>
              </div>

              {rows.some(r => !r.valid) && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-3">
                  <p className="text-xs text-yellow-400">{rows.filter(r => !r.valid).length} invalid rows will be skipped</p>
                </div>
              )}

              <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                {rows.map((row, i) => (
                  <div key={i} className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs ${row.valid ? 'card-bg' : 'bg-red-500/5 border border-red-500/20'}`}>
                    <div className="min-w-0">
                      <p className={`font-mono truncate ${row.valid ? 'opacity-70' : 'opacity-40 line-through'}`}>
                        {row.address.slice(0, 8)}…{row.address.slice(-6)}
                      </p>
                      {row.error && <p className="text-[10px] text-red-400">{row.error}</p>}
                    </div>
                    <p className={`font-semibold shrink-0 ml-3 ${row.valid ? 'text-primary' : 'opacity-30'}`}>
                      {row.valid ? `${row.amount} SOL` : '—'}
                    </p>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSend}
                className="w-full py-3 rounded-2xl bg-primary text-black text-sm font-semibold"
              >
                Send to {validRows.length} addresses
              </button>
            </motion.div>
          )}

          {step === 'sending' && (
            <motion.div key="sending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-5 mt-10">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-sm font-semibold">Sending…</p>
              <div className="w-full card-bg rounded-2xl p-4">
                <div className="flex justify-between text-xs mb-2">
                  <span className="opacity-40">Progress</span>
                  <span className="opacity-60">{progress} / {validRows.length}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(progress / validRows.length) * 100}%` }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5 mt-8">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold">Done</h3>
                <p className="text-xs opacity-50 mt-1">
                  {succeeded} sent{failed > 0 ? `, ${failed} failed` : ''}
                </p>
              </div>
              <div className="w-full flex flex-col gap-1.5 max-h-52 overflow-y-auto">
                {results.map((r, i) => (
                  <div key={i} className="flex items-center justify-between card-bg rounded-xl px-3 py-2 text-xs">
                    <p className="font-mono opacity-50">{r.address.slice(0, 8)}…{r.address.slice(-6)}</p>
                    {r.sig ? (
                      <a href={`https://solscan.io/tx/${r.sig}`} target="_blank" rel="noopener noreferrer" className="text-primary underline text-[10px]">View →</a>
                    ) : (
                      <span className="text-red-400 text-[10px]">Failed</span>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => navigate('/home')} className="w-full py-3 rounded-2xl bg-primary text-black text-sm font-semibold">
                Done
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <BottomNav />
    </div>
  )
}
