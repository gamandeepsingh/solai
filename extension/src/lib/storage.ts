import type { EncryptedKeystore, Network } from '../types/wallet'
import type { Contact } from '../types/contacts'

type LocalData = {
  keystore: EncryptedKeystore
  cachedSolBalance: number
  cachedUsdcBalance: number
  jwtToken: string
  contacts: Contact[]
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
