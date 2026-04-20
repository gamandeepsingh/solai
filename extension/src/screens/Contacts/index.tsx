import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/layout/Header'
import BottomNav from '../../components/layout/BottomNav'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import { useContacts } from '../../hooks/useContacts'
import { useToast } from '../../components/ui/Toast'
import { isValidSolanaAddress } from '../../lib/solana'
import { useBalance } from '@/hooks/useBalance'

const AI_PLACEHOLDERS = [
  'swap 0.5 SOL → USDC',
  'send 1 SOL to mom',
  'save contact Alice',
  'buy SOL if price drops 10%',
  'show my balance',
]

export default function ContactsScreen() {
  const navigate = useNavigate()
  const { contacts, isLoading, add, remove } = useContacts()
  const { toast } = useToast()
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [search, setSearch] = useState('')
  const [phIdx, setPhIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setPhIdx(i => (i + 1) % AI_PLACEHOLDERS.length), 3000)
    return () => clearInterval(id)
  }, [])

  const filtered = contacts
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.address.toLowerCase().includes(search.toLowerCase())
    )
  
  function handleAiSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!aiInput.trim()) return
    navigate('/ai', { state: { initialMessage: aiInput } })
    setAiInput('')
  }

  async function handleAdd() {
    if (!name.trim()) return setError('Name is required')
    if (!isValidSolanaAddress(address)) return setError('Invalid Solana address')
    const dup = contacts.find(c => c.address === address)
    if (dup) return setError(`Address already saved as "${dup.name}"`)
    setIsSaving(true)
    try {
      await add({ name: name.trim(), emoji: emoji.trim() || undefined, address, note: note.trim() || undefined })
      setShowAdd(false)
      setName(''); setEmoji(''); setAddress(''); setNote(''); setError('')
    } catch {
      setError('Failed to save contact')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)] relative">
      <Header />
      <div className="flex-1 flex flex-col px-4 pb-32 overflow-y-auto">
        <div className="flex items-center justify-between py-3">
          <h2 className="text-lg font-bold">Contacts</h2>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowAdd(true)}
            className="w-8 h-8 rounded-full bg-primary text-black flex items-center justify-center font-bold text-lg"
          >+</motion.button>
        </div>

        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="w-full rounded-2xl pl-9 pr-4 py-2 text-sm bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text)]/30 outline-none focus:border-primary/60 transition-colors"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center mt-10"><Spinner /></div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 mt-10 text-[var(--color-text)]/50">
            <div className="w-10 h-10 rounded-2xl bg-[var(--color-card)] flex items-center justify-center border border-[var(--color-border)]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <p className="text-sm">No contacts yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <AnimatePresence>
              {filtered.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.05 }}
                  className="card-bg rounded-2xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                      {c.emoji || c.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{c.name}</p>
                      <p className="text-[10px] opacity-40 font-mono">{c.address.slice(0, 8)}...{c.address.slice(-8)}</p>
                      {c.lastInteractionAt && (
                        <p className="text-[10px] opacity-40">
                          Last sent {formatRelativeTime(c.lastInteractionAt)}
                          {c.sentCount && c.sentCount > 1 ? ` · ${c.sentCount}×` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => navigate('/send', { state: { recipient: c.address } })}
                      className="text-[10px] px-2 py-1 rounded-full border border-primary/30 text-primary"
                    >Send</motion.button>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => { navigator.clipboard.writeText(c.address); toast('Address copied!', 'success') }}
                      className="w-7 h-7 rounded-full border border-[var(--color-border)] opacity-60 flex items-center justify-center"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => remove(c.id)}
                      className="w-7 h-7 rounded-full border border-red-500/30 text-red-400 flex items-center justify-center"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      <div className="absolute bottom-16 left-0 right-0 px-4 pb-2 z-20">
          <form onSubmit={handleAiSubmit}>
            <motion.div whileFocus={{ scale: 1.01 }} className="relative">
              <input
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                placeholder={`Ask "${AI_PLACEHOLDERS[phIdx]}"`}
                className="w-full rounded-2xl pl-4 pr-12 py-3 text-sm bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text)]/30 outline-none focus:border-primary/60 transition-colors shadow-lg"
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-primary flex items-center justify-center disabled:opacity-30"
                disabled={!aiInput.trim()}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </motion.div>
          </form>
        </div>
      <BottomNav />

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Contact">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input label="Name" placeholder="Friend's name" value={name} onChange={e => { setName(e.target.value); setError('') }} onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleAdd()} />
            </div>
            <div style={{ width: 72 }}>
              <Input label="Emoji" placeholder="👤" value={emoji} onChange={e => setEmoji(e.target.value)} />
            </div>
          </div>
          <Input label="Solana Address" placeholder="Wallet address" value={address} onChange={e => { setAddress(e.target.value); setError('') }} onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleAdd()} />
          <Input label="Note (optional)" placeholder="e.g. Work wallet" value={note} onChange={e => setNote(e.target.value)} error={error} onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleAdd()} />
          <Button fullWidth isLoading={isSaving} onClick={handleAdd}>Save Contact</Button>
        </div>
      </Modal>
    </div>
  )
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
