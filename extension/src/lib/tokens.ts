import type { Network } from '../types/wallet'
import type { TokenMeta } from '../types/tokens'

export const USDC_MINT: Record<Network, string> = {
  mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  testnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
}

export const SOL_META: TokenMeta = {
  symbol: 'SOL',
  name: 'Solana',
  decimals: 9,
  mint: 'So11111111111111111111111111111111111111112',
  logoUri: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  coingeckoId: 'solana',
}

export const USDC_META: TokenMeta = {
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  logoUri: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  coingeckoId: 'usd-coin',
}

export const SUPPORTED_TOKENS: TokenMeta[] = [SOL_META, USDC_META]
