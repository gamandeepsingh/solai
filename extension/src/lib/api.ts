import bs58 from 'bs58'
import nacl from 'tweetnacl'
import { getLocal, setLocal } from './storage'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

async function getHeaders(): Promise<Record<string, string>> {
  const token = await getLocal('jwtToken')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function fetchWithAuth(path: string, init?: RequestInit) {
  const headers = await getHeaders()
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } })
  if (res.status === 401) {
    await setLocal('jwtToken', '' as any)
    throw new Error('Unauthorized')
  }
  return res
}

export async function authenticate(keypair: nacl.SignKeyPair): Promise<void> {
  const timestamp = Date.now()
  const message = new TextEncoder().encode(`solai-auth-${timestamp}`)
  const signature = nacl.sign.detached(message, keypair.secretKey)
  const publicKey = bs58.encode(keypair.publicKey)

  const res = await fetch(`${API_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey,
      timestamp,
      signature: bs58.encode(signature),
    }),
  })

  if (!res.ok) throw new Error('Auth failed')
  const { token } = await res.json()
  await setLocal('jwtToken', token)
}


