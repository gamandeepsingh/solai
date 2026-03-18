import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
import { streamChat } from '../lib/openrouter'
import { getSync } from '../lib/storage'
import type { ChatMessage } from '../types/ai'

interface AIContextValue {
  messages: ChatMessage[]
  isStreaming: boolean
  sendMessage: (content: string, systemContext?: string) => Promise<void>
  clearMessages: () => void
  abort: () => void
}

const AIContext = createContext<AIContextValue>(null!)

export function AIProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (content: string, systemContext?: string) => {
    const apiKey = await getSync('openrouterApiKey')
    if (!apiKey) throw new Error('No API key')

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content, timestamp: Date.now() }
    const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '', timestamp: Date.now() }

    setMessages(prev => {
      const limited = prev.slice(-18)
      return [...limited, userMsg, assistantMsg]
    })
    setIsStreaming(true)

    const history: ChatMessage[] = systemContext
      ? [{ id: 'sys', role: 'assistant', content: systemContext, timestamp: 0 }, ...messages.slice(-18), userMsg]
      : [...messages.slice(-18), userMsg]

    abortRef.current = new AbortController()

    try {
      await streamChat(
        history,
        apiKey,
        'openai/gpt-4o-mini',
        (chunk) => {
          setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, content: m.content + chunk } : m))
        },
        () => setIsStreaming(false),
        abortRef.current.signal
      )
    } catch {
      setIsStreaming(false)
    }
  }, [messages])

  const clearMessages = useCallback(() => setMessages([]), [])
  const abort = useCallback(() => { abortRef.current?.abort(); setIsStreaming(false) }, [])

  return (
    <AIContext.Provider value={{ messages, isStreaming, sendMessage, clearMessages, abort }}>
      {children}
    </AIContext.Provider>
  )
}

export const useAI = () => useContext(AIContext)
