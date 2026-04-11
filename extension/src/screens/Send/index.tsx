import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Header from '../../components/layout/Header'
import BottomNav from '../../components/layout/BottomNav'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { useTransaction } from '../../hooks/useTransaction'
import { useBalance } from '../../hooks/useBalance'
import { validateRecipientAddress } from '../../lib/solana'
import { logTx } from '../../lib/history'
import { useWallet } from '../../context/WalletContext'
import { updateContactInteraction } from '../../lib/contacts'
import type { TokenBalance } from '../../types/tokens'

type Step = 'address' | 'amount' | 'confirm' | 'done'

function TokenPicker({
  tokens,
  selected,
  onSelect,
}: {
  tokens: TokenBalance[]
  selected: TokenBalance | null
  onSelect: (t: TokenBalance) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {tokens.map(t => {
        const active = selected?.meta.symbol === t.meta.symbol
        return (
          <button
            key={t.meta.mint}
            onClick={() => onSelect(t)}
            className={`flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-2xl text-xs font-semibold border transition-colors ${
              active ? 'bg-primary text-black border-primary' : 'border-[var(--color-border)] opacity-60 hover:opacity-90'
            }`}
          >
            {t.meta.logoUri && (
              <img src={t.meta.logoUri} alt={t.meta.symbol} className="w-4 h-4 rounded-full"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            )}
            {t.meta.symbol}
          </button>
        )
      })}
    </div>
  )
}

