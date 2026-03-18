import type { ChatMessage } from '../types/ai'

const BASE_URL = 'https://openrouter.ai/api/v1'

export async function streamChat(
  messages: ChatMessage[],
  apiKey: string,
  model = 'openai/gpt-4o-mini',
  onChunk: (text: string) => void,
  onDone: () => void,
  signal?: AbortSignal
): Promise<void> {
  const payload = messages.map(m => ({ role: m.role, content: m.content }))

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'chrome-extension://solai-wallet',
      'X-Title': 'SOLAI Wallet',
    },
    body: JSON.stringify({ model, messages: payload, stream: true }),
    signal,
  })

  if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`)

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
