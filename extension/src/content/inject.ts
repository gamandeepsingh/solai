const SOLAI_MSG = 'SOLAI_PAGE_MSG'
const SOLAI_RESP = 'SOLAI_EXT_RESP'

function bs58Decode(s: string): Uint8Array {
  const ALPHA = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const digits = [0]
  for (let i = 0; i < s.length; i++) {
    const c = ALPHA.indexOf(s[i])
    if (c < 0) continue
    let carry = c
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] * 58
      digits[j] = carry & 0xff
      carry >>>= 8
    }
    while (carry) { digits.push(carry & 0xff); carry >>>= 8 }
  }
  let k = 0
  while (k < s.length && s[k] === '1') k++
  const res = new Uint8Array(k + digits.length)
  res.set(digits.reverse(), k)
  return res
}

let _publicKey: string | null = null
const _pendingRequests: Map<string, { resolve: (v: any) => void; reject: (e: any) => void }> = new Map()
const _listeners: Map<string, Set<(...args: any[]) => void>> = new Map()

window.addEventListener('message', (event) => {
  if (event.source !== window) return
  if (event.data?.type !== SOLAI_RESP) return
  const { requestId, result, error } = event.data
  const pending = _pendingRequests.get(requestId)
  if (!pending) return
  _pendingRequests.delete(requestId)
  if (error) pending.reject(new Error(error))
  else pending.resolve(result)
})

function sendRequest(method: string, params?: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    const requestId = Math.random().toString(36).slice(2)
    _pendingRequests.set(requestId, { resolve, reject })
    window.postMessage({ type: SOLAI_MSG, requestId, method, params }, '*')
    setTimeout(() => {
      if (_pendingRequests.has(requestId)) {
        _pendingRequests.delete(requestId)
        reject(new Error('SOLAI: request timed out'))
      }
    }, 30_000)
  })
}

function emit(event: string, ...args: any[]) {
  _listeners.get(event)?.forEach(fn => fn(...args))
}

// ─── Legacy window.solana provider ──────────────────────────────────────────

const solaiProvider = {
  isSOLAI: true,
  isPhantom: false,
  publicKey: null as { toBase58(): string } | null,

  async connect(): Promise<{ publicKey: { toBase58(): string } }> {
    const result = await sendRequest('connect', { origin: window.location.origin })
    _publicKey = result.publicKey
    solaiProvider.publicKey = { toBase58: () => _publicKey! }
    emit('connect', solaiProvider.publicKey)
    return { publicKey: solaiProvider.publicKey }
  },

  async disconnect(): Promise<void> {
    _publicKey = null
    solaiProvider.publicKey = null
    await sendRequest('disconnect')
    emit('disconnect')
  },

  async signTransaction(transaction: unknown): Promise<unknown> {
    return sendRequest('signTransaction', { transaction })
  },

  async signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }> {
    const result = await sendRequest('signMessage', { message: Array.from(message) })
    return { signature: new Uint8Array(result.signature) }
  },

  on(event: string, handler: (...args: any[]) => void) {
    if (!_listeners.has(event)) _listeners.set(event, new Set())
    _listeners.get(event)!.add(handler)
    return solaiProvider
  },
  off(event: string, handler: (...args: any[]) => void) {
    _listeners.get(event)?.delete(handler)
    return solaiProvider
  },
}

Object.defineProperty(window, 'solana', {
  value: solaiProvider,
  writable: false,
  configurable: false,
})

// ─── Wallet Standard announcement protocol ──────────────────────────────────
// This makes SOLAI appear in dApp wallet selectors alongside Phantom & Solflare

const SOLAI_ICON = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="#0f0f0f"/><circle cx="64" cy="52" r="28" fill="#ABFF7A" opacity="0.15"/><text x="64" y="80" font-size="56" text-anchor="middle" fill="#ABFF7A">⬡</text></svg>`)

const walletStandardAccounts: any[] = []

const walletStandardObject = {
  version: '1.0.0' as const,
  name: 'SOLAI',
  icon: SOLAI_ICON,
  chains: ['solana:mainnet', 'solana:devnet'],
  features: {
    'standard:connect': {
      version: '1.0.0',
      async connect(_input?: { silent?: boolean }) {
        if (_publicKey) {
          return { accounts: walletStandardAccounts }
        }
        const result = await sendRequest('connect', { origin: window.location.origin })
        _publicKey = result.publicKey
        solaiProvider.publicKey = { toBase58: () => _publicKey! }

        const account = {
          address: _publicKey!,
          publicKey: bs58Decode(_publicKey!).buffer,
          chains: ['solana:mainnet', 'solana:devnet'],
          features: ['standard:connect', 'standard:disconnect', 'solana:signAndSendTransaction', 'solana:signMessage'],
        }
        walletStandardAccounts.length = 0
        walletStandardAccounts.push(account)
        emit('standard:change', { accounts: walletStandardAccounts })
        return { accounts: walletStandardAccounts }
      },
    },
    'standard:disconnect': {
      version: '1.0.0',
      async disconnect() {
        _publicKey = null
        solaiProvider.publicKey = null
        walletStandardAccounts.length = 0
        await sendRequest('disconnect')
        emit('standard:change', { accounts: [] })
      },
    },
    'standard:events': {
      version: '1.0.0',
      on(event: string, listener: (...args: any[]) => void) {
        if (!_listeners.has(event)) _listeners.set(event, new Set())
        _listeners.get(event)!.add(listener)
        return () => _listeners.get(event)?.delete(listener)
      },
    },
    'solana:signMessage': {
      version: '1.0.0',
      async signMessage(input: { message: Uint8Array; account: any }) {
        const result = await sendRequest('signMessage', { message: Array.from(input.message) })
        return [{ signedMessage: input.message, signature: new Uint8Array(result.signature) }]
      },
    },
    'solana:signAndSendTransaction': {
      version: '1.0.0',
      async signAndSendTransaction(input: { transaction: Uint8Array; account: any; chain: string; options?: any }) {
        const result = await sendRequest('signAndSendTransaction', {
          transaction: Array.from(input.transaction),
          chain: input.chain,
          options: input.options,
        })
        return [{ signature: result.signature }]
      },
    },
  },
  get accounts() {
    return walletStandardAccounts
  },
}

function registerWithApp(register: (wallet: typeof walletStandardObject) => void) {
  try { register(walletStandardObject) } catch {}
}

// Tell already-loaded dApps about SOLAI
window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', {
  detail: Object.freeze({ register: registerWithApp }),
  bubbles: false,
  cancelable: false,
  composed: false,
}))

// Tell dApps that load after SOLAI
window.addEventListener('wallet-standard:app-ready', (event: Event) => {
  const e = event as CustomEvent<{ register: typeof registerWithApp }>
  try { e.detail.register(walletStandardObject) } catch {}
})
