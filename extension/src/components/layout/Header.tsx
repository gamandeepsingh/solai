import { useState } from 'react'
import { motion } from 'framer-motion'
import { useWallet } from '../../context/WalletContext'
import { useTheme } from '../../context/ThemeContext'
import { useToast } from '../ui/Toast'
import WalletSwitcher from '../wallet/WalletSwitcher'
import { useNavigate } from 'react-router-dom'

function truncate(s: string) {
  return s ? `${s.slice(0, 4)}...${s.slice(-4)}` : ''
}

function WalletAvatar({ publicKey }: { publicKey: string }) {
  const hue = publicKey ? (publicKey.charCodeAt(0) * 13 + publicKey.charCodeAt(1) * 7) % 360 : 120
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black"
      style={{ background: `hsl(${hue}, 80%, 65%)` }}
    >
      <img src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${publicKey}`} alt="Wallet" className="w-full h-full rounded-full" />
    </div>
  )
}

export default function Header() {
  const { account, network } = useWallet()
  const { theme, toggle } = useTheme()
  const { toast } = useToast()
  const [showSwitcher, setShowSwitcher] = useState(false)
  const navigate = useNavigate();

  function copyAddress() {
    if (!account) return
    navigator.clipboard.writeText(account.publicKey)
    toast('Address copied!', 'success')
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowSwitcher(true)}
          className="flex items-center gap-2.5 rounded-2xl hover:bg-white/5 pr-1 py-0.5 transition-colors"
        >
          {account && <WalletAvatar publicKey={account.publicKey} />}
          <div className="text-left">
            <div className="flex items-center gap-1">
              <p className="text-sm font-semibold leading-tight">{account?.name ?? 'SOLAI'}</p>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            <div className="flex items-center gap-1">
              <p className="text-[10px] opacity-40">{account ? truncate(account.publicKey) : 'Solana'}</p>
              {account && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={e => { e.stopPropagation(); copyAddress() }}
                  className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                  title="Copy address"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </motion.button>
              )}
            </div>
          </div>
        </motion.button>

        <div className="flex items-center gap-1">
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-primary/30 text-primary/80 font-medium capitalize">
            {network}
          </span>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggle}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("/settings")}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            title="Settings"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
              <circle cx="8" cy="6" r="2" fill="currentColor" stroke="currentColor" strokeWidth="0" />
              <circle cx="16" cy="12" r="2" fill="currentColor" stroke="currentColor" strokeWidth="0" />
              <circle cx="8" cy="18" r="2" fill="currentColor" stroke="currentColor" strokeWidth="0" />
            </svg>
          </motion.button>
        </div>
      </div>

      {showSwitcher && <WalletSwitcher onClose={() => setShowSwitcher(false)} />}
    </>
  )
}
