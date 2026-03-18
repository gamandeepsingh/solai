export interface TokenMeta {
  symbol: string
  name: string
  decimals: number
  mint: string
  logoUri: string
  coingeckoId?: string
}

export interface TokenBalance {
  meta: TokenMeta
  amount: number
  usdValue?: number
  change24h?: number
}
