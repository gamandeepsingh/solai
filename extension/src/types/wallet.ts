export type Network = 'mainnet' | 'devnet'

export interface EncryptedKeystore {
  version: 1
  salt: string
  iv: string
  ciphertext: string
  publicKey: string
}

export interface WalletEntry {
  id: string
  name: string
  type?: 'ledger'
  keystore?: EncryptedKeystore
  publicKey?: string
  ledgerPath?: string
}

export interface WalletAccount {
  name: string
  publicKey: string
  keystore?: EncryptedKeystore
  isLedger?: boolean
  ledgerPath?: string
}

export interface WalletState {
  account: WalletAccount | null
  keypair: { publicKey: Uint8Array; secretKey: Uint8Array } | null
  network: Network
  isLocked: boolean
  isLoading: boolean
}
