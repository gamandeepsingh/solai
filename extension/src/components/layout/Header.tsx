import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useWallet } from '../../context/WalletContext'

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
      {publicKey?.[0]?.toUpperCase() ?? 'S'}
    </div>
  )
}

export default function Header() {
  const { account, network } = useWallet()
  const navigate = useNavigate()

  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-2">
      <div className="flex items-center gap-2.5">
        {account && <WalletAvatar publicKey={account.publicKey} />}
        <div>
          <p className="text-sm font-semibold leading-tight">{account?.name ?? 'SOLAI'}</p>
          <p className="text-[10px] opacity-40">{account ? truncate(account.publicKey) : 'Solana'}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] px-2 py-0.5 rounded-full border border-primary/30 text-primary/80 font-medium capitalize">
          {network}
        </span>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/settings')}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.07 4.93l-1.41 1.41M5.34 18.66l-1.41 1.41M21 12h-2M5 12H3M18.66 18.66l-1.41-1.41M6.75 6.75L5.34 5.34M12 21v-2M12 5V3" />
          </svg>
        </motion.button>
      </div>
    </div>
  )
}
