import * as bip39 from 'bip39'
import { derivePath } from 'ed25519-hd-key'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { encrypt, decrypt } from './crypto'
import type { EncryptedKeystore } from '../types/wallet'

const DERIVATION_PATH = "m/44'/501'/0'/0'"

export function generateMnemonic(): string {
  return bip39.generateMnemonic(128)
}

export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic)
}

function toHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function mnemonicToKeypair(mnemonic: string): Promise<nacl.SignKeyPair> {
  const seed = await bip39.mnemonicToSeed(mnemonic)
  const derived = derivePath(DERIVATION_PATH, toHex(new Uint8Array(seed)))
  return nacl.sign.keyPair.fromSeed(derived.key)
}

export async function createKeystore(mnemonic: string, password: string): Promise<EncryptedKeystore> {
  const keypair = await mnemonicToKeypair(mnemonic)
  const { salt, iv, ciphertext } = await encrypt(mnemonic, password)
  return {
    version: 1,
    salt,
    iv,
    ciphertext,
    publicKey: bs58.encode(keypair.publicKey),
  }
}

export async function getMnemonicFromKeystore(keystore: EncryptedKeystore, password: string): Promise<string> {
  try {
    return await decrypt(keystore.salt, keystore.iv, keystore.ciphertext, password)
  } catch {
    throw new Error('Incorrect password')
  }
}

export async function unlockKeystore(keystore: EncryptedKeystore, password: string): Promise<nacl.SignKeyPair> {
  const mnemonic = await getMnemonicFromKeystore(keystore, password)
  return mnemonicToKeypair(mnemonic)
}

export function signMessage(message: Uint8Array, secretKey: Uint8Array): Uint8Array {
  return nacl.sign.detached(message, secretKey)
}

export function verifyMessage(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
  return nacl.sign.detached.verify(message, signature, publicKey)
}
