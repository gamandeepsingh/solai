import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
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
  const { account, network, setNetwork, lock } = useWallet()
  const { theme, toggle } = useTheme()
  const [apiKey, setApiKey] = useState('')
  const [savedKey, setSavedKey] = useState('')
  const [showSeedModal, setShowSeedModal] = useState(false)
  const [seedPassword, setSeedPassword] = useState('')
  const [seed, setSeed] = useState('')
  const [seedError, setSeedError] = useState('')
  const [isSavingKey, setIsSavingKey] = useState(false)

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
              <p className="text-xs text-yellow-400">⚠️ Never share this with anyone</p>
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
