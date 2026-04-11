import type { EncryptedKeystore, Network, WalletEntry } from '../types/wallet'
import type { Contact } from '../types/contacts'
import type { ScheduledJob } from '../types/agent'
import type { ConditionalOrder } from '../types/orders'
import type { TxRecord } from '../types/history'
import type { NFTAsset } from '../types/nft'
import { encryptForStorage, decryptFromStorage } from './crypto'

type LocalData = {
  keystore: EncryptedKeystore        // legacy — kept for migration only
  wallets: WalletEntry[]             // multi-wallet list
  activeWalletId: string             // id of active wallet
  cachedSolBalance: number
  cachedUsdcBalance: number
  cachedUsdtBalance: number
  contacts: Contact[]
  scheduledJobs: ScheduledJob[]
  conditionalOrders: ConditionalOrder[]
  txLog: TxRecord[]
  failedLoginAttempts: number
  lockoutUntil: number
  openrouterApiKey: string
  tokenMetadataCache: Record<string, import('../types/tokens').TokenMeta>
  customNFTs: NFTAsset[]
  cachedSplBalances: Record<string, number>
  approvedOrigins: { origin: string; connectedAt: string }[]
}

type SyncData = {
  theme: 'light' | 'dark' | 'system'
  network: Network
  walletName: string
  customRpcUrl: string
}

export async function getLocal<K extends keyof LocalData>(key: K): Promise<LocalData[K] | undefined> {
  const raw: string | undefined = await new Promise(resolve => {
    chrome.storage.local.get(key, result => resolve(result[key]))
  })
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'string') return raw as LocalData[K]
  try {
    const decrypted = await decryptFromStorage(raw)
    return JSON.parse(decrypted) as LocalData[K]
  } catch {
    try { return JSON.parse(raw) as LocalData[K] } catch { return raw as LocalData[K] }
  }
}

export async function setLocal<K extends keyof LocalData>(key: K, value: LocalData[K]): Promise<void> {
  const encrypted = await encryptForStorage(JSON.stringify(value))
  return new Promise(resolve => chrome.storage.local.set({ [key]: encrypted }, resolve))
}

export async function removeLocal(key: keyof LocalData): Promise<void> {
  return new Promise(resolve => chrome.storage.local.remove(key as string, resolve))
}

export async function getSync<K extends keyof SyncData>(key: K): Promise<SyncData[K] | undefined> {
  return new Promise(resolve => {
    chrome.storage.sync.get(key, result => resolve(result[key]))
  })
}

export async function setSync<K extends keyof SyncData>(key: K, value: SyncData[K]): Promise<void> {
  return new Promise(resolve => chrome.storage.sync.set({ [key]: value }, resolve))
}

type SessionData = {
  walletSession: { keypairs: Record<string, number[]>; expiresAt: number }
  chatSession: { messages: unknown[]; expiresAt: number }
}

export async function getSession<K extends keyof SessionData>(key: K): Promise<SessionData[K] | undefined> {
  return new Promise(resolve => {
    chrome.storage.session.get(key, result => resolve(result[key]))
  })
}

export async function setSession<K extends keyof SessionData>(key: K, value: SessionData[K]): Promise<void> {
  return new Promise(resolve => chrome.storage.session.set({ [key]: value }, resolve))
}

export async function removeSession(key: keyof SessionData): Promise<void> {
  return new Promise(resolve => chrome.storage.session.remove(key as string, resolve))
}
