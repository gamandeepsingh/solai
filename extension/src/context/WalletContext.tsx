import { createContext, useContext, useState, useCallback, useRef, useMemo, type ReactNode } from 'react'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import type { WalletAccount, WalletEntry, Network } from '../types/wallet'
import { getLocal, setLocal, getSync, setSync, getSession, setSession, removeSession } from '../lib/storage'
import { unlockKeystore, createKeystore, generateMnemonic, mnemonicToKeypair, getMnemonicFromKeystore, validateMnemonic } from '../lib/wallet'

const SESSION_TTL = 30 * 60 * 1000

interface AddWalletParams {
  method: 'create' | 'import'
  name: string
  password: string
  mnemonic?: string
}

interface WalletContextValue {
  accounts: WalletEntry[]
  account: WalletAccount | null
  activeId: string | null
  keypair: nacl.SignKeyPair | null
  network: Network
  isLocked: boolean
  isLoading: boolean
  createWallet: (password: string) => Promise<string>
  importWallet: (mnemonic: string, password: string) => Promise<void>
  addWallet: (params: AddWalletParams) => Promise<string>
  switchWallet: (id: string) => Promise<void>
  renameWallet: (id: string, name: string) => Promise<void>
  removeWallet: (id: string) => Promise<void>
  unlock: (password: string) => Promise<void>
  lock: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  changePasswordFromMnemonic: (mnemonic: string, newPassword: string) => Promise<void>
  setNetwork: (n: Network) => void
  init: () => Promise<{ hasWallet: boolean }>
}

const WalletContext = createContext<WalletContextValue>(null!)

