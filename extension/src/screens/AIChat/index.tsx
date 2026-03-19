import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAI } from '../../context/AIContext'
import { getSync } from '../../lib/storage'
import BottomNav from '../../components/layout/BottomNav'
import Spinner from '../../components/ui/Spinner'
import ActionCard from '../../components/chat/ActionCard'
import MarkdownText from '../../components/ui/MarkdownText'

export default function AIChatScreen() {
  const { messages, isStreaming, sendMessage, confirmAction, cancelAction, clearMessages, abort } = useAI()
  const location = useLocation()
  const navigate = useNavigate()
  const [input, setInput] = useState((location.state as any)?.initialMessage ?? '')
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const isFirstScroll = useRef(true)

  useEffect(() => {
    getSync('openrouterApiKey').then(k => setHasKey(!!k))
  }, [])

  useEffect(() => {
    if (messages.length === 0) return
    const behavior = isFirstScroll.current ? 'auto' : 'smooth'
    isFirstScroll.current = false
    requestAnimationFrame(() => requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior })
    }))
  }, [messages])

  useEffect(() => {
    const initial = (location.state as any)?.initialMessage
    if (initial && hasKey) {
      setInput('')
      handleSend(initial)
    }
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
        <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center overflow-hidden">
          <img src="/icons/icon32.png" alt="SOLAI" className="w-6 h-6 object-contain" />
        </div>
        <div>
          <p className="text-sm font-semibold">SOLAI Assistant</p>
          <p className="text-[10px] opacity-40">{isStreaming ? 'Thinking…' : 'Online'}</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {isStreaming && (
            <motion.button onClick={abort} className="text-[10px] opacity-50 hover:opacity-100 px-2">Stop</motion.button>
          )}
          {messages.length > 0 && !isStreaming && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={clearMessages}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-red-500/10 transition-colors"
              title="Clear chat"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 hover:opacity-80">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
            </motion.button>
          )}
        </div>
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
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                  msg.role === 'user'
                    ? 'bg-primary text-black rounded-br-sm'
                    : 'bg-[var(--color-card)] border border-[var(--color-border)] rounded-bl-sm'
                }`}>
                  {msg.content
                    ? msg.role === 'assistant'
                      ? <MarkdownText content={msg.content} />
                      : msg.content
                    : (isStreaming ? <Spinner size="sm" /> : null)}
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
            placeholder={hasKey ? 'Ask or instruct SOLAI…' : 'Set up API key in Settings first'}
            disabled={!hasKey || isStreaming}
            className="w-full rounded-2xl pl-4 pr-12 py-3 text-sm bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text)]/30 outline-none focus:border-primary/60 transition-colors disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming || !hasKey}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-primary flex items-center justify-center disabled:opacity-30"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>

      <BottomNav />
    </div>
  )
}
