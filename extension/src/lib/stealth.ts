import * as bip39 from 'bip39'
import { derivePath } from 'ed25519-hd-key'
import nacl from 'tweetnacl'
import bs58 from 'bs58'

const STEALTH_PATH = "m/44'/501'/9999'/0'"
const META_PREFIX = 'solai:stealth:v1:'

function toHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data))
}

/**
 * Derive a Curve25519 (X25519) keypair from the wallet mnemonic.
 * Uses a dedicated BIP44 path that won't collide with Solana signing keys.
 */
export async function deriveStealthX25519(mnemonic: string): Promise<{ priv: Uint8Array; pub: Uint8Array }> {
  const seed = await bip39.mnemonicToSeed(mnemonic)
  const derived = derivePath(STEALTH_PATH, toHex(new Uint8Array(seed)))
  const kp = nacl.box.keyPair.fromSecretKey(derived.key)
  return { priv: kp.secretKey, pub: kp.publicKey }
}

/**
 * Encode an X25519 public key + main Solana address as a shareable meta-address string.
 * Format: "solai:stealth:v1:<base58(xPub)>:<base58(mainPubKey)>"
 * The main address is included so senders know where to send the announcement dust.
 */
export function encodeMetaAddress(xPub: Uint8Array, mainPubKey: string): string {
  return META_PREFIX + bs58.encode(xPub) + ':' + mainPubKey
}

/**
 * Parse a meta-address string back to { xPub, mainAddress }.
 * Returns null if the string is not a valid SOLAI stealth meta-address.
 */
export function parseMetaAddress(str: string): { xPub: Uint8Array; mainAddress: string } | null {
  if (!str.startsWith(META_PREFIX)) return null
  try {
    const rest = str.slice(META_PREFIX.length).trim()
    if (!rest) return null
    const colonIdx = rest.indexOf(':')
    if (colonIdx === -1) return null
    const xPubEncoded = rest.slice(0, colonIdx)
    const mainAddress = rest.slice(colonIdx + 1)
    const xPub = bs58.decode(xPubEncoded)
    if (xPub.length !== 32 || !mainAddress) return null
    return { xPub, mainAddress }
  } catch {
    return null
  }
}

/** X25519 ECDH — shared secret between myPriv and theirPub. */
export function computeSharedSecret(myPriv: Uint8Array, theirPub: Uint8Array): Uint8Array {
  return nacl.scalarMult(myPriv, theirPub)
}

/**
 * Derive a one-time Ed25519 stealth keypair from a shared secret and ephemeral pub.
 * seed = SHA256(sharedSecret ++ ephemeralPub)
 */
export async function deriveStealthKeypair(
  sharedSecret: Uint8Array,
  ephemeralPub: Uint8Array,
): Promise<nacl.SignKeyPair> {
  const combined = new Uint8Array(sharedSecret.length + ephemeralPub.length)
  combined.set(sharedSecret)
  combined.set(ephemeralPub, sharedSecret.length)
  const seed = await sha256(combined)
  return nacl.sign.keyPair.fromSeed(seed)
}

/**
 * SENDER: given a recipient's meta-address, compute a unique one-time stealth address.
 * Returns the stealth address (base58 Ed25519 pubkey) + ephemeral pubkey for announcement.
 * Each call produces a different stealth address — no address reuse.
 */
export async function deriveSenderStealthParams(metaAddress: string): Promise<{
  stealthAddress: string
  ephemeralPub: string
  recipientMainAddress: string
}> {
  const parsed = parseMetaAddress(metaAddress)
  if (!parsed) throw new Error('Invalid meta-address')

  const ephemeral = nacl.box.keyPair()         // fresh X25519 ephemeral keypair
  const shared = computeSharedSecret(ephemeral.secretKey, parsed.xPub)
  const stealthKp = await deriveStealthKeypair(shared, ephemeral.publicKey)

  return {
    stealthAddress: bs58.encode(stealthKp.publicKey),
    ephemeralPub: bs58.encode(ephemeral.publicKey),
    recipientMainAddress: parsed.mainAddress,
  }
}

/**
 * RECIPIENT: given an ephemeral pub key from an announcement and the recipient's X25519 private key,
 * re-derive the stealth keypair. Call getSolBalance on the result to detect incoming stealth payments.
 */
export async function tryDecodeAnnouncement(
  ephemeralPubBase58: string,
  xPriv: Uint8Array,
): Promise<{ stealthAddress: string; keypair: nacl.SignKeyPair }> {
  const ephemeralPub = bs58.decode(ephemeralPubBase58)
  const shared = computeSharedSecret(xPriv, ephemeralPub)
  const stealthKp = await deriveStealthKeypair(shared, ephemeralPub)
  return {
    stealthAddress: bs58.encode(stealthKp.publicKey),
    keypair: stealthKp,
  }
}
