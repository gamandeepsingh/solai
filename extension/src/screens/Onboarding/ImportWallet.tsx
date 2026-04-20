import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { useWallet } from '../../context/WalletContext'
import { validateMnemonic } from '../../lib/wallet'
import FadeIn from '../../components/animations/FadeIn'

export default function ImportWallet() {
  const navigate = useNavigate()
  const { importWallet } = useWallet()
  const [mnemonic, setMnemonic] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleImport() {
    const phrase = mnemonic.trim().toLowerCase()
    if (!validateMnemonic(phrase)) return setError('Invalid seed phrase')
    if (password.length < 8) return setError('Password must be at least 8 characters')
    if (password !== confirm) return setError('Passwords do not match')
    setIsLoading(true)
    setError('')
    try {
      await importWallet(phrase, password)
      navigate('/home')
    } catch {
      setError('Failed to import wallet')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col justify-center px-5 bg-[var(--color-bg)]">
      <FadeIn>
        <button onClick={() => navigate('/')} className="text-sm opacity-50 mb-6">← Back</button>
        <h2 className="text-xl font-bold mb-1">Import Wallet</h2>
        <p className="text-xs opacity-50 mb-5">Enter your 12-word secret phrase</p>
        <div className="flex flex-col gap-3 mb-2">
          <div>
            <label className="block text-xs font-medium opacity-60 mb-1.5">Secret Phrase</label>
            <textarea
              placeholder="word1 word2 word3 ..."
              value={mnemonic}
              onChange={e => { setMnemonic(e.target.value); setError('') }}
              className="w-full rounded-2xl px-4 py-3 text-sm bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text)]/30 outline-none focus:border-primary/60 transition-colors resize-none h-20"
            />
          </div>
          <Input
            label="New Password"
            type="password"
            placeholder="Min 8 characters"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleImport()}
          />
          <Input
            label="Confirm Password"
            type="password"
            placeholder="Repeat password"
            value={confirm}
            onChange={e => { setConfirm(e.target.value); setError('') }}
            error={error}
            onKeyDown={e => e.key === 'Enter' && handleImport()}
          />
        </div>
        <Button fullWidth isLoading={isLoading} onClick={handleImport} className="mt-3">
          Import Wallet
        </Button>
      </FadeIn>
    </div>
  )
}
