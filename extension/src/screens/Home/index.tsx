import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Header from '../../components/layout/Header'
import BottomNav from '../../components/layout/BottomNav'
import BalanceCard from './BalanceCard'
import TokenList from './TokenList'
import ActionButtons from './ActionButtons'
import AgentsSummaryCard from './AgentsSummaryCard'
import { useBalance } from '../../hooks/useBalance'
import { useWallet } from '../../context/WalletContext'

type Tab = 'tokens' | 'nfts' | 'activity' | 'explore'

function PrivacyCard({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col gap-1.5 action-btn-bg rounded-2xl p-3 text-left"
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${count > 0 ? 'bg-[#ABFF7A]' : 'bg-[var(--color-border)]'}`} />
        <p className="text-[11px] font-semibold">{count > 0 ? 'Privacy on' : 'Privacy off'}</p>
      </div>
      <p className="text-[10px] opacity-40">
        {count > 0 ? `${count} stealth address${count !== 1 ? 'es' : ''}` : 'Tap to set up →'}
      </p>
    </motion.button>
  )
}

export default function HomeScreen() {
  const { ownedBalances, allTokenBalances, isLoading } = useBalance()
  const { stealthAddresses, activeId } = useWallet()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('tokens')

  const myStealthCount = stealthAddresses.filter(s => s.walletId === activeId).length

  function handleTabClick(t: Tab) {
    if (t === 'nfts') { navigate('/nfts'); return }
    if (t === 'activity') { navigate('/history'); return }
    if (t === 'explore') { navigate('/explore'); return }
    setTab(t)
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      <Header />

      <div className="flex-1 flex flex-col overflow-hidden pb-16">
        {/* Balance */}
        <BalanceCard balances={ownedBalances} isLoading={isLoading} />

        {/* Action buttons */}
        <ActionButtons />

        {/* Stats row: Privacy + Agents */}
        <div className="grid grid-cols-2 gap-2.5 px-4 mt-3">
          <PrivacyCard
            count={myStealthCount}
            onClick={() => navigate('/receive', { state: { tab: 'privacy' } })}
          />
          <AgentsSummaryCard onClick={() => navigate('/agent-wallets')} />
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-4 mt-4 mb-1">
          {(['tokens', 'nfts', 'activity', 'explore'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => handleTabClick(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${
                tab === t
                  ? 'bg-[var(--color-card)] border border-[var(--color-border)]'
                  : 'opacity-35 hover:opacity-60'
              }`}
            >
              {t === 'tokens' ? 'Tokens' : t === 'nfts' ? 'NFTs' : t === 'activity' ? 'Activity' : 'Explore'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {tab === 'tokens' && (
            <motion.div
              key="tokens"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 overflow-y-auto"
            >
              <TokenList ownedBalances={ownedBalances} allTokenBalances={allTokenBalances} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav />
    </div>
  )
}
