import { useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import Header from '../../components/layout/Header'
import BottomNav from '../../components/layout/BottomNav'
import BlobBackground from './BlobBackground'
import BalanceCard from './BalanceCard'
import TokenList from './TokenList'
import ActionButtons from './ActionButtons'
import FloatingParticles from '../../components/animations/FloatingParticle'
import { useBalance } from '../../hooks/useBalance'

const AI_PLACEHOLDERS = [
  'swap 0.5 SOL → USDC',
  'send 1 SOL to mom',
  'save contact Alice',
  'buy SOL if price drops 10%',
  'show my balance',
]

export default function HomeScreen() {
  const { balances, isLoading } = useBalance()
  const navigate = useNavigate()
  const [aiInput, setAiInput] = useState('')
  const [phIdx, setPhIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setPhIdx(i => (i + 1) % AI_PLACEHOLDERS.length), 3000)
    return () => clearInterval(id)
  }, [])

  function handleAiSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!aiInput.trim()) return
    navigate('/ai', { state: { initialMessage: aiInput } })
    setAiInput('')
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)] relative overflow-hidden">
      <FloatingParticles count={6} />
      <BlobBackground />
      <div className="relative z-10 flex flex-col h-full">
        <Header />
        <div className="flex-1 flex flex-col gap-4 overflow-hidden pb-16">
          <BalanceCard balances={balances} isLoading={isLoading} />
          <ActionButtons />
          <div className="flex-1 overflow-y-auto px-0">
            <TokenList balances={balances} />
          </div>
        </div>
        <div className="absolute bottom-16 left-0 right-0 px-4 pb-2 z-20">
          <form onSubmit={handleAiSubmit}>
            <motion.div whileFocus={{ scale: 1.01 }} className="relative">
              <input
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                placeholder={AI_PLACEHOLDERS[phIdx]}
                className="w-full rounded-2xl pl-4 pr-12 py-3 text-sm bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text)]/30 outline-none focus:border-primary/60 transition-colors shadow-lg"
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-primary flex items-center justify-center disabled:opacity-30"
                disabled={!aiInput.trim()}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </motion.div>
          </form>
        </div>
        <BottomNav />
      </div>
    </div>
  )
}
