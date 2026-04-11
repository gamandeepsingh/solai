import type { Network } from '../types/wallet'
import type { TokenMeta } from '../types/tokens'

// ─── Network-specific mints ────────────────────────────────────────────────

export const USDC_MINT: Record<Network, string> = {
  mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  devnet:  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
}

export const USDT_MINT: Record<Network, string> = {
  mainnet: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  devnet:  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
}

// ─── Token logos ───────────────────────────────────────────────────────────

const CDN = 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet'

// ─── Individual token metas (mainnet mints) ────────────────────────────────

export const SOL_META: TokenMeta = {
  symbol: 'SOL',
  name: 'Solana',
  decimals: 9,
  mint: 'So11111111111111111111111111111111111111112',
  logoUri: `${CDN}/So11111111111111111111111111111111111111112/logo.png`,
  coingeckoId: 'solana',
}

export const USDC_META: TokenMeta = {
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  logoUri: `${CDN}/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png`,
  coingeckoId: 'usd-coin',
}

export const USDT_META: TokenMeta = {
  symbol: 'USDT',
  name: 'Tether USD',
  decimals: 6,
  mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  logoUri: `${CDN}/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg`,
  coingeckoId: 'tether',
}

export const JUP_META: TokenMeta = {
  symbol: 'JUP',
  name: 'Jupiter',
  decimals: 6,
  mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  logoUri: 'https://static.jup.ag/jup/icon.png',
  coingeckoId: 'jupiter-exchange-solana',
}

export const BONK_META: TokenMeta = {
  symbol: 'BONK',
  name: 'Bonk',
  decimals: 5,
  mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  logoUri: `${CDN}/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/logo.png`,
  coingeckoId: 'bonk',
}

export const PYTH_META: TokenMeta = {
  symbol: 'PYTH',
  name: 'Pyth Network',
  decimals: 6,
  mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  logoUri: 'https://pyth.network/token.svg',
  coingeckoId: 'pyth-network',
}

export const HNT_META: TokenMeta = {
  symbol: 'HNT',
  name: 'Helium',
  decimals: 8,
  mint: 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux',
  logoUri: `${CDN}/hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux/logo.png`,
  coingeckoId: 'helium',
}

export const RAY_META: TokenMeta = {
  symbol: 'RAY',
  name: 'Raydium',
  decimals: 6,
  mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  logoUri: `${CDN}/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png`,
  coingeckoId: 'raydium',
}

export const JTO_META: TokenMeta = {
  symbol: 'JTO',
  name: 'Jito',
  decimals: 9,
  mint: 'jtojtomepa8bdBCVqzm8E6cXB6zyRsGAbKp5RaGKimNV',
  logoUri: 'https://www.jito.network/static/images/jito-mark.svg',
  coingeckoId: 'jito-governance-token',
}

export const ORCA_META: TokenMeta = {
  symbol: 'ORCA',
  name: 'Orca',
  decimals: 6,
  mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  logoUri: `${CDN}/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png`,
  coingeckoId: 'orca',
}

export const GMT_META: TokenMeta = {
  symbol: 'GMT',
  name: 'STEPN',
  decimals: 9,
  mint: '7i5KKsX2weiTkry7jA4ZwSuXGhs5eJBEjY8vVxR4pfRx',
  logoUri: `${CDN}/7i5KKsX2weiTkry7jA4ZwSuXGhs5eJBEjY8vVxR4pfRx/logo.png`,
  coingeckoId: 'stepn',
}

export const SRM_META: TokenMeta = {
  symbol: 'SRM',
  name: 'Serum',
  decimals: 6,
  mint: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
  logoUri: `${CDN}/SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt/logo.png`,
  coingeckoId: 'serum',
}

export const COPE_META: TokenMeta = {
  symbol: 'COPE',
  name: 'Cope',
  decimals: 6,
  mint: '8HGyAAB1yoM1ttS7pXjHMa3dukTFGQggnFFH3hJZgzQh',
  logoUri: `${CDN}/8HGyAAB1yoM1ttS7pXjHMa3dukTFGQggnFFH3hJZgzQh/logo.png`,
  coingeckoId: 'cope',
}

// ─── Full curated token list (order = display order) ──────────────────────

export const CURATED_TOKENS: TokenMeta[] = [
  SOL_META,
  USDC_META,
  USDT_META,
  JUP_META,
  BONK_META,
  PYTH_META,
  HNT_META,
  RAY_META,
  JTO_META,
  ORCA_META,
  GMT_META,
  SRM_META,
  COPE_META,
]

/** Returns the correct mint for a given token+network (USDC/USDT differ on devnet) */
export function getMintForNetwork(meta: TokenMeta, network: Network): string {
  if (meta.symbol === 'USDC') return USDC_MINT[network]
  if (meta.symbol === 'USDT') return USDT_MINT[network]
  return meta.mint
}

// Legacy export — keeps old import paths working
export const SUPPORTED_TOKENS: TokenMeta[] = [SOL_META, USDC_META, USDT_META]
