function hexEncode(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexDecode(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string length')
  if (hex.length > 0 && !/^[0-9a-fA-F]+$/.test(hex)) throw new Error('Invalid hex characters')
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return arr
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encrypt(plaintext: string, password: string): Promise<{ salt: string; iv: string; ciphertext: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const enc = new TextEncoder()
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext))
  return {
    salt: hexEncode(salt),
    iv: hexEncode(iv),
    ciphertext: hexEncode(new Uint8Array(encrypted)),
  }
}

export async function decrypt(salt: string, iv: string, ciphertext: string, password: string): Promise<string> {
  const key = await deriveKey(password, hexDecode(salt))
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: hexDecode(iv) },
    key,
    hexDecode(ciphertext)
  )
  return new TextDecoder().decode(decrypted)
}

// ─── Per-install storage key ────────────────────────────────────────────────
// Each browser installation gets a unique random AES-256 key stored in local
// storage. This means data from one install cannot be decrypted by anyone who
// only has the extension source code.
//
// Migration: if decryption with the install key fails, we try the legacy
// hardcoded key so existing users keep their data. The next write will use
// the new key, migrating fields lazily.

const LEGACY_KEY_BYTES = new Uint8Array([
  0xa3,0x7f,0x2c,0x91,0xe4,0x58,0x0d,0xb6,0x33,0x7a,0xc5,0x1e,0x94,0x62,0xf0,0x27,
  0x8b,0x4d,0xe9,0x15,0x73,0xc0,0x6a,0x3f,0xd8,0x52,0xab,0x1c,0x90,0xe7,0x44,0x5b,
])

let _installKey: CryptoKey | null = null
let _legacyKey: CryptoKey | null = null

async function getInstallKey(): Promise<CryptoKey> {
  if (_installKey) return _installKey
  const stored = await new Promise<any>(resolve => chrome.storage.local.get('_ik', resolve))
  let keyBytes: Uint8Array
  if (stored._ik && Array.isArray(stored._ik) && stored._ik.length === 32) {
    keyBytes = new Uint8Array(stored._ik)
  } else {
    keyBytes = crypto.getRandomValues(new Uint8Array(32))
    await new Promise<void>(resolve => chrome.storage.local.set({ _ik: Array.from(keyBytes) }, resolve))
  }
  _installKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  return _installKey
}

async function getLegacyKey(): Promise<CryptoKey> {
  if (_legacyKey) return _legacyKey
  _legacyKey = await crypto.subtle.importKey('raw', LEGACY_KEY_BYTES, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  return _legacyKey
}

const ENC_PREFIX = 'ENC1:'

export async function encryptForStorage(value: string): Promise<string> {
  const key = await getInstallKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value))
  return ENC_PREFIX + hexEncode(iv) + ':' + hexEncode(new Uint8Array(encrypted))
}

export async function decryptFromStorage(value: string): Promise<string> {
  if (!value.startsWith(ENC_PREFIX)) return value
  const rest = value.slice(ENC_PREFIX.length)
  const colonIdx = rest.indexOf(':')
  const iv = hexDecode(rest.slice(0, colonIdx))
  const ciphertext = hexDecode(rest.slice(colonIdx + 1))
  // Try per-install key first
  try {
    const key = await getInstallKey()
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    return new TextDecoder().decode(decrypted)
  } catch {
    // Fall back to legacy key for existing-user migration (next write will use new key)
    const legacyKey = await getLegacyKey()
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, legacyKey, ciphertext)
    return new TextDecoder().decode(decrypted)
  }
}