async function saveSession(keypairs: Record<string, nacl.SignKeyPair>) {
  const serialized: Record<string, number[]> = {}
  for (const [id, kp] of Object.entries(keypairs)) {
    serialized[id] = Array.from(kp.secretKey)
  }
  await setSession('walletSession', { keypairs: serialized, expiresAt: Date.now() + SESSION_TTL })
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<WalletEntry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [keypair, setKeypair] = useState<nacl.SignKeyPair | null>(null)
  const [network, setNetworkState] = useState<Network>('mainnet')
  const [isLocked, setIsLocked] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const keypairsMapRef = useRef<Record<string, nacl.SignKeyPair>>({})

  const account = useMemo<WalletAccount | null>(() => {
    const entry = accounts.find(a => a.id === activeId)
    if (!entry) return null
    return { name: entry.name, publicKey: entry.keystore.publicKey, keystore: entry.keystore }
  }, [accounts, activeId])

  const init = useCallback(async () => {
    const savedNetwork = await getSync('network')
    if (savedNetwork) setNetworkState(savedNetwork)

    let wallets = await getLocal('wallets')

    // Migrate from legacy single keystore
    if (!wallets?.length) {
      const legacyKeystore = await getLocal('keystore')
      if (!legacyKeystore) { setIsLoading(false); return { hasWallet: false } }
      const walletName = await getSync('walletName')
      const entry: WalletEntry = {
        id: crypto.randomUUID(),
        name: walletName ?? 'Wallet 1',
        keystore: legacyKeystore,
      }
      wallets = [entry]
      await setLocal('wallets', wallets)
      await setLocal('activeWalletId', entry.id)
    }

    const savedActiveId = await getLocal('activeWalletId') ?? wallets[0].id
    setAccounts(wallets)
    setActiveId(savedActiveId)

    // Restore session if valid (supports both new multi-wallet format and legacy single-key format)
    const rawSession = await chrome.storage.session.get('walletSession') as any
    const ws = rawSession?.walletSession
    let restoredMap: Record<string, nacl.SignKeyPair> | null = null

    if (ws && ws.expiresAt > Date.now()) {
      if (ws.keypairs) {
        // New format: { keypairs: Record<id, number[]>, expiresAt }
        const map: Record<string, nacl.SignKeyPair> = {}
        for (const [id, sk] of Object.entries(ws.keypairs as Record<string, number[]>)) {
          map[id] = nacl.sign.keyPair.fromSecretKey(new Uint8Array(sk))
        }
        restoredMap = map
      } else if (ws.secretKey) {
        // Legacy format: { secretKey: number[], expiresAt } — map to the migrated wallet ID
        const legacyKp = nacl.sign.keyPair.fromSecretKey(new Uint8Array(ws.secretKey as number[]))
        const legacyPub = bs58.encode(legacyKp.publicKey)
        const match = wallets.find(w => w.keystore.publicKey === legacyPub)
        if (match) restoredMap = { [match.id]: legacyKp }
      }
    }

    if (restoredMap && restoredMap[savedActiveId]) {
      keypairsMapRef.current = restoredMap
      setKeypair(restoredMap[savedActiveId])
      setIsLocked(false)
      await saveSession(restoredMap) // renew TTL + convert to new format
    } else {
      setIsLocked(true)
    }

    setIsLoading(false)
    return { hasWallet: true }
  }, [])

  const createWallet = useCallback(async (password: string): Promise<string> => {
    const mnemonic = generateMnemonic()
    const keystore = await createKeystore(mnemonic, password)
    const entry: WalletEntry = { id: crypto.randomUUID(), name: 'Wallet 1', keystore }
    await setLocal('wallets', [entry])
    await setLocal('activeWalletId', entry.id)
    const kp = await mnemonicToKeypair(mnemonic)
    keypairsMapRef.current = { [entry.id]: kp }
    await saveSession(keypairsMapRef.current)
    setAccounts([entry])
    setActiveId(entry.id)
    setKeypair(kp)
    setIsLocked(false)
    return mnemonic
  }, [])

  const importWallet = useCallback(async (mnemonic: string, password: string): Promise<void> => {
    const keystore = await createKeystore(mnemonic, password)
    const entry: WalletEntry = { id: crypto.randomUUID(), name: 'Wallet 1', keystore }
    await setLocal('wallets', [entry])
    await setLocal('activeWalletId', entry.id)
    const kp = await mnemonicToKeypair(mnemonic)
    keypairsMapRef.current = { [entry.id]: kp }
    await saveSession(keypairsMapRef.current)
    setAccounts([entry])
    setActiveId(entry.id)
    setKeypair(kp)
    setIsLocked(false)
  }, [])

  const addWallet = useCallback(async (params: AddWalletParams): Promise<string> => {
    const wallets = await getLocal('wallets') ?? []
    if (!wallets.length) throw new Error('No existing wallet')

    // Verify password by decrypting first wallet
    await unlockKeystore(wallets[0].keystore, params.password)

    const mnemonic = params.method === 'import' ? params.mnemonic! : generateMnemonic()
    const keystore = await createKeystore(mnemonic, params.password)
    const entry: WalletEntry = { id: crypto.randomUUID(), name: params.name, keystore }
    const updated = [...wallets, entry]
    await setLocal('wallets', updated)

    const kp = await mnemonicToKeypair(mnemonic)
    keypairsMapRef.current = { ...keypairsMapRef.current, [entry.id]: kp }
    await saveSession(keypairsMapRef.current)
    setAccounts(updated)
    return mnemonic
  }, [])

  const switchWallet = useCallback(async (id: string) => {
    await setLocal('activeWalletId', id)
    setActiveId(id)
    const kp = keypairsMapRef.current[id]
    if (kp) {
      setKeypair(kp)
      }
  }, [])

  const renameWallet = useCallback(async (id: string, name: string) => {
    const wallets = await getLocal('wallets') ?? []
    const updated = wallets.map(w => w.id === id ? { ...w, name } : w)
    await setLocal('wallets', updated)
    setAccounts(updated)
  }, [])

  const removeWallet = useCallback(async (id: string) => {
    const wallets = await getLocal('wallets') ?? []
    if (wallets.length <= 1) throw new Error("Can't remove the only wallet")
    const updated = wallets.filter(w => w.id !== id)
    await setLocal('wallets', updated)

    const { [id]: removed, ...restMap } = keypairsMapRef.current
    void removed
    keypairsMapRef.current = restMap

    const currentActiveId = await getLocal('activeWalletId')
    if (currentActiveId === id) {
      const newActive = updated[0]
      await setLocal('activeWalletId', newActive.id)
      setActiveId(newActive.id)
      setKeypair(restMap[newActive.id] ?? null)
    }

    await saveSession(restMap)
    setAccounts(updated)
  }, [])

  const unlock = useCallback(async (password: string): Promise<void> => {
    const wallets = await getLocal('wallets') ?? []
    if (!wallets.length) throw new Error('No wallet found')
    const map: Record<string, nacl.SignKeyPair> = {}
    for (const entry of wallets) {
      map[entry.id] = await unlockKeystore(entry.keystore, password)
    }
    keypairsMapRef.current = map
    await saveSession(map)

    const savedActiveId = await getLocal('activeWalletId') ?? wallets[0].id
    setActiveId(savedActiveId)
    setAccounts(wallets)
    const activeKp = map[savedActiveId]
    setKeypair(activeKp ?? null)
    setIsLocked(false)
  }, [])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<void> => {
    const wallets = await getLocal('wallets') ?? []
    if (!wallets.length) throw new Error('No wallet found')
    const updatedWallets = await Promise.all(
      wallets.map(async w => {
        const mnemonic = await getMnemonicFromKeystore(w.keystore, currentPassword)
        return { ...w, keystore: await createKeystore(mnemonic, newPassword) }
      })
    )
    await setLocal('wallets', updatedWallets)
    setAccounts(updatedWallets)
    await saveSession(keypairsMapRef.current)
  }, [])

  const changePasswordFromMnemonic = useCallback(async (mnemonic: string, newPassword: string): Promise<void> => {
    const wallets = await getLocal('wallets') ?? []
    if (!validateMnemonic(mnemonic)) throw new Error('Invalid recovery phrase — check all 12 words')
    const kp = await mnemonicToKeypair(mnemonic)
    const pub = bs58.encode(kp.publicKey)
    const match = wallets.find(w => w.keystore.publicKey === pub)
    if (!match) throw new Error('Mnemonic does not match any wallet in this account')
    const newKeystore = await createKeystore(mnemonic, newPassword)
    const updated = wallets.map(w => w.id === match.id ? { ...w, keystore: newKeystore } : w)
    await setLocal('wallets', updated)
    await unlock(newPassword)
  }, [unlock])

  const lock = useCallback(async () => {
    keypairsMapRef.current = {}
    setKeypair(null)
    setIsLocked(true)
    await removeSession('walletSession')
  }, [])

  const setNetwork = useCallback((n: Network) => {
    setNetworkState(n)
    setSync('network', n)
  }, [])

  return (
    <WalletContext.Provider value={{
      accounts, account, activeId, keypair, network, isLocked, isLoading,
      createWallet, importWallet, addWallet, switchWallet, renameWallet, removeWallet,
      unlock, lock, changePassword, changePasswordFromMnemonic, setNetwork, init,
    }}>
      {children}
    </WalletContext.Provider>
  )
}

export const useWallet = () => useContext(WalletContext)
