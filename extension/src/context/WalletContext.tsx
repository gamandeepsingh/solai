import { createContext, useContext, useState, useCallback, useRef, useMemo, type ReactNode } from 'react'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import type { WalletAccount, WalletEntry, Network } from '../types/wallet'
import { getLocal, setLocal, removeLocal, getSync, setSync, getSession, setSession, removeSession } from '../lib/storage'
import { unlockKeystore, createKeystore, generateMnemonic, mnemonicToKeypair, getMnemonicFromKeystore, validateMnemonic } from '../lib/wallet'
import { getSolBalance, sendSol } from '../lib/solana'
import type { AgentWallet, AgentGuardrails } from '../types/agent'
import { LEDGER_DEFAULT_PATH } from '../lib/ledger'

const SESSION_TTL = 30 * 60 * 1000
const COLLECT_FEE_RESERVE = 0.000005

export interface StealthAddress {
  walletId: string
  index: number
  publicKey: string
  label: string
}

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
  stealthAddresses: StealthAddress[]
  createWallet: (password: string) => Promise<string>
  importWallet: (mnemonic: string, password: string) => Promise<void>
  addWallet: (params: AddWalletParams) => Promise<string>
  switchWallet: (id: string) => Promise<void>
  renameWallet: (id: string, name: string) => Promise<void>
  removeWallet: (id: string) => Promise<void>
  resetAllWallets: (password: string) => Promise<void>
  unlock: (password: string) => Promise<void>
  lock: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  changePasswordFromMnemonic: (mnemonic: string, newPassword: string) => Promise<void>
  setNetwork: (n: Network) => void
  init: () => Promise<{ hasWallet: boolean }>
  generateStealthAddress: (password: string, label: string) => Promise<string>
  collectFromStealth: (stealthPublicKey: string, password: string) => Promise<string>
  deleteStealthAddress: (stealthPublicKey: string) => Promise<void>
  agentWallets: AgentWallet[]
  createAgentWallet: (password: string, name: string, guardrails: AgentGuardrails) => Promise<AgentWallet>
  updateAgentGuardrails: (agentId: string, guardrails: AgentGuardrails) => Promise<void>
  toggleAgent: (agentId: string, enabled: boolean) => Promise<void>
  deleteAgentWallet: (agentId: string) => Promise<void>
  fundAgent: (agentId: string, amountSol: number) => Promise<string>
  collectFromAgent: (agentId: string, password: string) => Promise<string>
  isLedgerWallet: boolean
  addLedgerWallet: (name: string) => Promise<void>
}

const WalletContext = createContext<WalletContextValue>(null!)

async function saveSession(keypairs: Record<string, nacl.SignKeyPair>) {
  const serialized: Record<string, number[]> = {}
  for (const [id, kp] of Object.entries(keypairs)) {
    serialized[id] = Array.from(kp.secretKey)
  }
  await setSession('walletSession', { keypairs: serialized, expiresAt: Date.now() + SESSION_TTL })
}

