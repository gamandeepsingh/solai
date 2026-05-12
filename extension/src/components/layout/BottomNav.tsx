import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { track } from '../../lib/analytics'

const NAV_ITEMS = [
  { path: '/home', label: 'Home', icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </svg>
  )},
  { path: '/contacts', label: 'Contacts', icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )},
  { path: '/ai', label: 'AI', icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )},
  { path: '/agent-wallets', label: 'Agents', icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1" fill="currentColor"/>
    </svg>
  )},
  { path: '/history', label: 'History', icon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )},
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="absolute bottom-0 left-0 right-0 h-16 card-bg border-t border-[var(--color-border)] flex items-center justify-around px-1">
      {NAV_ITEMS.map(item => {
        const active = location.pathname === item.path
        return (
          <motion.button
            key={item.path}
            whileTap={{ scale: 0.9 }}
            onClick={() => { track('nav_click', { tab: item.label.toLowerCase() }); navigate(item.path) }}
            className="flex flex-col items-center gap-0.5 w-12 py-1 rounded-2xl transition-colors"
          >
            <span className={active ? 'text-primary' : 'opacity-40'}>{item.icon}</span>
            <span className={`text-[9px] font-medium ${active ? 'text-primary' : 'opacity-40'}`}>{item.label}</span>
          </motion.button>
        )
      })}
    </div>
  )
}
