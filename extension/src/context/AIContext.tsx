import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { streamChat } from '../lib/openrouter'
import { runAgentTurn, SOL_RESERVE } from '../lib/agent'
import { getSwapQuote, executeSwap } from '../lib/jupiter'
import { sendSol, sendUsdc, sendUsdt } from '../lib/solana'
import { addScheduledJob, ensureSchedulerAlarm, addConditionalOrder, ensurePriceAlarm } from '../lib/scheduler'
import { getSync, getSession, setSession } from '../lib/storage'
import { logTx } from '../lib/history'
import { saveContact } from '../lib/contacts'
import type { AgentResult } from '../lib/agent'
import { useWallet } from './WalletContext'
import { useBalance } from '../hooks/useBalance'
import { useToast } from '../components/ui/Toast'
import type { ChatMessage } from '../types/ai'
import type { ActionParams } from '../types/agent'

interface AIContextValue {
  messages: ChatMessage[]
  isStreaming: boolean
  sendMessage: (content: string) => Promise<void>
  confirmAction: (messageId: string) => Promise<void>
  cancelAction: (messageId: string) => void
  clearMessages: () => void
  abort: () => void
}

const AIContext = createContext<AIContextValue>(null!)

function updateMsg(
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  id: string,
  patch: Partial<ChatMessage>
) {
  setMessages(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m))
}

