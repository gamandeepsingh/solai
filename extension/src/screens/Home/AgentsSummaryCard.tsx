import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getSolBalance } from '../../lib/solana'
import { getLocal } from '../../lib/storage'
import { useWallet } from '../../context/WalletContext'
import type { AgentWallet } from '../../types/agent'

interface Props {
  onClick: () => void
}

export default function AgentsSummaryCard({ onClick }: Props) {
  const { network, activeId } = useWallet()
  const [agents, setAgents] = useState<AgentWallet[]>([])
  const [totalBalance, setTotalBalance] = useState<number | null>(null)

  useEffect(() => {
    getLocal('agentWallets').then(async list => {
      const loaded: AgentWallet[] = (list ?? []).filter((a: AgentWallet) => a.walletId === activeId)
      setAgents(loaded)
      if (loaded.length > 0) {
        const bals = await Promise.all(
          loaded.map(a => getSolBalance(a.publicKey, network).catch(() => 0))
        )
        setTotalBalance(bals.reduce((s, b) => s + b, 0))
      } else {
        setTotalBalance(0)
      }
    })
  }, [network, activeId])

  const active = agents.filter(a => a.enabled)

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col gap-1.5 action-btn-bg rounded-2xl p-3 text-left"
    >
      <div className="flex items-center gap-1.5">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 shrink-0">
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1" fill="currentColor"/>
        </svg>
        <p className="text-[11px] font-semibold">
          {agents.length === 0 ? 'No agents' : `${active.length} agent${active.length !== 1 ? 's' : ''}`}
        </p>
      </div>
      <p className="text-[10px] opacity-40">
        {agents.length === 0
          ? 'Tap to set up →'
          : totalBalance !== null
            ? `${totalBalance.toFixed(4)} SOL held`
            : '—'
        }
      </p>
    </motion.button>
  )
}
