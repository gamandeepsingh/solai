import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAI } from '../../context/AIContext'
import { getSync } from '../../lib/storage'
import BottomNav from '../../components/layout/BottomNav'
import Spinner from '../../components/ui/Spinner'
import ActionCard from '../../components/chat/ActionCard'

export default function AIChatScreen() {
  const { messages, isStreaming, sendMessage, confirmAction, cancelAction, abort } = useAI()
  const location = useLocation()
  const navigate = useNavigate()
  const [input, setInput] = useState((location.state as any)?.initialMessage ?? '')
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getSync('openrouterApiKey').then(k => setHasKey(!!k))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const initial = (location.state as any)?.initialMessage
    if (initial && hasKey) handleSend(initial)
  }, [hasKey])

  async function handleSend(text: string) {
    setError('')
    try {
      await sendMessage(text)
    } catch (e: any) {
      setError(e.message?.includes('No API key') ? 'Add your OpenRouter API key in Settings' : (e.message ?? 'Something went wrong'))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || isStreaming) return
    const msg = input.trim()
    setInput('')
    await handleSend(msg)
  }

  if (hasKey === null) return null

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 border-b border-[var(--color-border)]">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm">◎</div>
        <div>
          <p className="text-sm font-semibold">SOLAI Assistant</p>
          <p className="text-[10px] opacity-40">{isStreaming ? 'Thinking…' : 'Online'}</p>
        </div>
        {isStreaming && (
          <motion.button onClick={abort} className="ml-auto text-[10px] opacity-50 hover:opacity-100">Stop</motion.button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 pb-0 flex flex-col gap-3">
        {messages.length === 0 && !hasKey && (
          <div className="flex flex-col items-center gap-3 mt-10 text-center">
            <span className="text-3xl">🔑</span>
            <p className="text-sm opacity-60">Add your OpenRouter API key in Settings to start chatting</p>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/settings')} className="text-xs text-primary underline">
              Go to Settings
            </motion.button>
          </div>
        )}
        {messages.length === 0 && hasKey && (
          <div className="flex flex-col items-center gap-2 mt-10 text-center opacity-40">
            <span className="text-3xl">✨</span>
            <p className="text-sm">Ask me anything — or tell me what to do</p>
            <p className="text-xs">"Swap 0.1 SOL to USDC" · "Send $5 to mom" · "Check my balance"</p>
          </div>
        )}

        <AnimatePresence>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.action ? (
                <ActionCard
                  message={msg}
                  onConfirm={() => confirmAction(msg.id)}
                  onCancel={() => cancelAction(msg.id)}
                />
              ) : (
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary text-black rounded-br-sm'
                    : 'bg-[var(--color-card)] border border-[var(--color-border)] rounded-bl-sm'
                }`}>
                  {msg.content || (isStreaming ? <Spinner size="sm" /> : null)}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 pb-[4.5rem] border-t border-[var(--color-border)]">
        <form onSubmit={handleSubmit} className="relative">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask SOLAI anything…"
            disabled={!hasKey}
            className="w-full rounded-2xl pl-4 pr-12 py-3 text-sm bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text)]/30 outline-none focus:border-primary/60 transition-colors disabled:opacity-40"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any) } }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming || !hasKey}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-primary flex items-center justify-center disabled:opacity-30 transition-opacity"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
      <BottomNav />
    </div>
  )
}
