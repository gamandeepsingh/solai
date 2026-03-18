import bs58 from 'bs58'
import nacl from 'tweetnacl'
import { getLocal, setLocal } from './storage'
import type { Contact } from '../types/contacts'

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

export async function fetchContacts(): Promise<Contact[]> {
  try {
    const res = await fetchWithAuth('/contacts')
    if (!res.ok) throw new Error('Failed to fetch contacts')
    return res.json()
  } catch {
    const cached = await getLocal('contacts')
    return cached ?? []
  }
}

export async function createContact(data: Omit<Contact, '_id' | 'createdAt'>): Promise<Contact> {
  const res = await fetchWithAuth('/contacts', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create contact')
  return res.json()
}

export async function updateContact(id: string, data: Partial<Omit<Contact, '_id' | 'createdAt'>>): Promise<Contact> {
  const res = await fetchWithAuth(`/contacts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update contact')
  return res.json()
}

export async function deleteContact(id: string): Promise<void> {
  const res = await fetchWithAuth(`/contacts/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete contact')
}