export default function SendScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const prefilled = (location.state as any)?.recipient as string | undefined
  const { send, isLoading } = useTransaction()
  const { ownedBalances } = useBalance()
  const { network } = useWallet()

  const [step, setStep] = useState<Step>(prefilled ? 'amount' : 'address')
  const [recipient, setRecipient] = useState(prefilled ?? '')
  const [amount, setAmount] = useState('')
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null)
  const [error, setError] = useState('')
  const [txSig, setTxSig] = useState('')
  const [addrWarning, setAddrWarning] = useState('')
  const [anomalyWarning, setAnomalyWarning] = useState('')

  // Default to SOL if available
  const activeToken = selectedToken ?? ownedBalances.find(b => b.meta.symbol === 'SOL') ?? ownedBalances[0] ?? null
  const tokenBalance = activeToken?.amount ?? 0
  const SOL_RESERVE = 0.00095
  const maxSendable = activeToken?.meta.symbol === 'SOL'
    ? Math.max(0, tokenBalance - SOL_RESERVE)
    : tokenBalance

  function fmtMax(v: number) {
    if (activeToken?.meta.symbol === 'SOL') return v.toFixed(6)
    if (activeToken?.meta.symbol === 'BONK') return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
    return v.toFixed(2)
  }

  async function goAddress() {
    setAddrWarning('')
    setError('')
    const result = await validateRecipientAddress(recipient, network)
    if (!result.valid) return setError(result.warning ?? 'Invalid Solana address')
    if (result.warning) setAddrWarning(result.warning)
    setStep('amount')
  }

  function goConfirm() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return setError('Enter a valid amount')
    if (amt > maxSendable) return setError(
      activeToken?.meta.symbol === 'SOL'
        ? `Max sendable is ${maxSendable.toFixed(6)} SOL (fee reserved)`
        : 'Insufficient balance'
    )
    setError('')
    if (maxSendable > 0 && amt > maxSendable * 0.5) {
      setAnomalyWarning(`You are sending more than 50% of your ${activeToken?.meta.symbol} balance — double-check before confirming.`)
    } else {
      setAnomalyWarning('')
    }
    setStep('confirm')
  }

  async function handleSend() {
    if (!activeToken) return
    try {
      const sig = await send(recipient, parseFloat(amount), activeToken.meta.symbol)
      setTxSig(sig)
      setStep('done')
      logTx({ sig, type: 'send', timestamp: Date.now(), amount: parseFloat(amount), token: activeToken.meta.symbol, toOrFrom: recipient, status: 'success' })
      updateContactInteraction(recipient).catch(() => {})
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
                className="px-3"
                value={recipient}
                onChange={e => { setRecipient(e.target.value); setError('') }}
                error={error}
                onKeyDown={e => e.key === 'Enter' && goAddress()}
              />
              <div>
                <p className="text-[10px] opacity-40 mb-2">Select token</p>
                {ownedBalances.length > 0 ? (
                  <TokenPicker tokens={ownedBalances} selected={activeToken} onSelect={t => { setSelectedToken(t); setError('') }} />
                ) : (
                  <p className="text-xs opacity-40">No tokens in wallet</p>
                )}
              </div>
              {addrWarning && (
                <div className="rounded-2xl bg-yellow-500/10 border border-yellow-500/30 px-3 py-2">
                  <p className="text-xs text-yellow-400">{addrWarning}</p>
                </div>
              )}
              <Button fullWidth onClick={goAddress} disabled={!activeToken}>Continue</Button>
            </motion.div>
          )}

          {step === 'amount' && activeToken && (
            <motion.div key="amount" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4 mt-4">
              <button onClick={() => setStep('address')} className="text-sm opacity-50 self-start flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M19 11H7.14l3.63-4.36a1 1 0 1 0-1.54-1.28l-5 6a1.09 1.09 0 0 0-.09.15c0 .05-.05.08-.07.13A1 1 0 0 0 4 12a1 1 0 0 0 .07.36c0 .05 0 .08.07.13a1 1 0 0 0 .09.15l5 6A1 1 0 0 0 10 19a1 1 0 0 0 .64-.23a1 1 0 0 0 .13-1.41L7.14 13H19a1 1 0 0 0 0-2"/></svg>
                Back
              </button>
              <div>
                <h2 className="text-xl font-bold mb-1">Amount</h2>
                <p className="text-xs opacity-40">Available: {fmtMax(maxSendable)} {activeToken.meta.symbol}{activeToken.meta.symbol === 'SOL' ? ' (after fee)' : ''}</p>
              </div>
              <div>
                <p className="text-[10px] opacity-40 mb-2">Token</p>
                <TokenPicker tokens={ownedBalances} selected={activeToken} onSelect={t => { setSelectedToken(t); setAmount(''); setError('') }} />
              </div>
              <Input
                label={`Amount (${activeToken.meta.symbol})`}
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={e => { setAmount(e.target.value); setError('') }}
                error={error}
                onKeyDown={e => e.key === 'Enter' && goConfirm()}
                rightElement={
                  <button onClick={() => setAmount(String(maxSendable))} className="text-[10px] text-primary font-medium">MAX</button>
                }
              />
              <Button fullWidth onClick={goConfirm}>Review</Button>
            </motion.div>
          )}

          {step === 'confirm' && activeToken && (
            <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4 mt-4">
              <button onClick={() => setStep('amount')} className="text-sm opacity-50 self-start flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M19 11H7.14l3.63-4.36a1 1 0 1 0-1.54-1.28l-5 6a1.09 1.09 0 0 0-.09.15c0 .05-.05.08-.07.13A1 1 0 0 0 4 12a1 1 0 0 0 .07.36c0 .05 0 .08.07.13a1 1 0 0 0 .09.15l5 6A1 1 0 0 0 10 19a1 1 0 0 0 .64-.23a1 1 0 0 0 .13-1.41L7.14 13H19a1 1 0 0 0 0-2"/></svg>
                Back
              </button>
              <h2 className="text-xl font-bold mb-1">Confirm Send</h2>
              <div className="card-bg rounded-3xl p-5 flex flex-col gap-3">
                <Row label="Token" value={activeToken.meta.symbol} />
                <Row label="Amount" value={`${amount} ${activeToken.meta.symbol}`} />
                <Row label="To" value={`${recipient.slice(0, 8)}...${recipient.slice(-8)}`} />
              </div>
              {anomalyWarning && (
                <div className="rounded-2xl bg-yellow-500/10 border border-yellow-500/30 px-3 py-2">
                  <p className="text-xs text-yellow-400">{anomalyWarning}</p>
                </div>
              )}
              {error && <p className="text-xs text-red-400">{error}</p>}
              <Button fullWidth isLoading={isLoading} onClick={handleSend}>Send Now</Button>
            </motion.div>
          )}

          {step === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5 mt-10">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h2 className="text-xl font-bold">Sent!</h2>
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
