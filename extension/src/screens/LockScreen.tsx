import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { useWallet } from '../context/WalletContext'
import BlobShape from '../components/animations/BlobShape'

function CuteCreature({ isTyping }: { isTyping: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative flex items-center justify-center"
    >
      {/* glow */}
      <div className="absolute w-24 h-24 bg-primary/10 blur-xl rounded-full" />

      <motion.svg
        width="96"
        height="96"
        viewBox="0 0 120 120"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Body */}
        <path
          d="M60 105c-25 0-45-18-45-40s20-40 45-40 45 18 45 40-20 40-45 40z"
          fill="#ABFF7A"
        />

        {/* Leafs */}
        <path d="M40 20c0-10 10-14 16-6-6 2-8 6-8 10" fill="#8BE44E" />
        <path d="M80 20c0-10-10-14-16-6 6 2 8 6 8 10" fill="#8BE44E" />

        {/* LEFT EYE */}
        <g transform="translate(38,55)">
          {/* eyeball */}
          <circle r="12" fill="#fff" />

          {/* pupil */}
          <circle r="6" fill="#111" />

          {/* highlight */}
          <circle cx="-2" cy="-3" r="2" fill="#fff" opacity="0.9" />

          {/* eyelid */}
          <motion.rect
            x="-12"
            width="24"
            fill="#ABFF7A"
            initial={{ y: -12, height: 0 }}
            animate={{
              y: isTyping ? -2 : -12,
              height: isTyping ? 14 : 0,
            }}
            transition={{ duration: 0.25 }}
            rx="6"
          />
        </g>

        {/* RIGHT EYE */}
        <g transform="translate(82,55)">
          <circle r="12" fill="#fff" />
          <circle r="6" fill="#111" />
          <circle cx="-2" cy="-3" r="2" fill="#fff" opacity="0.9" />

          <motion.rect
            x="-12"
            width="24"
            fill="#ABFF7A"
            initial={{ y: -12, height: 0 }}
            animate={{
              y: isTyping ? -2 : -12,
              height: isTyping ? 14 : 0,
            }}
            transition={{ duration: 0.25 }}
            rx="6"
          />
        </g>
      </motion.svg>
    </motion.div>
  )
}

export default function LockScreen() {
  const { unlock, account } = useWallet()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const isTyping = password.length > 0

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
      
      {/* Very subtle background blob */}
      <div className="absolute opacity-5">
        <BlobShape size={320} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-[280px] flex flex-col items-center gap-6"
      >
        {/* Creature */}
        <CuteCreature isTyping={isTyping} />

        {/* Title */}
        <div className="text-center">
          <h2 className="font-semibold text-lg tracking-tight">
            {account?.name ?? 'SOLAI'}
          </h2>
          <p className="text-xs opacity-40 mt-1">
            Enter password to unlock
          </p>
        </div>

        {/* Input */}
        <div className="w-full">
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => {
              setPassword(e.target.value)
              setError('')
            }}
            error={error}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
          />
        </div>

        {/* Button */}
        <Button fullWidth isLoading={isLoading} onClick={handleUnlock}>
          Unlock
        </Button>
      </motion.div>
    </div>
  )
}