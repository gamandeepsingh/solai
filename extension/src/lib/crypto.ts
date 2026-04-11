function hexEncode(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexDecode(hex: string): Uint8Array {
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

// Fixed obfuscation key (AES-256) — prevents casual inspection of chrome.storage via DevTools.
// This is obfuscation, not encryption: the key is in the source bundle.
const STORAGE_KEY_BYTES = new Uint8Array([
  0xa3,0x7f,0x2c,0x91,0xe4,0x58,0x0d,0xb6,0x33,0x7a,0xc5,0x1e,0x94,0x62,0xf0,0x27,
  0x8b,0x4d,0xe9,0x15,0x73,0xc0,0x6a,0x3f,0xd8,0x52,0xab,0x1c,0x90,0xe7,0x44,0x5b,
])

let _storageKey: CryptoKey | null = null
async function getStorageKey(): Promise<CryptoKey> {
  if (_storageKey) return _storageKey
  _storageKey = await crypto.subtle.importKey('raw', STORAGE_KEY_BYTES, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  return _storageKey
}

const ENC_PREFIX = 'ENC1:'

export async function encryptForStorage(value: string): Promise<string> {
  const key = await getStorageKey()
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
  const key = await getStorageKey()
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(decrypted)
}
