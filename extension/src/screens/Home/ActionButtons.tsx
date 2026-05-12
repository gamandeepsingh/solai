import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { track } from '../../lib/analytics'

function ActionBtn({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 bg-primary text-black rounded-2xl px-5 py-3 font-medium text-xs"
    >
      <span className="opacity-70">{icon}</span>
      {label}
    </motion.button>
  )
}

export default function ActionButtons() {
  const navigate = useNavigate()

  return (
    <div className="grid grid-cols-4 gap-2.5 px-4">
      <ActionBtn label="Send" onClick={() => { track('action_button_click', { action: 'send' }); navigate('/send') }} icon={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      } />
      <ActionBtn label="Receive" onClick={() => { track('action_button_click', { action: 'receive' }); navigate('/receive') }} icon={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="8 17 12 21 16 17" />
          <line x1="12" y1="12" x2="12" y2="21" />
          <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
        </svg>
      } />
      <ActionBtn label="Swap" onClick={() => { track('action_button_click', { action: 'swap' }); navigate('/swap') }} icon={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      } />
      <ActionBtn label="NFTs" onClick={() => { track('action_button_click', { action: 'nfts' }); navigate('/nfts') }} icon={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      } />
    </div>
  )
}
