import type { ChatMessage } from '../types/ai'

const BASE_URL = 'https://openrouter.ai/api/v1'

// HTTP/1.1 headers must be ISO-8859-1. Strip any characters outside that range
// (most commonly happens when an API key is pasted with invisible unicode chars).
function sanitizeHeaderValue(s: string): string {
  return s.trim().replace(/[^\x20-\x7E]/g, '')
}

export async function streamChat(
  messages: ChatMessage[],
  apiKey: string,
  model = 'openai/gpt-4o-mini',
  onChunk: (text: string) => void,
  onDone: () => void,
  signal?: AbortSignal
): Promise<void> {
  const payload = messages.map(m => ({ role: m.role, content: m.content }))
  const cleanKey = sanitizeHeaderValue(apiKey)

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cleanKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'chrome-extension://solai-wallet',
      'X-Title': 'SOLAI Wallet',
    },
    body: JSON.stringify({ model, messages: payload, stream: true }),
    signal,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = body?.error?.message ?? ''
    if (res.status === 401) throw new Error('Invalid API key — check Settings')
    if (res.status === 429) throw new Error('Rate limit reached — try again in a moment')
    if (res.status === 402) throw new Error('Insufficient credits on OpenRouter')
    throw new Error(msg || `OpenRouter error ${res.status}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()!
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') { onDone(); return }
      try {
        const chunk = JSON.parse(data)
        const delta = chunk.choices?.[0]?.delta?.content ?? ''
        if (delta) onChunk(delta)
      } catch {}
    }
  }
  onDone()
}

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export async function callWithTools(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  model: string,
  tools: unknown[],
  toolChoice: 'auto' | 'required' = 'required'
): Promise<{ content: string | null; toolCalls: ToolCall[] | null }> {
  const cleanKey = sanitizeHeaderValue(apiKey)
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cleanKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'chrome-extension://solai-wallet',
      'X-Title': 'SOLAI Wallet',
    },
    body: JSON.stringify({ model, messages, tools, tool_choice: toolChoice, stream: false }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = body?.error?.message ?? ''
    if (res.status === 401) throw new Error('Invalid API key — check Settings')
    if (res.status === 429) throw new Error('Rate limit reached — try again in a moment')
    if (res.status === 402) throw new Error('Insufficient credits on OpenRouter')
    throw new Error(msg || `OpenRouter error ${res.status}`)
  }

  const data = await res.json()
  const message = data.choices?.[0]?.message
  return {
    content: message?.content ?? null,
    toolCalls: message?.tool_calls ?? null,
  }
}
