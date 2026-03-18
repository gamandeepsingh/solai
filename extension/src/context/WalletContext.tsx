import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import type { WalletAccount, Network } from '../types/wallet'
import { getLocal, setLocal, getSync, setSync } from '../lib/storage'
import { unlockKeystore, createKeystore, generateMnemonic, mnemonicToKeypair } from '../lib/wallet'
import { authenticate } from '../lib/api'

interface WalletContextValue {
  account: WalletAccount | null
  keypair: nacl.SignKeyPair | null
  network: Network
  isLocked: boolean
  isLoading: boolean
  createWallet: (password: string) => Promise<string>
  importWallet: (mnemonic: string, password: string) => Promise<void>
  unlock: (password: string) => Promise<void>
  lock: () => void
  setNetwork: (n: Network) => void
  init: () => Promise<{ hasWallet: boolean }>
}

const WalletContext = createContext<WalletContextValue>(null!)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<WalletAccount | null>(null)
  const [keypair, setKeypair] = useState<nacl.SignKeyPair | null>(null)
  const [network, setNetworkState] = useState<Network>('mainnet')
  const [isLocked, setIsLocked] = useState(true)
  const [isLoading, setIsLoading] = useState(true)

  const init = useCallback(async () => {
    const keystore = await getLocal('keystore')
    const savedNetwork = await getSync('network')
    const walletName = await getSync('walletName')
    if (savedNetwork) setNetworkState(savedNetwork)
    if (!keystore) { setIsLoading(false); return { hasWallet: false } }
    setAccount({ name: walletName ?? 'My Wallet', publicKey: keystore.publicKey, keystore })
    setIsLocked(true)
    setIsLoading(false)
    return { hasWallet: true }
  }, [])

  const createWallet = useCallback(async (password: string): Promise<string> => {
    const mnemonic = generateMnemonic()
    const keystore = await createKeystore(mnemonic, password)
    await setLocal('keystore', keystore)
    await setSync('walletName', 'My Wallet')
    const kp = await mnemonicToKeypair(mnemonic)
    setKeypair(kp)
    setAccount({ name: 'My Wallet', publicKey: keystore.publicKey, keystore })
    setIsLocked(false)
    try { await authenticate(kp) } catch {}
    return mnemonic
  }, [])

  const importWallet = useCallback(async (mnemonic: string, password: string): Promise<void> => {
    const keystore = await createKeystore(mnemonic, password)
    await setLocal('keystore', keystore)
    await setSync('walletName', 'My Wallet')
    const kp = await mnemonicToKeypair(mnemonic)
    setKeypair(kp)
    setAccount({ name: 'My Wallet', publicKey: keystore.publicKey, keystore })
    setIsLocked(false)
    try { await authenticate(kp) } catch {}
  }, [])

  const unlock = useCallback(async (password: string): Promise<void> => {
    const keystore = await getLocal('keystore')
    if (!keystore) throw new Error('No wallet found')
    const kp = await unlockKeystore(keystore, password)
    setKeypair(kp)
    setIsLocked(false)
    try { await authenticate(kp) } catch {}
  }, [])

  const lock = useCallback(() => {
    setKeypair(null)
    setIsLocked(true)
  }, [])

  const setNetwork = useCallback((n: Network) => {
    setNetworkState(n)
    setSync('network', n)
  }, [])

  return (
    <WalletContext.Provider value={{ account, keypair, network, isLocked, isLoading, createWallet, importWallet, unlock, lock, setNetwork, init }}>
      {children}
    </WalletContext.Provider>
  )
}

export const useWallet = () => useContext(WalletContext)
