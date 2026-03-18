const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price'

export interface PriceMap {
  SOL: number
  USDC: number
}

export async function fetchPrices(): Promise<PriceMap> {
  const res = await fetch(`${COINGECKO_URL}?ids=solana,usd-coin&vs_currencies=usd`)
  if (!res.ok) throw new Error('Failed to fetch prices')
  const data = await res.json()
  return {
    SOL: data.solana?.usd ?? 0,
    USDC: data['usd-coin']?.usd ?? 1,
  }
}

export async function convertUsdToToken(usdAmount: number, token: 'SOL' | 'USDC'): Promise<number> {
  const prices = await fetchPrices()
  return usdAmount / prices[token]
}

export async function getSolPrice(): Promise<number> {
  const prices = await fetchPrices()
  return prices.SOL
}
