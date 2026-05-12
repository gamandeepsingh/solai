import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Header from '../../components/layout/Header'
import BottomNav from '../../components/layout/BottomNav'
import { getLocal, setLocal } from '../../lib/storage'

type ConnectedApp = { origin: string; connectedAt: string }

export default function ConnectedAppsScreen() {
  const [apps, setApps] = useState<ConnectedApp[]>([])

  useEffect(() => {
    getLocal('approvedOrigins').then(origins => setApps(origins ?? []))
  }, [])

  async function revoke(origin: string) {
    const updated = apps.filter(a => a.origin !== origin)
    await setLocal('approvedOrigins', updated)
    setApps(updated)
  }

  async function revokeAll() {
    await setLocal('approvedOrigins', [])
    setApps([])
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      <Header />
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        <div className="flex items-center justify-between py-3">
          <h2 className="text-lg font-bold">Connected Apps</h2>
          {apps.length > 0 && (
            <button
              onClick={revokeAll}
              className="text-[11px] text-red-400 opacity-70 hover:opacity-100 transition-opacity"
            >
              Revoke all
            </button>
          )}
        </div>

        {apps.length === 0 ? (
          <div className="flex flex-col items-center gap-3 mt-16 opacity-40">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            <p className="text-sm">No dApps connected yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {apps.map((app, i) => {
              const hostname = (() => { try { return new URL(app.origin).hostname } catch { return app.origin } })()
              const since = new Date(app.connectedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
              return (
                <motion.div
                  key={app.origin}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="card-bg rounded-2xl p-3.5 flex items-center gap-3"
                >
                  <img
                    src={`${app.origin}/favicon.ico`}
                    alt=""
                    className="w-8 h-8 rounded-lg shrink-0 bg-white/5"
                    onError={e => {
                      const t = e.target as HTMLImageElement
                      t.style.display = 'none'
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{hostname}</p>
                    <p className="text-[10px] opacity-40">Connected {since}</p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => revoke(app.origin)}
                    className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Revoke
                  </motion.button>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
