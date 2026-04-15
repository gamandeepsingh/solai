import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWallet } from '../../context/WalletContext'
import { useToast } from '../ui/Toast'
import { validateMnemonic } from '../../lib/wallet'
import type { WalletEntry } from '../../types/wallet'

type View = 'list' | 'create' | 'import' | 'mnemonic'

interface Props {
  onClose: () => void
}

function WalletAvatar({ publicKey, size = 36 }: { publicKey: string; size?: number }) {
  const hue = publicKey ? (publicKey.charCodeAt(0) * 13 + publicKey.charCodeAt(1) * 7) % 360 : 120
  return (
    <div
      className="rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0"
      style={{ width: size, height: size, background: `hsl(${hue}, 80%, 65%)` }}
    >
      <img src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${publicKey}`} alt="Wallet" className="w-full h-full rounded-full" />
    </div>
  )
}

function truncate(s: string) {
  return s ? `${s.slice(0, 6)}...${s.slice(-6)}` : ''
}

export default function WalletSwitcher({ onClose }: Props) {
  const { accounts, activeId, addWallet, switchWallet, renameWallet, removeWallet } = useWallet()
  const { toast } = useToast()
  const [view, setView] = useState<View>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null)

  // Add wallet form state
  const [addName, setAddName] = useState('')
  const [addPassword, setAddPassword] = useState('')
  const [addMnemonic, setAddMnemonic] = useState('')
  const [addError, setAddError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdMnemonic, setCreatedMnemonic] = useState('')
  const [copiedMnemonic, setCopiedMnemonic] = useState(false)

  async function handleSwitch(wallet: WalletEntry) {
    if (wallet.id === activeId) { onClose(); return }
    await switchWallet(wallet.id)
    onClose()
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return
    await renameWallet(id, editName.trim())
    setEditingId(null)
    toast('Wallet renamed', 'success')
  }

  async function handleRemove(id: string) {
    try {
      await removeWallet(id)
      setRemoveConfirmId(null)
      toast('Wallet removed', 'success')
    } catch (e: any) {
      toast(e.message, 'error')
      setRemoveConfirmId(null)
    }
  }

  function startCreate() {
    setAddName(`Wallet ${accounts.length + 1}`)
    setAddPassword('')
    setAddError('')
    setView('create')
  }

  function startImport() {
    setAddName(`Wallet ${accounts.length + 1}`)
    setAddPassword('')
    setAddMnemonic('')
    setAddError('')
    setView('import')
  }

  async function handleCreate() {
    if (!addName.trim()) { setAddError('Enter a wallet name'); return }
    if (!addPassword) { setAddError('Enter your current password'); return }
    setIsSubmitting(true)
    setAddError('')
    try {
      const mnemonic = await addWallet({ method: 'create', name: addName.trim(), password: addPassword })
      setCreatedMnemonic(mnemonic)
      setView('mnemonic')
    } catch (e: any) {
      setAddError(e.message?.includes('decrypt') || e.message?.includes('password') ? 'Incorrect password' : e.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleImport() {
    if (!addName.trim()) { setAddError('Enter a wallet name'); return }
    const words = addMnemonic.trim().split(/\s+/)
    if (words.length !== 12) { setAddError('Seed phrase must be 12 words'); return }
    if (!validateMnemonic(addMnemonic.trim())) { setAddError('Invalid seed phrase'); return }
    if (!addPassword) { setAddError('Enter your current password'); return }
    setIsSubmitting(true)
    setAddError('')
    try {
      await addWallet({ method: 'import', name: addName.trim(), password: addPassword, mnemonic: addMnemonic.trim() })
      toast('Wallet imported!', 'success')
      onClose()
    } catch (e: any) {
      setAddError(e.message?.includes('decrypt') || e.message?.includes('password') ? 'Incorrect password' : e.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function copyMnemonic() {
    navigator.clipboard.writeText(createdMnemonic)
    setCopiedMnemonic(true)
    setTimeout(() => setCopiedMnemonic(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[var(--color-border)]">
        {view !== 'list' ? (
          <button onClick={() => { setView('list'); setAddError('') }} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        ) : (
          <div className="w-8" />
        )}
        <p className="text-sm font-semibold">
          {view === 'list' ? 'My Wallets' : view === 'create' ? 'Create Wallet' : view === 'import' ? 'Import Wallet' : 'Save Seed Phrase'}
        </p>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors opacity-60">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {/* LIST VIEW */}
        {view === 'list' && (
          <motion.div key="list" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-1 p-3">
              {accounts.map(wallet => (
                <div key={wallet.id} className={`rounded-2xl border transition-colors ${wallet.id === activeId ? 'border-primary/40 bg-primary/5' : 'border-[var(--color-border)] bg-[var(--color-card)]'}`}>
                  {(() => {
                    const pk = wallet.type === 'ledger' ? (wallet.publicKey ?? '') : (wallet.keystore?.publicKey ?? '')
                    return editingId === wallet.id ? (
                    <div className="flex items-center gap-2 px-3 py-3">
                      <WalletAvatar publicKey={pk} size={32} />
                      <input
                        className="flex-1 bg-transparent text-sm font-medium outline-none border-b border-primary pb-0.5"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleRename(wallet.id); if (e.key === 'Escape') setEditingId(null) }}
                      />
                      <button onClick={() => handleRename(wallet.id)} className="text-[10px] text-primary font-semibold px-2 py-1 rounded-lg bg-primary/10">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-[10px] opacity-40 px-1">✕</button>
                    </div>
                  ) : (
                    <button className="w-full flex items-center gap-3 px-3 py-3 text-left" onClick={() => handleSwitch(wallet)}>
                      <WalletAvatar publicKey={pk} size={36} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold truncate">{wallet.name}</p>
                          {wallet.type === 'ledger' && (
                            <span className="text-[9px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium shrink-0">Ledger</span>
                          )}
                        </div>
                        <p className="text-[10px] opacity-40 font-mono">{truncate(pk)}</p>
                      </div>
                      {wallet.id === activeId && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); setEditingId(wallet.id); setEditName(wallet.name) }}
                        className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 opacity-40 hover:opacity-80 transition-all shrink-0"
                        title="Rename"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {accounts.length > 1 && (
                        <button
                          onClick={e => { e.stopPropagation(); setRemoveConfirmId(wallet.id) }}
                          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-red-500/10 opacity-30 hover:opacity-80 hover:text-red-400 transition-all shrink-0"
                          title="Remove"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      )}
                    </button>
                  )
                  })()}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 px-3 pb-4 mt-2">
              <button onClick={startCreate} className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl border border-[var(--color-border)] hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <span className="text-sm font-medium">Create New Wallet</span>
              </button>
              <button onClick={startImport} className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl border border-[var(--color-border)] hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </div>
                <span className="text-sm font-medium">Import Wallet</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* CREATE VIEW */}
        {view === 'create' && (
          <motion.div key="create" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex-1 flex flex-col gap-4 p-4">
            <p className="text-xs opacity-40">A new wallet will be created and encrypted with your current password.</p>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs opacity-50">Wallet name</span>
                <input
                  className="rounded-xl px-3 py-2.5 text-sm bg-[var(--color-card)] border border-[var(--color-border)] outline-none focus:border-primary/60"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  placeholder="My Wallet"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs opacity-50">Current password</span>
                <input
                  type="password"
                  className="rounded-xl px-3 py-2.5 text-sm bg-[var(--color-card)] border border-[var(--color-border)] outline-none focus:border-primary/60"
                  value={addPassword}
                  onChange={e => setAddPassword(e.target.value)}
                  placeholder="Enter your wallet password"
                />
              </label>
            </div>
            {addError && <p className="text-xs text-red-400">{addError}</p>}
            <button
              onClick={handleCreate}
              disabled={isSubmitting}
              className="w-full py-3 rounded-2xl bg-primary text-black text-sm font-semibold disabled:opacity-40"
            >
              {isSubmitting ? 'Creating…' : 'Create Wallet'}
            </button>
          </motion.div>
        )}

        {/* MNEMONIC VIEW */}
        {view === 'mnemonic' && (
          <motion.div key="mnemonic" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex-1 flex flex-col gap-4 p-4 overflow-y-auto">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-3">
              <p className="text-xs text-yellow-400">Write down these 12 words in order. Never share them with anyone.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {createdMnemonic.split(' ').map((word, i) => (
                <div key={i} className="flex items-center gap-1 bg-[var(--color-card)] rounded-xl px-2.5 py-2 border border-[var(--color-border)]">
                  <span className="text-[9px] opacity-30 w-4">{i + 1}.</span>
                  <span className="text-xs">{word}</span>
                </div>
              ))}
            </div>
            <button onClick={copyMnemonic} className="w-full py-2.5 rounded-2xl border border-[var(--color-border)] text-sm font-medium transition-colors hover:border-primary/40">
              {copiedMnemonic ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Copied!
                </span>
              ) : 'Copy to clipboard'}
            </button>
            <button onClick={onClose} className="w-full py-3 rounded-2xl bg-primary text-black text-sm font-semibold">
              I saved it — Done
            </button>
          </motion.div>
        )}

        {/* IMPORT VIEW */}
        {view === 'import' && (
          <motion.div key="import" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex-1 flex flex-col gap-4 p-4">
            <p className="text-xs opacity-40">Import a wallet using its 12-word seed phrase. It will be encrypted with your current password.</p>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs opacity-50">Wallet name</span>
                <input
                  className="rounded-xl px-3 py-2.5 text-sm bg-[var(--color-card)] border border-[var(--color-border)] outline-none focus:border-primary/60"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  placeholder="My Wallet"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs opacity-50">Secret phrase (12 words)</span>
                <textarea
                  className="rounded-xl px-3 py-2.5 text-sm bg-[var(--color-card)] border border-[var(--color-border)] outline-none focus:border-primary/60 resize-none h-20 font-mono"
                  value={addMnemonic}
                  onChange={e => setAddMnemonic(e.target.value)}
                  placeholder="word1 word2 word3 …"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs opacity-50">Current password</span>
                <input
                  type="password"
                  className="rounded-xl px-3 py-2.5 text-sm bg-[var(--color-card)] border border-[var(--color-border)] outline-none focus:border-primary/60"
                  value={addPassword}
                  onChange={e => setAddPassword(e.target.value)}
                  placeholder="Enter your wallet password"
                />
              </label>
            </div>
            {addError && <p className="text-xs text-red-400">{addError}</p>}
            <button
              onClick={handleImport}
              disabled={isSubmitting}
              className="w-full py-3 rounded-2xl bg-primary text-black text-sm font-semibold disabled:opacity-40"
            >
              {isSubmitting ? 'Importing…' : 'Import Wallet'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Remove confirmation modal */}
      <AnimatePresence>
        {removeConfirmId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-end z-10"
            onClick={() => setRemoveConfirmId(null)}
          >
            <motion.div
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              className="w-full bg-[var(--color-card)] rounded-t-3xl p-5 flex flex-col gap-3"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-center">Remove Wallet?</p>
              <p className="text-xs opacity-40 text-center">
                {accounts.find(a => a.id === removeConfirmId)?.name} will be removed from this device.
                Make sure you have your seed phrase saved.
              </p>
              <button onClick={() => handleRemove(removeConfirmId!)} className="w-full py-3 rounded-2xl bg-red-500 text-white text-sm font-semibold">Remove</button>
              <button onClick={() => setRemoveConfirmId(null)} className="w-full py-3 rounded-2xl border border-[var(--color-border)] text-sm font-medium">Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
