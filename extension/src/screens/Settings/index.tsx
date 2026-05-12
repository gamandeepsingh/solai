import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/layout/Header'
import BottomNav from '../../components/layout/BottomNav'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { useWallet } from '../../context/WalletContext'
import { useTheme } from '../../context/ThemeContext'
import { getLocal, setLocal, getSync, setSync } from '../../lib/storage'
import { getMnemonicFromKeystore } from '../../lib/wallet'
import type { Network } from '../../types/wallet'

type InnerPage = 'appearance' | 'network' | 'notifications' | 'security' | 'ai' | 'inactivity'

const PAGE_TITLES: Record<InnerPage, string> = {
  appearance: 'Appearance',
  network: 'Network',
  notifications: 'Notifications',
  security: 'Security',
  ai: 'AI Settings',
  inactivity: 'Inactivity Guard',
}

export default function SettingsScreen() {
  const navigate = useNavigate()
  const { account, network, setNetwork, lock, changePassword, resetAllWallets } = useWallet()
  const { theme, themeSetting, setThemeSetting } = useTheme()
  const [innerPage, setInnerPage] = useState<InnerPage | null>(null)

  const [apiKey, setApiKey] = useState('')
  const [savedKey, setSavedKey] = useState('')
  const [isSavingKey, setIsSavingKey] = useState(false)

  const [showSeedModal, setShowSeedModal] = useState(false)
  const [seedPassword, setSeedPassword] = useState('')
  const [seed, setSeed] = useState('')
  const [seedError, setSeedError] = useState('')

  const [showChangePw, setShowChangePw] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [changePwError, setChangePwError] = useState('')
  const [isChangingPw, setIsChangingPw] = useState(false)

  const [showResetModal, setShowResetModal] = useState(false)
  const [resetPassword, setResetPassword] = useState('')
  const [resetError, setResetError] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  const DEFAULT_INACTIVITY_DAYS = parseInt(import.meta.env.VITE_INACTIVITY_DAYS ?? '90', 10)
  const [igEnabled, setIgEnabled] = useState(false)
  const [igAddress, setIgAddress] = useState('')
  const [igDays, setIgDays] = useState(DEFAULT_INACTIVITY_DAYS)
  const [igDaysLeft, setIgDaysLeft] = useState<number | null>(null)
  const [igSaving, setIgSaving] = useState(false)
  const [igError, setIgError] = useState('')

  useEffect(() => {
    getSync('notificationsEnabled').then(v => { if (v !== undefined) setNotificationsEnabled(v) })
    getLocal('openrouterApiKey').then(k => { if (k) { setSavedKey(k); setApiKey(k) } })
    getLocal('inactivityGuard').then(g => {
      if (!g) return
      setIgEnabled(g.enabled)
      setIgAddress(g.recipientAddress ?? '')
      setIgDays(g.inactivityDays ?? DEFAULT_INACTIVITY_DAYS)
      if (g.lastActivityAt) {
        const days = Math.ceil(g.inactivityDays - (Date.now() - g.lastActivityAt) / 86_400_000)
        setIgDaysLeft(Math.max(0, days))
      }
    })
  }, [])

  async function saveApiKey() {
    setIsSavingKey(true)
    await setLocal('openrouterApiKey', apiKey)
    setSavedKey(apiKey)
    setTimeout(() => setIsSavingKey(false), 500)
  }

  async function revealSeed() {
    if (!account?.keystore) return
    try {
      const mnemonic = await getMnemonicFromKeystore(account.keystore, seedPassword)
      setSeed(mnemonic)
      setSeedError('')
    } catch {
      setSeedError('Incorrect password')
    }
  }

  async function handleChangePassword() {
    setChangePwError('')
    if (!currentPw) return setChangePwError('Enter your current password')
    if (newPw.length < 8) return setChangePwError('New password must be at least 8 characters')
    if (newPw !== confirmPw) return setChangePwError('Passwords do not match')
    setIsChangingPw(true)
    try {
      await changePassword(currentPw, newPw)
      setShowChangePw(false)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (e: any) {
      setChangePwError(e.message ?? 'Failed')
    } finally {
      setIsChangingPw(false)
    }
  }

  async function handleReset() {
    if (!resetPassword) return setResetError('Enter your password')
    setIsResetting(true)
    setResetError('')
    try {
      await resetAllWallets(resetPassword)
    } catch (e: any) {
      setResetError(e.message?.includes('Incorrect') || e.message?.includes('decrypt') ? 'Incorrect password' : (e.message ?? 'Failed'))
      setIsResetting(false)
    }
  }

  async function saveInactivityGuard(enabled: boolean) {
    setIgSaving(true)
    setIgError('')
    try {
      if (enabled && !igAddress.trim()) { setIgError('Enter a recipient address'); return }
      if (igDays < 30) { setIgError('Minimum 30 days'); return }
      const existing = await getLocal('inactivityGuard')
      await setLocal('inactivityGuard', {
        enabled,
        recipientAddress: igAddress.trim(),
        inactivityDays: igDays,
        lastActivityAt: existing?.lastActivityAt ?? Date.now(),
        lastWarnedAt: existing?.lastWarnedAt,
      })
      setIgEnabled(enabled)
      if (enabled) {
        setIgDaysLeft(igDays)
        chrome.alarms.create('inactivity-check', { periodInMinutes: 360 })
      }
    } finally {
      setIgSaving(false)
    }
  }

  async function resetInactivityTimer() {
    const existing = await getLocal('inactivityGuard')
    if (!existing) return
    await setLocal('inactivityGuard', { ...existing, lastActivityAt: Date.now(), pendingSweep: false })
    setIgDaysLeft(igDays)
  }

  async function handleExport() {
    const [contacts, stealthAddresses, agentWallets, scheduledJobs] = await Promise.all([
      getLocal('contacts'), getLocal('stealthAddresses'), getLocal('agentWallets'), getLocal('scheduledJobs'),
    ])
    const data = {
      version: chrome.runtime.getManifest().version,
      exportedAt: new Date().toISOString(),
      contacts: contacts ?? [],
      stealthAddresses: (stealthAddresses ?? []).map(({ publicKey, label, walletId, index }) => ({ publicKey, label, walletId, index })),
      agentWallets: (agentWallets ?? []).map(({ id, name, guardrails, enabled, publicKey }) => ({ id, name, guardrails, enabled, publicKey })),
      scheduledJobs: scheduledJobs ?? [],
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `solai-settings-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)] relative overflow-hidden">

      {/* Main list */}
      <AnimatePresence>
        {!innerPage && (
          <motion.div key="main"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ x: -30, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 flex flex-col"
          >
            <Header />
            <div className="flex-1 overflow-y-auto px-4 pb-20">
              <h2 className="text-lg font-bold py-3">Settings</h2>
              <div className="flex flex-col gap-2.5">

                <SettingGroup>
                  <SettingRow icon={<IcoGlobe />} label="Network"
                    badge={network === 'devnet' ? { text: 'devnet', color: 'yellow' } : { text: 'mainnet', color: 'green' }}
                    onClick={() => setInnerPage('network')} />
                  <SettingRow icon={<IcoShield />} label="Security" onClick={() => setInnerPage('security')} />
                  <SettingRow icon={<IcoClock />} label="Inactivity Guard"
                    badge={igEnabled ? { text: 'on', color: 'green' } : { text: 'off', color: 'gray' }}
                    onClick={() => setInnerPage('inactivity')} />
                </SettingGroup>

                <SettingGroup>
                  <SettingRow icon={<IcoSun />} label="Appearance"
                    value={themeSetting === 'system' ? 'Auto' : themeSetting}
                    onClick={() => setInnerPage('appearance')} />
                  <SettingRow icon={<IcoBell />} label="Notifications"
                    badge={notificationsEnabled ? { text: 'on', color: 'green' } : { text: 'off', color: 'gray' }}
                    onClick={() => setInnerPage('notifications')} />
                </SettingGroup>

                <SettingGroup>
                  <SettingRow icon={<IcoSparkle />} label="AI Settings"
                    badge={savedKey ? { text: 'key set', color: 'green' } : { text: 'not set', color: 'gray' }}
                    onClick={() => setInnerPage('ai')} />
                  <SettingRow icon={<IcoBot />} label="Agent Wallets" onClick={() => navigate('/agent-wallets')} />
                  <SettingRow icon={<IcoLink />} label="Connected Apps" onClick={() => navigate('/connected-apps')} />
                </SettingGroup>

                <SettingGroup>
                  <SettingRow icon={<IcoDownload />} label="Export Data" onClick={handleExport} />
                  <SettingRow icon={<IcoInfo />} label="About SOLAI" onClick={() => navigate('/about')} />
                </SettingGroup>

                <div className="flex justify-between px-1 pt-1 pb-2">
                  <span className="text-[10px] opacity-20 font-mono">
                    {account?.publicKey ? `${account.publicKey.slice(0, 6)}…${account.publicKey.slice(-6)}` : ''}
                  </span>
                  <span className="text-[10px] opacity-20">v{chrome.runtime.getManifest().version}</span>
                </div>
              </div>
            </div>
            <BottomNav />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inner pages */}
      <AnimatePresence>
        {innerPage && (
          <motion.div key={innerPage}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="absolute inset-0 flex flex-col bg-[var(--color-bg)]"
          >
            <div className="flex items-center gap-1 px-3 pt-4 pb-3 border-b border-[var(--color-border)]/40">
              <button onClick={() => setInnerPage(null)}
                className="w-9 h-9 rounded-2xl flex items-center justify-center hover:bg-[var(--color-card)] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <h2 className="text-base font-bold">{PAGE_TITLES[innerPage]}</h2>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 pb-8">

              {innerPage === 'appearance' && (
                <div className="flex flex-col gap-2.5">
                  <p className="text-xs opacity-40 mb-1">Choose how SOLAI looks on your device.</p>
                  {(['light', 'dark', 'system'] as const).map(s => (
                    <button key={s} onClick={() => setThemeSetting(s)}
                      className={`flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl border transition-colors ${themeSetting === s ? 'border-primary bg-primary/10' : 'border-[var(--color-border)] bg-[var(--color-card)]'}`}
                    >
                      {s === 'light'
                        ? <IcoSun active={themeSetting === s} />
                        : s === 'dark'
                        ? <IcoMoon active={themeSetting === s} />
                        : <IcoMonitor active={themeSetting === s} />}
                      <span className={`flex-1 text-sm font-medium text-left ${themeSetting === s ? 'text-primary' : ''}`}>
                        {s === 'system' ? 'System (Auto)' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </span>
                      {themeSetting === s && <IcoCheck />}
                    </button>
                  ))}
                  {themeSetting === 'system' && (
                    <p className="text-[10px] opacity-30 text-center mt-1">Currently using: {theme} mode</p>
                  )}
                </div>
              )}

              {innerPage === 'network' && (
                <div className="flex flex-col gap-2.5">
                  <p className="text-xs opacity-40 mb-1">Select which Solana network to connect to.</p>
                  {(['mainnet', 'devnet'] as const).map(n => (
                    <button key={n} onClick={() => setNetwork(n)}
                      className={`flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl border transition-colors ${network === n ? 'border-primary bg-primary/10' : 'border-[var(--color-border)] bg-[var(--color-card)]'}`}
                    >
                      <IcoGlobe active={network === n} />
                      <div className="flex-1 text-left">
                        <p className={`text-sm font-medium capitalize ${network === n ? 'text-primary' : ''}`}>{n}</p>
                        <p className="text-[10px] opacity-30">{n === 'mainnet' ? 'Real SOL & tokens' : 'Test tokens, free SOL from faucet'}</p>
                      </div>
                      {network === n && <IcoCheck />}
                    </button>
                  ))}
                </div>
              )}

              {innerPage === 'notifications' && (
                <div className="card-bg rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Receive alerts</p>
                    <p className="text-xs opacity-40 mt-0.5">Notify when SOL or tokens arrive in your wallet</p>
                  </div>
                  <button
                    onClick={async () => { const next = !notificationsEnabled; setNotificationsEnabled(next); await setSync('notificationsEnabled', next) }}
                    className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ml-3 ${notificationsEnabled ? 'bg-primary' : 'bg-[var(--color-border)]'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${notificationsEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              )}

              {innerPage === 'security' && (
                <div className="flex flex-col gap-3">
                  <div className="card-bg rounded-3xl overflow-hidden divide-y divide-[var(--color-border)]/40">
                    <SecAction icon={<IcoKey />} label="Reveal Secret Phrase" desc="View your 12-word recovery phrase"
                      onClick={() => { setShowSeedModal(true); setSeed(''); setSeedPassword(''); setSeedError('') }} />
                    <SecAction icon={<IcoShield />} label="Change Password" desc="Update your wallet unlock password"
                      onClick={() => { setShowChangePw(true); setCurrentPw(''); setNewPw(''); setConfirmPw(''); setChangePwError('') }} />
                    <SecAction icon={<IcoLock />} label="Lock Wallet" desc="Require password to access again" onClick={lock} />
                  </div>
                  <div className="card-bg rounded-3xl overflow-hidden">
                    <SecAction icon={<IcoTrash />} label="Reset Wallet" desc="Remove all wallets from this device" danger
                      onClick={() => { setShowResetModal(true); setResetPassword(''); setResetError('') }} />
                  </div>
                </div>
              )}

              {innerPage === 'ai' && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs opacity-40 leading-relaxed">
                    Power the AI chat with an OpenRouter API key. Get one free at openrouter.ai.
                  </p>
                  <Input label="OpenRouter API Key" type="password" placeholder="sk-or-..."
                    value={apiKey} onChange={e => setApiKey(e.target.value)} />
                  {apiKey !== savedKey && (
                    <Button fullWidth onClick={saveApiKey} isLoading={isSavingKey}>
                      {savedKey ? 'Update Key' : 'Save Key'}
                    </Button>
                  )}
                  {savedKey && apiKey === savedKey && (
                    <div className="flex items-center gap-2 text-green-400">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <span className="text-xs">Key saved</span>
                    </div>
                  )}
                </div>
              )}

              {innerPage === 'inactivity' && (
                <div className="flex flex-col gap-4">
                  <div className="card-bg rounded-2xl p-3 flex items-start gap-2.5">
                    <IcoClock />
                    <p className="text-xs opacity-50 leading-relaxed">
                      If inactive for {igDays} days, all tokens are sent to your backup address. You'll get warnings in the final 7 days.
                    </p>
                  </div>
                  <div className="card-bg rounded-2xl p-4 flex items-center justify-between">
                    <p className="text-sm font-medium">Enable</p>
                    <button onClick={() => saveInactivityGuard(!igEnabled)} disabled={igSaving}
                      className={`w-10 h-5 rounded-full relative transition-colors ${igEnabled ? 'bg-primary' : 'bg-[var(--color-border)]'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${igEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  <Input label="Backup address" placeholder="Solana wallet address"
                    value={igAddress} onChange={e => { setIgAddress(e.target.value); setIgError('') }} />
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Input label="Inactivity period (days, min 30)" type="number"
                        value={String(igDays)} onChange={e => setIgDays(Math.max(30, parseInt(e.target.value) || 30))} />
                    </div>
                    <Button size="sm" isLoading={igSaving} onClick={() => saveInactivityGuard(igEnabled)}>Save</Button>
                  </div>
                  {igError && <p className="text-xs text-red-400">{igError}</p>}
                  {igEnabled && igDaysLeft !== null && (
                    <div className={`rounded-2xl px-3 py-2.5 flex items-center justify-between ${igDaysLeft <= 7 ? 'bg-red-500/10 border border-red-500/30' : 'bg-primary/5 border border-primary/20'}`}>
                      <div>
                        <p className={`text-xs font-semibold ${igDaysLeft <= 7 ? 'text-red-400' : 'text-primary'}`}>
                          {igDaysLeft <= 7 ? `⚠ Sweep in ${igDaysLeft} days` : `${igDaysLeft} days until sweep`}
                        </p>
                        <p className="text-[10px] opacity-40 mt-0.5">Opening the wallet resets this timer</p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={resetInactivityTimer}>Reset</Button>
                    </div>
                  )}
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <Modal open={showSeedModal} onClose={() => { setShowSeedModal(false); setSeed('') }} title="Reveal Secret Phrase">
        {!seed ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs opacity-50">Enter your password to reveal your seed phrase</p>
            <Input type="password" placeholder="Password" value={seedPassword}
              onChange={e => { setSeedPassword(e.target.value); setSeedError('') }} error={seedError}
              onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && revealSeed()} />
            <Button fullWidth onClick={revealSeed}>Reveal</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-3 flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400 shrink-0">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <p className="text-xs text-yellow-400">Never share this with anyone</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {seed.split(' ').map((word, i) => (
                <div key={i} className="flex items-center gap-1 bg-[var(--color-bg)] rounded-xl px-2.5 py-2 border border-[var(--color-border)]">
                  <span className="text-[9px] opacity-30 w-4">{i + 1}.</span>
                  <span className="text-xs">{word}</span>
                </div>
              ))}
            </div>
            <Button variant="secondary" fullWidth onClick={() => setSeed('')}>Hide</Button>
          </div>
        )}
      </Modal>

      <Modal open={showResetModal} onClose={() => !isResetting && setShowResetModal(false)} title="Reset Wallet">
        <div className="flex flex-col gap-3">
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3 flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p className="text-xs text-red-400">This deletes all wallets from this device. Ensure you have your seed phrases saved.</p>
          </div>
          <Input type="password" label="Confirm with password" placeholder="Enter your password"
            value={resetPassword} onChange={e => { setResetPassword(e.target.value); setResetError('') }} error={resetError}
            onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleReset()} />
          <Button fullWidth isLoading={isResetting} onClick={handleReset} className="bg-red-500 hover:bg-red-600 text-white">
            Reset All Wallets
          </Button>
        </div>
      </Modal>

      <Modal open={showChangePw} onClose={() => setShowChangePw(false)} title="Change Password">
        <div className="flex flex-col gap-3">
          <Input type="password" label="Current password" placeholder="Current password"
            value={currentPw} onChange={e => { setCurrentPw(e.target.value); setChangePwError('') }}
            onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleChangePassword()} />
          <Input type="password" label="New password" placeholder="Min 8 characters"
            value={newPw} onChange={e => { setNewPw(e.target.value); setChangePwError('') }}
            onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleChangePassword()} />
          <Input type="password" label="Confirm new password" placeholder="Confirm new password"
            value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setChangePwError('') }} error={changePwError}
            onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleChangePassword()} />
          <Button fullWidth isLoading={isChangingPw} onClick={handleChangePassword}>Update Password</Button>
        </div>
      </Modal>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SettingGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="card-bg rounded-3xl overflow-hidden divide-y divide-[var(--color-border)]/40 dark:divide-[#ececec5b]">
      {children}
    </div>
  )
}

