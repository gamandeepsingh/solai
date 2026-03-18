export type Network = 'mainnet' | 'devnet'

export interface EncryptedKeystore {
  version: 1
  salt: string
  iv: string
  ciphertext: string
  publicKey: string
}

export interface WalletAccount {
  name: string
  publicKey: string
  keystore: EncryptedKeystore
}

export interface WalletState {
  account: WalletAccount | null
  keypair: { publicKey: Uint8Array; secretKey: Uint8Array } | null
  network: Network
  isLocked: boolean
  isLoading: boolean
}