async function saveAgentSession(keypairs: Record<string, nacl.SignKeyPair>) {
  const serialized: Record<string, number[]> = {}
  for (const [id, kp] of Object.entries(keypairs)) {
    serialized[id] = Array.from(kp.secretKey)
  }
  await setSession('agentSession', { keypairs: serialized, expiresAt: Date.now() + SESSION_TTL })
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<WalletEntry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [keypair, setKeypair] = useState<nacl.SignKeyPair | null>(null)
  const [network, setNetworkState] = useState<Network>('mainnet')
  const [isLocked, setIsLocked] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [stealthAddresses, setStealthAddresses] = useState<StealthAddress[]>([])
  const [agentWallets, setAgentWallets] = useState<AgentWallet[]>([])
  const keypairsMapRef = useRef<Record<string, nacl.SignKeyPair>>({})
  const addingWalletRef = useRef(false)

  const account = useMemo<WalletAccount | null>(() => {
    const entry = accounts.find(a => a.id === activeId)
    if (!entry) return null
    const publicKey = entry.type === 'ledger'
      ? (entry.publicKey ?? '')
      : (entry.keystore?.publicKey ?? '')
    return {
      name: entry.name,
      publicKey,
      keystore: entry.keystore,
      isLedger: entry.type === 'ledger',
      ledgerPath: entry.ledgerPath ?? LEDGER_DEFAULT_PATH,
    }
  }, [accounts, activeId])

  const isLedgerWallet = useMemo(() => {
    return accounts.find(a => a.id === activeId)?.type === 'ledger'
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

    const activeEntry = wallets.find(w => w.id === savedActiveId)
    if (activeEntry?.type === 'ledger') {
      setIsLocked(false)
    } else if (restoredMap && restoredMap[savedActiveId]) {
      keypairsMapRef.current = restoredMap
      setKeypair(restoredMap[savedActiveId])
      setIsLocked(false)
      await saveSession(restoredMap) // renew TTL + convert to new format
    } else {
      setIsLocked(true)
    }

    const savedStealth = await getLocal('stealthAddresses')
    if (savedStealth) setStealthAddresses(savedStealth)

    const savedAgentWallets = await getLocal('agentWallets') ?? []
    setAgentWallets(savedAgentWallets)

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
    if (addingWalletRef.current) throw new Error('Already adding a wallet')
    addingWalletRef.current = true
    try {
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
    } finally {
      addingWalletRef.current = false
    }
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

  const resetAllWallets = useCallback(async (password: string): Promise<void> => {
    const wallets = await getLocal('wallets') ?? []
    if (!wallets.length) throw new Error('No wallet found')
    await unlockKeystore(wallets[0].keystore, password)
    await removeLocal('wallets')
    await removeLocal('activeWalletId')
    await removeSession('walletSession')
    keypairsMapRef.current = {}
    setAccounts([])
    setActiveId(null)
    setKeypair(null)
    setStealthAddresses([])
    setIsLocked(true)
  }, [])

  const generateStealthAddress = useCallback(async (password: string, label: string): Promise<string> => {
    const wallets = await getLocal('wallets') ?? []
    if (!wallets.length) throw new Error('No wallet found')
    const currentActiveId = await getLocal('activeWalletId')
    const activeEntry = wallets.find(w => w.id === currentActiveId) ?? wallets[0]
    const mnemonic = await getMnemonicFromKeystore(activeEntry.keystore, password)
    const existing = (await getLocal('stealthAddresses') ?? []).filter(s => s.walletId === activeEntry.id)
    const gap = Math.floor(Math.random() * 50) + 1
    const nextIndex = existing.length > 0 ? Math.max(...existing.map(s => s.index)) + gap : gap
    const kp = await mnemonicToKeypair(mnemonic, nextIndex)
    const publicKey = bs58.encode(kp.publicKey)
    const newEntry: StealthAddress = { walletId: activeEntry.id, index: nextIndex, publicKey, label }
    const allStealth = await getLocal('stealthAddresses') ?? []
    const updated = [...allStealth, newEntry]
    await setLocal('stealthAddresses', updated)
    setStealthAddresses(updated)
    return publicKey
  }, [])

  const deleteStealthAddress = useCallback(async (stealthPublicKey: string): Promise<void> => {
    const allStealth = await getLocal('stealthAddresses') ?? []
    const updated = allStealth.filter(s => s.publicKey !== stealthPublicKey)
    await setLocal('stealthAddresses', updated)
    setStealthAddresses(updated)
  }, [])

  const collectFromStealth = useCallback(async (stealthPublicKey: string, password: string): Promise<string> => {
    const allStealth = await getLocal('stealthAddresses') ?? []
    const entry = allStealth.find(s => s.publicKey === stealthPublicKey)
    if (!entry) throw new Error('Stealth address not found')
    const wallets = await getLocal('wallets') ?? []
    const walletEntry = wallets.find(w => w.id === entry.walletId)
    if (!walletEntry) throw new Error('Wallet not found')
    const mnemonic = await getMnemonicFromKeystore(walletEntry.keystore, password)
    const stealthKp = await mnemonicToKeypair(mnemonic, entry.index)
    const balance = await getSolBalance(stealthPublicKey, network)
    const sendable = balance - COLLECT_FEE_RESERVE
    if (sendable <= 0) throw new Error('Insufficient balance in stealth address')
    const mainPublicKey = walletEntry.keystore.publicKey
    return sendSol(stealthKp, mainPublicKey, sendable, network)
  }, [network])

  const unlock = useCallback(async (password: string): Promise<void> => {
    const wallets = await getLocal('wallets') ?? []
    if (!wallets.length) throw new Error('No wallet found')
    const map: Record<string, nacl.SignKeyPair> = {}
    for (const entry of wallets) {
      if (entry.type === 'ledger' || !entry.keystore) continue
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

    const agentList = await getLocal('agentWallets') ?? []
    const agentMap: Record<string, nacl.SignKeyPair> = {}
    for (const agent of agentList) {
      const walletEntry = wallets.find(w => w.id === agent.walletId)
      if (!walletEntry) continue
      const mnemonic = await getMnemonicFromKeystore(walletEntry.keystore, password)
      agentMap[agent.id] = await mnemonicToKeypair(mnemonic, agent.index)
    }
    if (Object.keys(agentMap).length > 0) await saveAgentSession(agentMap)
    setAgentWallets(agentList)
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

  const createAgentWallet = useCallback(async (password: string, name: string, guardrails: AgentGuardrails): Promise<AgentWallet> => {
    const wallets = await getLocal('wallets') ?? []
    const currentActiveId = await getLocal('activeWalletId')
    const activeEntry = wallets.find(w => w.id === currentActiveId) ?? wallets[0]
    if (!activeEntry) throw new Error('No wallet found')
    const mnemonic = await getMnemonicFromKeystore(activeEntry.keystore, password)
    const allAgents = await getLocal('agentWallets') ?? []
    const myAgents = allAgents.filter(a => a.walletId === activeEntry.id)
    const nextIndex = myAgents.length > 0 ? Math.max(...myAgents.map(a => a.index)) + 1 : 1000
    const kp = await mnemonicToKeypair(mnemonic, nextIndex)
    const publicKey = (await import('bs58')).default.encode(kp.publicKey)
    const newAgent: AgentWallet = {
      id: crypto.randomUUID(),
      walletId: activeEntry.id,
      index: nextIndex,
      publicKey,
      name,
      enabled: true,
      guardrails,
      stats: { totalSpentSol: 0, dailySpentSol: 0, dailyResetAt: 0, lastPaymentAt: 0, txCount: 0 },
    }
    const updated = [...allAgents, newAgent]
    await setLocal('agentWallets', updated)
    setAgentWallets(updated)
    const rawSession = await chrome.storage.session.get('agentSession') as any
    const existing = rawSession?.agentSession
    const existingMap: Record<string, nacl.SignKeyPair> = {}
    if (existing?.keypairs) {
      for (const [id, sk] of Object.entries(existing.keypairs as Record<string, number[]>)) {
        existingMap[id] = nacl.sign.keyPair.fromSecretKey(new Uint8Array(sk))
      }
    }
    existingMap[newAgent.id] = kp
    await saveAgentSession(existingMap)
    return newAgent
  }, [])

  const updateAgentGuardrails = useCallback(async (agentId: string, guardrails: AgentGuardrails): Promise<void> => {
    const allAgents = await getLocal('agentWallets') ?? []
    const updated = allAgents.map(a => a.id === agentId ? { ...a, guardrails } : a)
    await setLocal('agentWallets', updated)
    setAgentWallets(updated)
  }, [])

  const toggleAgent = useCallback(async (agentId: string, enabled: boolean): Promise<void> => {
    const allAgents = await getLocal('agentWallets') ?? []
    const updated = allAgents.map(a => a.id === agentId ? { ...a, enabled } : a)
    await setLocal('agentWallets', updated)
    setAgentWallets(updated)
  }, [])

  const deleteAgentWallet = useCallback(async (agentId: string): Promise<void> => {
    const allAgents = await getLocal('agentWallets') ?? []
    const updated = allAgents.filter(a => a.id !== agentId)
    await setLocal('agentWallets', updated)
    setAgentWallets(updated)
    const rawSession = await chrome.storage.session.get('agentSession') as any
    const existing = rawSession?.agentSession
    if (existing?.keypairs) {
      const { [agentId]: _removed, ...rest } = existing.keypairs
      void _removed
      await chrome.storage.session.set({ agentSession: { keypairs: rest, expiresAt: existing.expiresAt } })
    }
  }, [])

  const fundAgent = useCallback(async (agentId: string, amountSol: number): Promise<string> => {
    if (!keypair) throw new Error('Wallet is locked')
    const allAgents = await getLocal('agentWallets') ?? []
    const agent = allAgents.find(a => a.id === agentId)
    if (!agent) throw new Error('Agent not found')
    return sendSol(keypair, agent.publicKey, amountSol, network)
  }, [keypair, network])

  const addLedgerWallet = useCallback(async (name: string): Promise<void> => {
    const { getLedgerPublicKey } = await import('../lib/ledger')
    const publicKey = await getLedgerPublicKey(LEDGER_DEFAULT_PATH, true)
    const wallets = await getLocal('wallets') ?? []
    const entry = {
      id: crypto.randomUUID(),
      name,
      type: 'ledger' as const,
      publicKey,
      ledgerPath: LEDGER_DEFAULT_PATH,
    }
    const updated = [...wallets, entry]
    await setLocal('wallets', updated)
    await setLocal('activeWalletId', entry.id)
    setAccounts(updated)
    setActiveId(entry.id)
    setKeypair(null)
    setIsLocked(false)
  }, [])

  const collectFromAgent = useCallback(async (agentId: string, password: string): Promise<string> => {
    const allAgents = await getLocal('agentWallets') ?? []
    const agent = allAgents.find(a => a.id === agentId)
    if (!agent) throw new Error('Agent not found')
    const wallets = await getLocal('wallets') ?? []
    const walletEntry = wallets.find(w => w.id === agent.walletId)
    if (!walletEntry) throw new Error('Wallet not found')
    const mnemonic = await getMnemonicFromKeystore(walletEntry.keystore, password)
    const agentKp = await mnemonicToKeypair(mnemonic, agent.index)
    const balance = await getSolBalance(agent.publicKey, network)
    const sendable = balance - COLLECT_FEE_RESERVE
    if (sendable <= 0) throw new Error('Insufficient balance in agent wallet')
    const mainPublicKey = walletEntry.keystore.publicKey
    const sig = await sendSol(agentKp, mainPublicKey, sendable, network)
    const updated = allAgents.map(a => a.id === agentId
      ? { ...a, stats: { ...a.stats, dailySpentSol: 0, lastPaymentAt: Date.now() } }
      : a
    )
    await setLocal('agentWallets', updated)
    setAgentWallets(updated)
    return sig
  }, [network])

  const lock = useCallback(async () => {
    for (const kp of Object.values(keypairsMapRef.current)) {
      kp.secretKey.fill(0)
    }
    keypairsMapRef.current = {}
    setKeypair(null)
    setIsLocked(true)
    await removeSession('walletSession')
    await removeSession('agentSession')
  }, [])

  const setNetwork = useCallback((n: Network) => {
    setNetworkState(n)
    setSync('network', n)
  }, [])

  return (
    <WalletContext.Provider value={{
      accounts, account, activeId, keypair, network, isLocked, isLoading,
      stealthAddresses,
      createWallet, importWallet, addWallet, switchWallet, renameWallet, removeWallet,
      resetAllWallets,
      unlock, lock, changePassword, changePasswordFromMnemonic, setNetwork, init,
      generateStealthAddress, collectFromStealth, deleteStealthAddress,
      agentWallets,
      createAgentWallet, updateAgentGuardrails, toggleAgent, deleteAgentWallet,
      fundAgent, collectFromAgent,
      isLedgerWallet, addLedgerWallet,
    }}>
      {children}
    </WalletContext.Provider>
  )
}

export const useWallet = () => useContext(WalletContext)