function SettingRow({ icon, label, value, badge, onClick }: {
  icon: React.ReactNode
  label: string
  value?: string
  badge?: { text: string; color: 'green' | 'yellow' | 'gray' | 'red' }
  onClick: () => void
}) {
  return (
    <motion.button whileTap={{ scale: 0.98 }} onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-3.5 text-left"
    >
      <span className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-primary">
        {icon}
      </span>
      <span className="flex-1 text-sm">{label}</span>
      {value && <span className="text-xs opacity-40 capitalize">{value}</span>}
      {badge && (
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
          badge.color === 'green' ? 'bg-green-500/10 text-green-400' :
          badge.color === 'yellow' ? 'bg-yellow-500/10 text-yellow-400' :
          badge.color === 'red' ? 'bg-red-500/10 text-red-400' :
          'bg-[var(--color-border)]/80 text-[var(--color-text)] opacity-40'
        }`}>
          {badge.text}
        </span>
      )}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        className="opacity-20 shrink-0" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </motion.button>
  )
}

function SecAction({ icon, label, desc, danger, onClick }: {
  icon: React.ReactNode
  label: string
  desc: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <motion.button whileTap={{ scale: 0.98 }} onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-3.5 text-left"
    >
      <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${danger ? 'bg-red-500/10 text-red-400' : 'bg-primary/10 text-primary'}`}>
        {icon}
      </span>
      <div className="flex-1">
        <p className={`text-sm ${danger ? 'text-red-400' : ''}`}>{label}</p>
        <p className="text-[10px] opacity-30 mt-0.5">{desc}</p>
      </div>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        className="opacity-20 shrink-0" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </motion.button>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const ico = (children: React.ReactNode) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round">{children}</svg>
)

function IcoGlobe({ active }: { active?: boolean } = {}) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" className={active ? 'text-primary' : ''}>
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
}
function IcoShield() { return ico(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>) }
function IcoClock() { return ico(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>) }
function IcoSun({ active }: { active?: boolean } = {}) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" className={active ? 'text-primary' : ''}>
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
}
function IcoMoon({ active }: { active?: boolean } = {}) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" className={active ? 'text-primary' : ''}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
}
function IcoMonitor({ active }: { active?: boolean } = {}) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" className={active ? 'text-primary' : ''}>
    <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
}
function IcoBell() { return ico(<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>) }
function IcoSparkle() { return ico(<><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>) }
function IcoBot() { return ico(<><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/><path d="M9.5 18c.8.5 1.5.8 2.5.8s1.7-.3 2.5-.8"/></>) }
function IcoLink() { return ico(<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>) }
function IcoDownload() { return ico(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>) }
function IcoInfo() { return ico(<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>) }
function IcoKey() { return ico(<><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></>) }
function IcoLock() { return ico(<><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></>) }
function IcoTrash() { return ico(<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></>) }
function IcoCheck() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
}
