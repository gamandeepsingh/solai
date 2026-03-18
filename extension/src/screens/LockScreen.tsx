import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { useWallet } from '../context/WalletContext'
import BlobShape from '../components/animations/BlobShape'

export default function LockScreen() {
  const { unlock, account } = useWallet()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleUnlock() {
    if (!password) return
    setIsLoading(true)
    setError('')
    try {
      await unlock(password)
      navigate('/home')
    } catch {
      setError('Incorrect password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center px-6 bg-[var(--color-bg)] relative overflow-hidden">
      <div className="absolute opacity-10">
        <BlobShape size={400} />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-[280px] flex flex-col items-center gap-5"
      >
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ABFF7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="font-bold text-lg">{account?.name ?? 'SOLAI'}</h2>
          <p className="text-xs opacity-40 mt-0.5">Enter password to unlock</p>
        </div>
        <div className="w-full">
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            error={error}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
          />
        </div>
        <Button fullWidth isLoading={isLoading} onClick={handleUnlock}>
          Unlock
        </Button>
      </motion.div>
    </div>
  )
}
