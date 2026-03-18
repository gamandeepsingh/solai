import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/layout/Header'
import BottomNav from '../../components/layout/BottomNav'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import { useContacts } from '../../hooks/useContacts'
import { isValidSolanaAddress } from '../../lib/solana'

export default function ContactsScreen() {
  const navigate = useNavigate()
  const { contacts, isLoading, add, remove } = useContacts()
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function handleAdd() {
    if (!name.trim()) return setError('Name is required')
    if (!isValidSolanaAddress(address)) return setError('Invalid Solana address')
    setIsSaving(true)
    try {
      await add({ name: name.trim(), address, note: note.trim() || undefined })
      setShowAdd(false)
      setName(''); setAddress(''); setNote(''); setError('')
    } catch {
      setError('Failed to save contact')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)] relative">
      <Header />
      <div className="flex-1 flex flex-col px-4 pb-16 overflow-y-auto">
        <div className="flex items-center justify-between py-3">
          <h2 className="text-lg font-bold">Contacts</h2>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowAdd(true)}
            className="w-8 h-8 rounded-full bg-primary text-black flex items-center justify-center font-bold text-lg"
          >+</motion.button>
        </div>

        {isLoading ? (
          <div className="flex justify-center mt-10"><Spinner /></div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 mt-10 opacity-40">
            <span className="text-4xl">👥</span>
            <p className="text-sm">No contacts yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <AnimatePresence>
              {contacts.map((c, i) => (
                <motion.div
                  key={c._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.05 }}
                  className="card-bg rounded-2xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                      {c.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{c.name}</p>
                      <p className="text-[10px] opacity-40 font-mono">{c.address.slice(0, 8)}...{c.address.slice(-8)}</p>
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
                      onClick={() => remove(c._id)}
                      className="text-[10px] px-2 py-1 rounded-full border border-red-500/30 text-red-400"
                    >✕</motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      <BottomNav />

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Contact">
        <div className="flex flex-col gap-3">
          <Input label="Name" placeholder="Friend's name" value={name} onChange={e => { setName(e.target.value); setError('') }} />
          <Input label="Solana Address" placeholder="Wallet address" value={address} onChange={e => { setAddress(e.target.value); setError('') }} />
          <Input label="Note (optional)" placeholder="e.g. Work wallet" value={note} onChange={e => setNote(e.target.value)} error={error} />
          <Button fullWidth isLoading={isSaving} onClick={handleAdd}>Save Contact</Button>
        </div>
      </Modal>
    </div>
  )
}
