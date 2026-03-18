import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

function ActionBtn({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05, boxShadow: '0 0 16px rgba(171,255,122,0.4)' }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 bg-primary text-black rounded-2xl px-5 py-3 font-medium text-xs"
    >
      {icon}
      {label}
    </motion.button>
  )
}

export default function ActionButtons() {
  const navigate = useNavigate()

  return (
    <div className="flex justify-center gap-3 px-4">
      <ActionBtn label="Send" onClick={() => navigate('/send')} icon={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      } />
      <ActionBtn label="Receive" onClick={() => navigate('/receive')} icon={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="8 17 12 21 16 17" />
          <line x1="12" y1="12" x2="12" y2="21" />
          <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
        </svg>
      } />
      <ActionBtn label="Swap" onClick={() => {}} icon={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      } />
    </div>
  )
}
