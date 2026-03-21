import type { EncryptedKeystore, Network, WalletEntry } from '../types/wallet'
import type { Contact } from '../types/contacts'
import type { ScheduledJob } from '../types/agent'
import type { ConditionalOrder } from '../types/orders'
import type { TxRecord } from '../types/history'

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
}

type SyncData = {
  theme: 'light' | 'dark'
  network: Network
  openrouterApiKey: string
  walletName: string
  customRpcUrl: string
}

export async function getLocal<K extends keyof LocalData>(key: K): Promise<LocalData[K] | undefined> {
  return new Promise(resolve => {
    chrome.storage.local.get(key, result => resolve(result[key]))
  })
}

export async function setLocal<K extends keyof LocalData>(key: K, value: LocalData[K]): Promise<void> {
  return new Promise(resolve => chrome.storage.local.set({ [key]: value }, resolve))
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
