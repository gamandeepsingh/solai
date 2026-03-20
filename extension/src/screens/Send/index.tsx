import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Header from '../../components/layout/Header'
import BottomNav from '../../components/layout/BottomNav'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { useTransaction } from '../../hooks/useTransaction'
import { useBalance } from '../../hooks/useBalance'
import { isValidSolanaAddress } from '../../lib/solana'
import { logTx } from '../../lib/history'
import FadeIn from '../../components/animations/FadeIn'

type Token = 'SOL' | 'USDC' | 'USDT'
type Step = 'address' | 'amount' | 'confirm' | 'done'

export default function SendScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const prefilled = (location.state as any)?.recipient as string | undefined
  const { send, isLoading } = useTransaction()
  const { balances } = useBalance()
  const [step, setStep] = useState<Step>(prefilled ? 'amount' : 'address')
  const [recipient, setRecipient] = useState(prefilled ?? '')
  const [amount, setAmount] = useState('')
  const [token, setToken] = useState<Token>('SOL')
  const [error, setError] = useState('')
  const [txSig, setTxSig] = useState('')

  const tokenBalance = balances.find(b => b.meta.symbol === token)?.amount ?? 0
  const tokenDecimals = token === 'SOL' ? 4 : 2

  function goAddress() {
    if (!isValidSolanaAddress(recipient)) return setError('Invalid Solana address')
    setError('')
    setStep('amount')
  }

  function goConfirm() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return setError('Enter a valid amount')
    if (amt > tokenBalance) return setError('Insufficient balance')
    setError('')
    setStep('confirm')
  }

  async function handleSend() {
    try {
      const sig = await send(recipient, parseFloat(amount), token)
      setTxSig(sig)
      setStep('done')
      logTx({ sig, type: 'send', timestamp: Date.now(), amount: parseFloat(amount), token, toOrFrom: recipient, status: 'success' })
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      <Header />
      <div className="flex-1 flex flex-col px-5 pt-2 pb-20 overflow-y-auto">
        <AnimatePresence mode="wait">
          {step === 'address' && (
            <motion.div key="address" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4 mt-4">
              <div>
                <h2 className="text-xl font-bold mb-1">Send</h2>
                <p className="text-xs opacity-40">Enter recipient address</p>
              </div>
              <Input
                label="Recipient Address"
                placeholder="Solana wallet address"
                value={recipient}
                onChange={e => { setRecipient(e.target.value); setError('') }}
                error={error}
                onKeyDown={e => e.key === 'Enter' && goAddress()}
              />
              <div className="flex gap-2">
                {(['SOL', 'USDC', 'USDT'] as Token[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setToken(t)}
                    className={`flex-1 py-2.5 rounded-2xl text-xs font-medium border transition-colors ${token === t ? 'bg-primary text-black border-primary' : 'border-[var(--color-border)]'}`}
                  >{t}</button>
                ))}
              </div>
              <Button fullWidth onClick={goAddress}>Continue</Button>
            </motion.div>
          )}

          {step === 'amount' && (
            <motion.div key="amount" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4 mt-4">
              <button onClick={() => setStep('address')} className="text-sm opacity-50 self-start">← Back</button>
              <div>
                <h2 className="text-xl font-bold mb-1">Amount</h2>
                <p className="text-xs opacity-40">Available: {tokenBalance.toFixed(tokenDecimals)} {token}</p>
              </div>
              <Input
                label={`Amount (${token})`}
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={e => { setAmount(e.target.value); setError('') }}
                error={error}
                onKeyDown={e => e.key === 'Enter' && goConfirm()}
                rightElement={
                  <button onClick={() => setAmount(String(tokenBalance))} className="text-[10px] text-primary font-medium">MAX</button>
                }
              />
              <Button fullWidth onClick={goConfirm}>Review</Button>
            </motion.div>
          )}

          {step === 'confirm' && (
            <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4 mt-4">
              <button onClick={() => setStep('amount')} className="text-sm opacity-50 self-start">← Back</button>
              <h2 className="text-xl font-bold mb-1">Confirm Send</h2>
              <div className="card-bg rounded-3xl p-5 flex flex-col gap-3">
                <Row label="Token" value={token} />
                <Row label="Amount" value={`${amount} ${token}`} />
                <Row label="To" value={`${recipient.slice(0, 8)}...${recipient.slice(-8)}`} />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <Button fullWidth isLoading={isLoading} onClick={handleSend}>Send Now</Button>
            </motion.div>
          )}

          {step === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5 mt-10">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-3xl">✓</span>
              </div>
              <h2 className="text-xl font-bold">Sent!</h2>
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
