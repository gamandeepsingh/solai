import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { generateMnemonic } from '../../lib/wallet'
import FadeIn from '../../components/animations/FadeIn'

export default function CreateWallet() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [step, setStep] = useState<'password' | 'mnemonic'>('password')
  const [error, setError] = useState('')

  function handleGenerate() {
    if (password.length < 8) return setError('Password must be at least 8 characters')
    if (password !== confirm) return setError('Passwords do not match')
    setError('')
    setMnemonic(generateMnemonic())
    setStep('mnemonic')
  }

  if (step === 'mnemonic') {
    const words = mnemonic.split(' ')
    return (
      <div className="h-full flex flex-col px-5 pt-5 pb-4 bg-[var(--color-bg)]">
        <FadeIn>
          <button onClick={() => setStep('password')} className="text-sm opacity-50 mb-4">← Back</button>
          <h2 className="text-xl font-bold mb-1">Secret Phrase</h2>
          <p className="text-xs opacity-50 mb-4">Write these 12 words down safely. Never share them.</p>
          <div className="grid grid-cols-3 gap-2 mb-5">
            {words.map((word, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl px-2.5 py-2">
                <span className="text-[9px] opacity-30 w-4">{i + 1}.</span>
                <span className="text-xs font-medium">{word}</span>
              </div>
            ))}
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-3 mb-4">
            <p className="text-xs text-yellow-400">⚠️ Never enter this phrase on any website. SOLAI will never ask for it.</p>
          </div>
          <Button
            fullWidth
            onClick={() => navigate('/confirm', { state: { mnemonic, password } })}
          >
            I've Written It Down
          </Button>
        </FadeIn>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col justify-center px-5 bg-[var(--color-bg)]">
      <FadeIn>
        <button onClick={() => navigate('/')} className="text-sm opacity-50 mb-6">← Back</button>
        <h2 className="text-xl font-bold mb-1">Create Wallet</h2>
        <p className="text-xs opacity-50 mb-6">Set a strong password to protect your wallet</p>
        <div className="flex flex-col gap-3 mb-2">
          <Input
            label="Password"
            type="password"
            placeholder="Min 8 characters"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
          />
          <Input
            label="Confirm Password"
            type="password"
            placeholder="Repeat password"
            value={confirm}
            onChange={e => { setConfirm(e.target.value); setError('') }}
            error={error}
          />
        </div>
        {password.length > 0 && (
          <div className="flex gap-1 mb-4">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${password.length >= n * 3 ? 'bg-primary' : 'bg-[var(--color-border)]'}`} />
            ))}
          </div>
        )}
        <Button fullWidth onClick={handleGenerate}>
          Generate Seed Phrase
        </Button>
      </FadeIn>
    </div>
  )
}
