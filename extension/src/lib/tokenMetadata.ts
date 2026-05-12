import type { TokenMeta } from '../types/tokens'
import { getLocal, setLocal } from './storage'

const JUPITER_TOKEN_LIST = 'https://token.jup.ag/strict'
let _cache: Record<string, TokenMeta> | null = null

export async function getTokenMeta(mint: string): Promise<TokenMeta | null> {
  if (!_cache) {
    const stored = await getLocal('tokenMetadataCache')
    _cache = stored ?? {}
    if (Object.keys(_cache).length === 0) {
      await refreshTokenList()
    }
  }
  return _cache[mint] ?? null
}

export async function refreshTokenList(): Promise<void> {
  try {
    const res = await fetch(JUPITER_TOKEN_LIST)
    const tokens: any[] = await res.json()
    const map: Record<string, TokenMeta> = {}
    for (const t of tokens) {
      map[t.address] = {
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        mint: t.address,
        logoUri: t.logoURI ?? '',
        coingeckoId: t.extensions?.coingeckoId,
      }
    }
    _cache = map
    await setLocal('tokenMetadataCache', map)
  } catch {}
}

export function unknownTokenMeta(mint: string, decimals: number): TokenMeta {
  return {
    symbol: `${mint.slice(0, 4)}...`,
    name: 'Unknown Token',
    decimals,
    mint,
    logoUri: '',
  }
}
