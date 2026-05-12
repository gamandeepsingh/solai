import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const CHANGELOG: Record<string, { title: string; items: string[] }> = {
  '1.0.9': {
    title: "What's new in 1.0.9",
    items: [
      'Agent wallets now support SPL token payments (USDC, USDT) with per-token budgets',
      'Token allowances — grant dApps a spending limit without repeated confirmations',
      'Auto-refill: agents top up automatically from your main wallet when balance is low',
      'Agent templates: DCA Bot, Gaming, Subscription, Tip Jar, Gas Wallet presets',
      'Per-agent spend analytics with 7-day chart and top recipients',
      'Privacy addresses — receive funds at unlinkable one-time addresses',
      'Send to a contact\'s privacy address with one toggle',
      'Agents tab in bottom nav for quick access',
    ],
  },
  '1.0.7': {
    title: "What's new in 1.0.7",
    items: [
      'Ledger hardware wallet support — connect via USB',
      'Agent wallets with programmable guardrails (daily budget, per-tx limits, origin allowlist, cooldown, kill-switch)',
      'Stealth addresses — HD-derived one-time receive addresses',
      'Push notifications for received SOL & tokens',
      'Batch Send — send to multiple addresses at once',
      'Transaction history now shows all time, grouped by month',
      'Cmd+K command palette for quick navigation',
      'QR scanner in Send screen',
      'Devnet faucet one-click (Receive screen)',
      'Transaction drafts — resume interrupted sends',
      '24 security hardening fixes',
    ],
  },
}

const SEEN_VERSION_KEY = '_clv'

function BulletIcon() {
  return (
    <svg width="6" height="6" viewBox="0 0 6 6" fill="currentColor" className="text-primary shrink-0 mt-1.5">
      <circle cx="3" cy="3" r="3"/>
    </svg>
  )
}

export default function ChangelogModal() {
  const [open, setOpen] = useState(false)
  const version = chrome.runtime.getManifest().version

  useEffect(() => {
    chrome.storage.sync.get(SEEN_VERSION_KEY).then((stored: any) => {
      if (stored[SEEN_VERSION_KEY] !== version && CHANGELOG[version]) {
        setOpen(true)
      }
    })
  }, [])

  function dismiss() {
    chrome.storage.sync.set({ [SEEN_VERSION_KEY]: version })
    setOpen(false)
  }

  const entry = CHANGELOG[version]
  if (!entry) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 flex items-end z-50"
          onClick={dismiss}
        >
          <motion.div
            initial={{ y: 80 }}
            animate={{ y: 0 }}
            exit={{ y: 80 }}
            className="w-full bg-[var(--color-card)] rounded-t-3xl p-5 flex flex-col gap-3 max-h-[80%] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">{entry.title}</p>
              <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold">v{version}</span>
            </div>

            <div className="flex flex-col gap-2">
              {entry.items.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <BulletIcon />
                  <p className="text-xs opacity-70 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>

            <button
              onClick={dismiss}
              className="w-full py-3 rounded-2xl bg-primary text-black text-sm font-semibold mt-1"
            >
              Got it
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
