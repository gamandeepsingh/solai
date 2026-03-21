import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAI } from '../../context/AIContext'
import { useWallet } from '../../context/WalletContext'
import { getSync } from '../../lib/storage'
import BottomNav from '../../components/layout/BottomNav'
import Spinner from '../../components/ui/Spinner'
import ActionCard from '../../components/chat/ActionCard'
import MarkdownText from '../../components/ui/MarkdownText'

export default function AIChatScreen() {
  const { messages, isStreaming, sendMessage, confirmAction, cancelAction, clearMessages, abort } = useAI()
  const { network } = useWallet()
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
          <p className="text-[10px] opacity-40">{isStreaming ? 'Thinking…' : 'Online'} · <span className="capitalize">{network}</span></p>
        </div>
        <div className="ml-auto flex items-center gap-1">
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
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("/settings")}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            title="Settings"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
              <circle cx="8" cy="6" r="2" fill="currentColor" stroke="currentColor" strokeWidth="0" />
              <circle cx="16" cy="12" r="2" fill="currentColor" stroke="currentColor" strokeWidth="0" />
              <circle cx="8" cy="18" r="2" fill="currentColor" stroke="currentColor" strokeWidth="0" />
            </svg>
          </motion.button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 pb-0 flex flex-col gap-3">
        {messages.length === 0 && !hasKey && (
          <div className="flex flex-col items-center gap-3 mt-10 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
            <p className="text-sm opacity-60">Add your OpenRouter API key in Settings to start chatting</p>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/settings')} className="text-xs text-primary underline">
              Go to Settings
            </motion.button>
          </div>
        )}
        {messages.length === 0 && hasKey && (
          <div className="flex flex-col items-center mt-12 text-center">

            {/* Icon */}
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
              >
                <path d="M12 3l2.5 5L20 10l-5 2.5L12 18l-2.5-5L4 10l5-2.5L12 3z" />
              </svg>
            </div>

            {/* Title */}
            <p className="text-sm font-medium text-[var(--color-text)]/80">
              What can I help you with?
            </p>

            {/* Subtitle */}
            <p className="text-xs text-[var(--color-text)]/50 mt-1">
              Try one of these
            </p>

            {/* Suggestions */}
            <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-[260px]">
              {[
                { label: "Swap 0.1 SOL → USDC", icon: "swap" },
                { label: "Send $5 to mom", icon: "send" },
                { label: "Check my balance", icon: "wallet" },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(item.label)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/60 hover:bg-[var(--color-card)] transition-all text-[var(--color-text)]"
                >
                  {item.icon === "swap" && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 1l4 4-4 4" />
                      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                      <path d="M7 23l-4-4 4-4" />
                      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
                  )}

                  {item.icon === "send" && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 2L11 13" />
                      <path d="M22 2L15 22l-4-9-9-4 20-7z" />
                    </svg>
                  )}

                  {item.icon === "wallet" && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="6" width="20" height="12" rx="2" />
                      <path d="M16 12h.01" />
                    </svg>
                  )}

                  {item.label}
                </button>
              ))}
            </div>
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
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${msg.role === 'user'
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
