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
  if (error) {
    if (error === '__SOLAI_CONTEXT_INVALIDATED__') {
      pending.reject(new Error('SOLAI Wallet: extension was reloaded — please refresh this page to reconnect'))
    } else {
      pending.reject(new Error(error))
    }
  } else {
    pending.resolve(result)
  }
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

  async signTransaction(transaction: any): Promise<any> {
    // Transaction objects can't survive window.postMessage structured-clone.
    // Serialize to a plain byte array before crossing the context boundary.
    let txBytes: number[]
    if (transaction instanceof Uint8Array) {
      txBytes = Array.from(transaction)
    } else if (transaction && typeof transaction.serialize === 'function') {
      try {
        txBytes = Array.from(transaction.serialize({ requireAllSignatures: false, verifySignatures: false }) as Uint8Array)
      } catch {
        txBytes = Array.from(transaction.serialize({ requireAllSignatures: false }) as Uint8Array)
      }
    } else {
      txBytes = Array.from(new Uint8Array(transaction as ArrayBuffer))
    }
    const result = await sendRequest('signTransaction', { transaction: txBytes })
    const signed = new Uint8Array(result.signedTransaction)
    // Return a duck-typed Transaction that dApps can call .serialize() on.
    return {
      serialize: (_opts?: unknown) => signed,
      signatures: [{ signature: signed.slice(0, 64), publicKey: solaiProvider.publicKey }],
    }
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

// Only claim window.solana if no other wallet has already locked it.
// If Phantom (or another wallet) already defined it as non-configurable,
// Object.defineProperty throws — we catch it and continue so the Wallet
// Standard registration below still runs (that's what wallet-adapter uses).
try {
  if (!('solana' in window)) {
    Object.defineProperty(window, 'solana', {
      value: solaiProvider,
      writable: false,
      configurable: false,
    })
  }
} catch {
  // Another extension already claimed window.solana — that's fine,
  // SOLAI will still appear via the Wallet Standard protocol.
}

// ─── Wallet Standard announcement protocol ──────────────────────────────────
// This makes SOLAI appear in dApp wallet selectors alongside Phantom & Solflare

const FALLBACK_ICON = 'data:image/svg+xml;base64,' + btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">' +
  '<rect width="128" height="128" rx="24" fill="#0f0f0f"/>' +
  '<circle cx="64" cy="64" r="38" fill="none" stroke="#ABFF7A" stroke-width="7"/>' +
  '<text x="64" y="79" font-size="46" font-weight="bold" text-anchor="middle" fill="#ABFF7A" font-family="Arial,sans-serif">S</text>' +
  '</svg>'
)

let _iconDataUrl: string = FALLBACK_ICON

// Fetch the real PNG from the extension bundle and convert to a data URI.
// web_accessible_resources allows pages to fetch chrome-extension:// URLs.
;(async () => {
  try {
    const url = (globalThis as any).chrome?.runtime?.getURL('icons/icon128.png')
    if (!url) return
    const res = await fetch(url)
    const blob = await res.blob()
    _iconDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch { /* keep fallback */ }
})()

const walletStandardAccounts: any[] = []

const walletStandardObject = {
  version: '1.0.0' as const,
  name: 'SOLAI',
  get icon() { return _iconDataUrl },
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
          features: ['standard:connect', 'standard:disconnect', 'standard:events', 'solana:signAndSendTransaction', 'solana:signTransaction', 'solana:signMessage'],
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
      supportedTransactionVersions: new Set(['legacy', 0]) as ReadonlySet<'legacy' | 0>,
      async signAndSendTransaction(input: { transaction: Uint8Array; account: any; chain: string; options?: any }) {
        const result = await sendRequest('signAndSendTransaction', {
          transaction: Array.from(input.transaction),
          chain: input.chain,
          options: input.options,
        })
        return [{ signature: result.signature }]
      },
    },
    'solana:signTransaction': {
      version: '1.0.0',
      supportedTransactionVersions: new Set(['legacy', 0]) as ReadonlySet<'legacy' | 0>,
      async signTransaction(input: { transaction: Uint8Array; account: any; chain: string }) {
        const result = await sendRequest('signTransaction', {
          transaction: Array.from(input.transaction),
          chain: input.chain,
        })
        return [{ signedTransaction: new Uint8Array(result.signedTransaction) }]
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
  const e = event as CustomEvent<{ register: (wallet: typeof walletStandardObject) => void }>
  try { e.detail.register(walletStandardObject) } catch {}
})
