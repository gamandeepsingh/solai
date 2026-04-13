import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { useWallet } from '../context/WalletContext'
import BlobShape from '../components/animations/BlobShape'
import { getLocal, setLocal } from '../lib/storage'

const MAX_ATTEMPTS = 10
const LOCKOUT_DURATION_MS = 5 * 60 * 1000

function CuteCreature({ isTyping }: { isTyping: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative flex items-center justify-center"
    >
      <div className="absolute w-32 h-32 bg-primary/10 blur-xl rounded-full" />

      <motion.div
        className="relative w-32 h-32"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <img src="/icons/octopus.png" alt="" className="w-full h-full object-contain" />

        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 128 128" fill="none">
          <defs>
            {/* clip each eyelid rect to its eye circle so the closing edge curves naturally */}
            <clipPath id="clipEyeL">
              <circle cx="46" cy="54" r="9" />
            </clipPath>
            <clipPath id="clipEyeR">
              <circle cx="76" cy="54" r="9" />
            </clipPath>
          </defs>

          {/* LEFT EYE */}
          <circle cx="46" cy="54" r="9" fill="#fff" />
          <circle cx="46" cy="52" r="4.5" fill="#111" />
          <circle cx="44" cy="49.5" r="1.8" fill="#fff" opacity="0.9" />
          {/* eyelid: rect grows down from top, clipped by circle → curved bottom edge */}
          <motion.rect
            x="37" y="45" width="18"
            fill="#ABFF7A"
            clipPath="url(#clipEyeL)"
            initial={{ height: 0 }}
            animate={{ height: isTyping ? 11 : 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          />

          {/* RIGHT EYE */}
          <circle cx="76" cy="54" r="9" fill="#fff" />
          <circle cx="76" cy="52" r="4.5" fill="#111" />
          <circle cx="74" cy="49.5" r="1.8" fill="#fff" opacity="0.9" />
          <motion.rect
            x="67" y="45" width="18"
            fill="#ABFF7A"
            clipPath="url(#clipEyeR)"
            initial={{ height: 0 }}
            animate={{ height: isTyping ? 11 : 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          />

          {/* MOUTH — smile at rest, cool neutral flat when focused/typing */}
          <motion.path
            d={isTyping
              ? 'M 50 69 Q 61 69 72 69'
              : 'M 50 68 Q 61 76 72 68'
            }
            stroke="#333"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          />
        </svg>
      </motion.div>
    </motion.div>
  )
}

export default function LockScreen({ signMode }: { signMode?: boolean }) {
  const { unlock, changePasswordFromMnemonic, account } = useWallet()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [mnemonic, setMnemonic] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0)

  const isLocked = lockoutSecondsLeft > 0
  const isTyping = password.length > 0

  useEffect(() => {
    getLocal('lockoutUntil').then(until => {
      if (until && until > Date.now()) {
        setLockoutSecondsLeft(Math.ceil((until - Date.now()) / 1000))
      }
    })
  }, [])

  useEffect(() => {
    if (!isLocked) return
    const id = setInterval(() => {
      setLockoutSecondsLeft(s => {
        if (s <= 1) { clearInterval(id); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [isLocked])

  async function handleUnlock() {
    if (!password || isLocked) return
    setIsLoading(true)
    setError('')
    try {
      await unlock(password)
      await setLocal('failedLoginAttempts', 0)
      await setLocal('lockoutUntil', 0)
      if (!signMode) navigate('/home')
    } catch {
      const prev = (await getLocal('failedLoginAttempts')) ?? 0
      const next = prev + 1
      await setLocal('failedLoginAttempts', next)
      if (next >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_DURATION_MS
        await setLocal('lockoutUntil', until)
        setLockoutSecondsLeft(Math.ceil(LOCKOUT_DURATION_MS / 1000))
        setError('')
      } else {
        setError(`Incorrect password (${next}/${MAX_ATTEMPTS} attempts)`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleReset() {
    setForgotError('')
    if (!mnemonic.trim()) return setForgotError('Enter your recovery phrase')
    if (newPassword.length < 8) return setForgotError('Password must be at least 8 characters')
    if (newPassword !== confirmPassword) return setForgotError('Passwords do not match')
    setIsLoading(true)
    try {
      const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ')
      await changePasswordFromMnemonic(normalized, newPassword)
      navigate('/home')
    } catch (e: any) {
      setForgotError(e.message ?? 'Recovery failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center px-6 bg-[var(--color-bg)] relative overflow-hidden">
      <div className="absolute opacity-5">
        <BlobShape size={320} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-[280px] flex flex-col items-center gap-4"
      >
        {!showForgot ? (
          <>
            <CuteCreature isTyping={isTyping} />

            <div className="text-center">
              <h2 className="font-semibold text-lg tracking-tight">
                {account?.name ?? 'SOLAI'}
              </h2>
              <p className="text-xs opacity-40 mt-1">{signMode ? 'Unlock to complete the request' : 'Enter password to unlock'}</p>
            </div>

            {isLocked ? (
              <div className="w-full rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-center">
                <p className="text-xs text-red-400 font-medium">Too many failed attempts</p>
                <p className="text-xs text-red-400/70 mt-1">
                  Try again in {Math.floor(lockoutSecondsLeft / 60)}:{String(lockoutSecondsLeft % 60).padStart(2, '0')}
                </p>
              </div>
            ) : (
              <div className="w-full">
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  error={error}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                />
              </div>
            )}

            <Button fullWidth isLoading={isLoading} onClick={handleUnlock} disabled={isLocked}>
              Unlock
            </Button>

            <button
              onClick={() => setShowForgot(true)}
              className="text-xs opacity-40 hover:opacity-70 transition-opacity"
            >
              Forgot password?
            </button>
          </>
        ) : (
          <>
            <div className="text-center">
              <h2 className="font-semibold text-lg tracking-tight">Reset Password</h2>
              <p className="text-xs opacity-40 mt-1">Enter your recovery phrase to set a new password</p>
            </div>

            <div className="w-full flex flex-col gap-3">
              <textarea
                value={mnemonic}
                onChange={e => { setMnemonic(e.target.value); setForgotError('') }}
                placeholder="Enter your 12-word recovery phrase..."
                rows={3}
                className="w-full rounded-2xl px-4 py-3 text-sm bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text)]/30 outline-none focus:border-primary/60 transition-colors resize-none"
              />
              <Input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setForgotError('') }}
              />
              <Input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setForgotError('') }}
                error={forgotError}
              />
            </div>

            <Button fullWidth isLoading={isLoading} onClick={handleReset}>
              Reset Password
            </Button>

            <button
              onClick={() => { setShowForgot(false); setMnemonic(''); setNewPassword(''); setConfirmPassword(''); setForgotError('') }}
              className="text-xs opacity-40 hover:opacity-70 transition-opacity"
            >
              Back to unlock
            </button>
          </>
        )}
      </motion.div>
    </div>
  )
}