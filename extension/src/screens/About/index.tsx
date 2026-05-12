import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import BottomNav from '../../components/layout/BottomNav'

const version = chrome.runtime.getManifest().version

function LinkRow({ label, url, icon }: { label: string; url: string; icon: React.ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={() => chrome.tabs.create({ url })}
      className="flex items-center justify-between w-full px-4 py-3.5 card-bg rounded-2xl border border-[var(--color-border)] hover:border-primary/30 transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="opacity-60">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
    </motion.button>
  )
}

export default function AboutScreen() {
  const navigate = useNavigate()

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="w-8 h-8 rounded-full flex items-center justify-center border border-[var(--color-border)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </motion.button>
        <h2 className="text-lg font-bold">About</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-20">
        <div className="flex flex-col items-center gap-2 py-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center">
            <img src="/icons/icon32.png" alt="SOLAI" className="w-full h-full object-contain" />
          </div>
          <p className="text-xl font-bold">SOLAI</p>
          <p className="text-xs opacity-40">Version {version}</p>
          <p className="text-xs opacity-50 text-center mt-1 max-w-[220px]">
            An agentic Solana wallet powered by AI. Send, swap, and manage assets with natural language.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <LinkRow
            label="Terms & Conditions"
            url="https://solai.gamandeep.xyz/term-condition"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
            }
          />
          <LinkRow
            label="Privacy Policy"
            url="https://solai.gamandeep.xyz/privacy"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            }
          />
        </div>

        <p className="text-center text-[10px] opacity-30 mt-8">
          © {new Date().getFullYear()} SOLAI. All rights reserved.
        </p>
      </div>
      <BottomNav />
    </div>
  )
}
