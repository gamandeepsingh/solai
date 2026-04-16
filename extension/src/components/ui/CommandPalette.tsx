import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '../../context/WalletContext'

const COMMANDS = [
  { id: 'home',           label: 'Go to Home',           path: '/home',           icon: '🏠' },
  { id: 'send',           label: 'Send',                  path: '/send',           icon: '↑' },
  { id: 'receive',        label: 'Receive',               path: '/receive',        icon: '↓' },
  { id: 'swap',           label: 'Swap',                  path: '/swap',           icon: '↔' },
  { id: 'history',        label: 'Transaction History',   path: '/history',        icon: '📋' },
  { id: 'contacts',       label: 'Contacts',              path: '/contacts',       icon: '👥' },
  { id: 'ai',             label: 'AI Chat',               path: '/ai',             icon: '🤖' },
  { id: 'nfts',           label: 'NFTs',                  path: '/nfts',           icon: '🖼' },
  { id: 'orders',         label: 'Orders',                path: '/orders',         icon: '📊' },
  { id: 'agent-wallets',  label: 'Agent Wallets',         path: '/agent-wallets',  icon: '⚙️' },
  { id: 'settings',       label: 'Settings',              path: '/settings',       icon: '⚙' },
  { id: 'batch-send',     label: 'Batch Send',            path: '/batch-send',     icon: '📤' },
  { id: 'watchlist',      label: 'Token Watchlist',       path: '/watchlist',      icon: '👁' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate()
  const { lock } = useWallet()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const results = query
    ? COMMANDS.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : COMMANDS

  useEffect(() => { setSelected(0) }, [query])

  function execute(cmd: typeof COMMANDS[number]) {
    navigate(cmd.path)
    onClose()
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) execute(results[selected])
    if (e.key === 'Escape') onClose()
  }

  if (!open) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/60 z-50 flex flex-col pt-16"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mx-4 bg-[var(--color-card)] rounded-3xl overflow-hidden border border-[var(--color-border)] shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--color-border)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 shrink-0">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search or navigate…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-30"
          />
          <kbd className="text-[9px] opacity-30 border border-current rounded px-1 py-0.5">Esc</kbd>
        </div>

        <div className="max-h-64 overflow-y-auto py-1">
          {results.length === 0 ? (
            <p className="text-xs opacity-30 text-center py-4">No results</p>
          ) : results.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={() => execute(cmd)}
              onMouseEnter={() => setSelected(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === selected ? 'bg-primary/10' : ''}`}
            >
              <span className="text-base w-5 text-center shrink-0">{cmd.icon}</span>
              <span className={`text-sm ${i === selected ? 'text-primary font-medium' : ''}`}>{cmd.label}</span>
            </button>
          ))}

          <div className="border-t border-[var(--color-border)] mt-1 pt-1">
            <button
              onClick={() => { lock(); onClose() }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-red-500/5 text-red-400"
            >
              <span className="text-base w-5 text-center shrink-0">🔒</span>
              <span className="text-sm">Lock Wallet</span>
            </button>
          </div>
        </div>
      </motion.div>

      <p className="text-center text-[10px] text-white/30 mt-2">↑↓ navigate · Enter select · Esc close</p>
    </motion.div>
  )
}