export function AIProvider({ children }: { children: ReactNode }) {
  const { keypair, network, account } = useWallet()
  const { balances } = useBalance()
  const { toast } = useToast()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    getSession('chatSession').then(s => {
      if (s && s.expiresAt > Date.now() && (s.messages as ChatMessage[]).length > 0) {
        setMessages(s.messages as ChatMessage[])
      }
    })
  }, [])

  useEffect(() => {
    if (messages.length > 0) {
      setSession('chatSession', { messages: messages as unknown[], expiresAt: Date.now() + 30 * 60 * 1000 })
    }
  }, [messages])

  const sendMessage = useCallback(async (content: string) => {
    const apiKey = await getSync('openrouterApiKey')
    if (!apiKey) throw new Error('No API key — add your OpenRouter key in Settings')

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(), role: 'user', content, timestamp: Date.now(),
    }
    setMessages(prev => [...prev.slice(-18), userMsg])
    setIsStreaming(true)

    const sol = balances.find(b => b.meta.symbol === 'SOL')?.amount ?? 0
    const usdc = balances.find(b => b.meta.symbol === 'USDC')?.amount ?? 0
    const usdt = balances.find(b => b.meta.symbol === 'USDT')?.amount ?? 0
    const solUsdValue = balances.find(b => b.meta.symbol === 'SOL')?.usdValue ?? 0
    const totalUsdValue = balances.reduce((sum, b) => sum + (b.usdValue ?? 0), 0)
    const ctx = {
      publicKey: account?.publicKey ?? '',
      network,
      solBalance: sol,
      solMaxSendable: Math.max(0, sol - SOL_RESERVE),
      usdcBalance: usdc,
      usdtBalance: usdt,
      solUsdValue,
      totalUsdValue,
    }

    // Phase 1: agent intent detection
    let agentResult: AgentResult = null
    try {
      agentResult = await runAgentTurn(content, messages.slice(-16), apiKey, 'openai/gpt-4o-mini', ctx)
    } catch (e: any) {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(), role: 'assistant',
        content: e?.message ?? 'Something went wrong', timestamp: Date.now(),
      }
      setMessages(prev => [...prev, errMsg])
      setIsStreaming(false)
      return
    }

    // Phase 2a: inline text result (e.g. get_contacts)
    if (typeof agentResult === 'string') {
      const infoMsg: ChatMessage = {
        id: crypto.randomUUID(), role: 'assistant', content: agentResult, timestamp: Date.now(),
      }
      setMessages(prev => [...prev, infoMsg])
      setIsStreaming(false)
      return
    }

    // Phase 2b: action card path
    if (agentResult) {
      const actionMsg: ChatMessage = {
        id: crypto.randomUUID(), role: 'assistant', content: '',
        timestamp: Date.now(), action: agentResult, actionState: 'pending',
      }
      setMessages(prev => [...prev, actionMsg])
      setIsStreaming(false)
      return
    }

    // Phase 2b: streaming text path
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(), role: 'assistant', content: '', timestamp: Date.now(),
    }
    setMessages(prev => [...prev, assistantMsg])

    const systemPrompt = `You are SOLAI, a friendly Solana wallet assistant. Wallet: ${ctx.publicKey}. Network: ${network}. Balances: ${sol.toFixed(4)} SOL, ${usdc.toFixed(2)} USDC, ${usdt.toFixed(2)} USDT. Be concise and helpful. Never ask for private keys or seed phrases.`
    const history: ChatMessage[] = [
      { id: 'sys', role: 'system', content: systemPrompt, timestamp: 0 },
      ...messages.slice(-16),
      userMsg,
    ]

    abortRef.current = new AbortController()
    try {
      await streamChat(
        history,
        apiKey,
        'openai/gpt-4o-mini',
        chunk => setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, content: m.content + chunk } : m)),
        () => setIsStreaming(false),
        abortRef.current.signal
      )
    } catch (e: any) {
      const isAbort = e?.name === 'AbortError'
      if (!isAbort) {
        updateMsg(setMessages, assistantMsg.id, { content: e?.message ?? 'Something went wrong — try again' })
      }
      setIsStreaming(false)
      if (!isAbort) throw e
    }
  }, [messages, account, keypair, network, balances])

  const confirmAction = useCallback(async (messageId: string) => {
    const msg = messages.find(m => m.id === messageId)
    if (!msg?.action) return

    updateMsg(setMessages, messageId, { actionState: 'executing' })

    try {
      if (!keypair) throw new Error('Wallet is locked — unlock first')

      const { kind, params } = msg.action as any

      if (kind === 'send') {
        const sig = params.token === 'SOL'
          ? await sendSol(keypair, params.recipient, params.amount, network)
          : params.token === 'USDT'
            ? await sendUsdt(keypair, params.recipient, params.amount, network)
            : await sendUsdc(keypair, params.recipient, params.amount, network)
        updateMsg(setMessages, messageId, { actionState: 'done', txSignature: sig })
        toast('Sent successfully!', 'success')
        logTx({ sig, type: 'send', timestamp: Date.now(), amount: params.amount, token: params.token, toOrFrom: params.recipient, status: 'success' })
      }

      else if (kind === 'swap') {
        if (network !== 'mainnet') throw new Error('Swaps require mainnet — go to Settings → Network → Mainnet')
        const freshQuote = await getSwapQuote(params.inputToken, params.outputToken, params.inputAmount, params.slippageBps)
        const sig = await executeSwap(freshQuote, keypair)
        updateMsg(setMessages, messageId, { actionState: 'done', txSignature: sig })
        toast('Swap complete!', 'success')
        logTx({ sig, type: 'swap', timestamp: Date.now(), amount: params.inputAmount, token: `${params.inputToken}→${params.outputToken}`, status: 'success' })
      }

      else if (kind === 'schedule') {
        await addScheduledJob({
          action: params.action,
          intervalMs: params.intervalMs,
          intervalLabel: params.intervalLabel,
          nextRun: params.nextRun,
        })
        ensureSchedulerAlarm()
        updateMsg(setMessages, messageId, { actionState: 'done' })
        toast('Recurring payment scheduled!', 'success')
      }

      else if (kind === 'conditional') {
        await addConditionalOrder({
          token: params.token,
          condition: params.condition,
          targetPriceUsd: params.targetPriceUsd,
          action: params.action,
          actionLabel: params.actionLabel,
        })
        ensurePriceAlarm()
        updateMsg(setMessages, messageId, { actionState: 'done' })
        toast('Conditional order set!', 'success')
      }

      else if (kind === 'balance') {
        updateMsg(setMessages, messageId, { actionState: 'done' })
      }

      else if (kind === 'add_contact') {
        await saveContact({ name: params.name, address: params.address })
        updateMsg(setMessages, messageId, { actionState: 'done' })
        toast(`Contact "${params.name}" added!`, 'success')
      }

    } catch (e: any) {
      const raw = e?.message ?? 'Transaction failed'
      const { kind } = msg.action as any
      const isSwapExpiry = kind === 'swap' && (raw.toLowerCase().includes('slippage') || raw.toLowerCase().includes('simulation'))
      const errorMessage = isSwapExpiry ? 'Quote expired — tap Try Again for a fresh rate' : raw
      updateMsg(setMessages, messageId, { actionState: 'error', errorMessage })
      toast(errorMessage, 'error')
    }
  }, [messages, keypair, network])

  const cancelAction = useCallback((messageId: string) => {
    updateMsg(setMessages, messageId, { actionState: 'cancelled' })
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setSession('chatSession', { messages: [], expiresAt: 0 })
  }, [])
  const abort = useCallback(() => {
    abortRef.current?.abort()
    setIsStreaming(false)
  }, [])

  return (
    <AIContext.Provider value={{ messages, isStreaming, sendMessage, confirmAction, cancelAction, clearMessages, abort }}>
      {children}
    </AIContext.Provider>
  )
}

export const useAI = () => useContext(AIContext)
