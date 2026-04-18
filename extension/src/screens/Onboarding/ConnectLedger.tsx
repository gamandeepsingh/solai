import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useWallet } from '../../context/WalletContext'
import FadeIn from '../../components/animations/FadeIn'

export default function ConnectLedger() {
  const navigate = useNavigate()
  const { addLedgerWallet } = useWallet()
  const [name, setName] = useState('Ledger 1')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleConnect() {
    setError('')
    setIsLoading(true)
    try {
      await addLedgerWallet(name.trim() || 'Ledger 1')
      navigate('/home')
    } catch (e: any) {
      const msg = e?.message ?? 'Connection failed'
      if (msg.includes('No device')) {
        setError('No Ledger device found. Make sure it is plugged in and the Solana app is open.')
      } else if (msg.includes('Access denied') || msg.includes('user gesture')) {
        setError('Access denied. Try clicking "Connect Ledger" again.')
      } else {
        setError(msg)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto px-5 pt-4 pb-8 bg-[var(--color-bg)]">
      <FadeIn>
        <button onClick={() => navigate('/')} className="text-sm opacity-50 mb-6">← Back</button>

        <div className="flex flex-col items-center gap-6">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="relative"
          >
            <div className="absolute inset-0 bg-primary/10 blur-xl rounded-full" />
            <div className="relative w-20 h-20 bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                <line x1="12" y1="18" x2="12.01" y2="18"/>
              </svg>
            </div>
          </motion.div>

          <div className="text-center">
            <h2 className="text-xl font-bold mb-1">Connect Ledger</h2>
            <p className="text-xs opacity-50 max-w-[240px]">
              Use your Ledger hardware wallet for maximum security. Your private key never leaves the device.
            </p>
          </div>

          <div className="w-full card-bg rounded-3xl p-4 flex flex-col gap-3">
            <p className="text-xs font-semibold opacity-60 uppercase tracking-widest">Before connecting</p>
            {[
              'Plug in your Ledger device via USB',
              'Unlock it with your PIN',
              'Open the Solana app on the device',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-sm opacity-70">{step}</p>
              </div>
            ))}
          </div>

          <div className="w-full flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs opacity-50">Wallet name</span>
              <input
                className="rounded-xl px-3 py-2.5 text-sm bg-[var(--color-card)] border border-[var(--color-border)] outline-none focus:border-primary/60"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleConnect()}
                placeholder="Ledger 1"
              />
            </label>
          </div>

          <div className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl px-4 py-3 flex items-start gap-2.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0 mt-0.5">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
            </svg>
            <p className="text-[10px] opacity-50 leading-relaxed">
              No password needed — your Ledger device's own PIN protects the private key. Every transaction still requires physical confirmation on the device.
            </p>
          </div>

          {error && (
            <div className="w-full bg-red-500/10 border border-red-500/20 rounded-2xl p-3">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={isLoading}
            className="w-full py-3.5 rounded-2xl bg-primary text-black text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                  <line x1="12" y1="18" x2="12.01" y2="18"/>
                </svg>
                Connect Ledger
              </>
            )}
          </button>
        </div>
      </FadeIn>
    </div>
  )
}
