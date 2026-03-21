import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/layout/Header'
import BottomNav from '../../components/layout/BottomNav'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { useWallet } from '../../context/WalletContext'
import { useTheme } from '../../context/ThemeContext'
import { getSync, setSync } from '../../lib/storage'
import { getMnemonicFromKeystore } from '../../lib/wallet'
import FadeIn from '../../components/animations/FadeIn'
import type { Network } from '../../types/wallet'

const NETWORKS: Network[] = ['mainnet', 'devnet']

export default function SettingsScreen() {
  const navigate = useNavigate()
  const { account, network, setNetwork, lock, changePassword } = useWallet()
  const { theme, toggle } = useTheme()
  const [apiKey, setApiKey] = useState('')
  const [savedKey, setSavedKey] = useState('')
  const [showSeedModal, setShowSeedModal] = useState(false)
  const [seedPassword, setSeedPassword] = useState('')
  const [seed, setSeed] = useState('')
  const [seedError, setSeedError] = useState('')
  const [isSavingKey, setIsSavingKey] = useState(false)
  const [showChangePw, setShowChangePw] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [changePwError, setChangePwError] = useState('')
  const [isChangingPw, setIsChangingPw] = useState(false)

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

  useEffect(() => {
    getSync('openrouterApiKey').then(k => { if (k) { setSavedKey(k); setApiKey(k) } })
  }, [])

  async function saveApiKey() {
    setIsSavingKey(true)
    await setSync('openrouterApiKey', apiKey)
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

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      <Header />
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        <h2 className="text-lg font-bold py-3">Settings</h2>
        <div className="flex flex-col gap-4">
          <Section title="AI Settings">
            <Input
              label="OpenRouter API Key"
              type="password"
              placeholder="sk-or-..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
            {apiKey !== savedKey && (
              <Button size="sm" onClick={saveApiKey} isLoading={isSavingKey} className="mt-2">
                {savedKey ? 'Update Key' : 'Save Key'}
              </Button>
            )}
          </Section>

          <Section title="Appearance">
            <div className="flex items-center justify-between">
              <span className="text-sm">Dark Mode</span>
              <motion.button
                onClick={toggle}
                className={`w-12 h-6 rounded-full transition-colors relative ${theme === 'dark' ? 'bg-primary' : 'bg-[var(--color-border)]'}`}
              >
                <motion.div
                  animate={{ x: theme === 'dark' ? 24 : 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="absolute top-1 w-4 h-4 rounded-full bg-black"
                />
              </motion.button>
            </div>
          </Section>

          <Section title="Network">
            <div className="flex gap-2">
              {NETWORKS.map(n => (
                <button
                  key={n}
                  onClick={() => setNetwork(n)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors capitalize ${
                    network === n ? 'bg-primary text-black border-primary' : 'border-[var(--color-border)]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Security">
            <div className="flex flex-col gap-2">
              <Button variant="secondary" size="sm" fullWidth onClick={() => { setShowSeedModal(true); setSeed(''); setSeedPassword(''); setSeedError('') }}>
                Reveal Secret Phrase
              </Button>
              <Button variant="secondary" size="sm" fullWidth onClick={() => { setShowChangePw(true); setCurrentPw(''); setNewPw(''); setConfirmPw(''); setChangePwError('') }}>
                Change Password
              </Button>
              <Button variant="danger" size="sm" fullWidth onClick={lock}>
                Lock Wallet
              </Button>
            </div>
          </Section>

          <Section title="Wallet">
            <div className="flex flex-col gap-1.5">
              <Row label="Address" value={account?.publicKey ? `${account.publicKey.slice(0, 8)}...${account.publicKey.slice(-8)}` : '—'} />
              <Row label="Network" value={network} />
            </div>
          </Section>

          <Section title="About">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/about')}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span className="text-sm">About SOLAI</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </motion.button>
          </Section>
        </div>
      </div>
      <BottomNav />

      <Modal open={showSeedModal} onClose={() => { setShowSeedModal(false); setSeed('') }} title="Reveal Secret Phrase">
        {!seed ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs opacity-50">Enter your password to reveal your seed phrase</p>
            <Input type="password" placeholder="Password" value={seedPassword} onChange={e => { setSeedPassword(e.target.value); setSeedError('') }} error={seedError} />
            <Button fullWidth onClick={revealSeed}>Reveal</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-3">
              <div className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400 shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <p className="text-xs text-yellow-400">Never share this with anyone</p>
              </div>
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
      <Modal open={showChangePw} onClose={() => setShowChangePw(false)} title="Change Password">
        <div className="flex flex-col gap-3">
          <Input type="password" label="Current password" placeholder="Current password" value={currentPw} onChange={e => { setCurrentPw(e.target.value); setChangePwError('') }} />
          <Input type="password" label="New password" placeholder="Min 8 characters" value={newPw} onChange={e => { setNewPw(e.target.value); setChangePwError('') }} />
          <Input type="password" label="Confirm new password" placeholder="Confirm new password" value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setChangePwError('') }} error={changePwError} />
          <Button fullWidth isLoading={isChangingPw} onClick={handleChangePassword}>Update Password</Button>
        </div>
      </Modal>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-bg rounded-3xl p-4">
      <p className="text-xs opacity-40 uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs opacity-40">{label}</span>
      <span className="text-xs font-medium font-mono">{value}</span>
    </div>
  )
}
