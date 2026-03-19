const BASE = 'https://api.coingecko.com/api/v3'
const CG_KEY = import.meta.env.VITE_COINGECKO_API_KEY as string | undefined

function cgUrl(path: string, params: Record<string, string> = {}): string {
  const p = new URLSearchParams(params)
  if (CG_KEY) p.set('x_cg_demo_api_key', CG_KEY)
  return `${BASE}${path}?${p}`
}

export interface PriceMap {
  [coinId: string]: number
}

export async function fetchPrices(coinIds: string[] = ['solana', 'usd-coin']): Promise<PriceMap> {
  const res = await fetch(cgUrl('/simple/price', { ids: coinIds.join(','), vs_currencies: 'usd' }))
  if (!res.ok) throw new Error(`CoinGecko error ${res.status}`)
  const data = await res.json()
  const out: PriceMap = {}
  for (const id of coinIds) {
    out[id] = data[id]?.usd ?? 0
  }
  return out
}

export async function getTokenPrice(coinId: string): Promise<number> {
  const prices = await fetchPrices([coinId])
  return prices[coinId] ?? 0
}

export async function getSolPrice(): Promise<number> {
  return getTokenPrice('solana')
}

export async function convertUsdToToken(usdAmount: number, token: 'SOL' | 'USDC' | 'USDT'): Promise<number> {
  const coinId = token === 'SOL' ? 'solana' : token === 'USDC' ? 'usd-coin' : 'tether'
  const price = await getTokenPrice(coinId)
  if (!price) throw new Error('Could not fetch price — try again')
  return usdAmount / price
}

export async function getMarketData(coinId: string): Promise<{
  price: number
  change24h: number
  marketCap: number
  volume24h: number
  name: string
  symbol: string
}> {
  const res = await fetch(cgUrl('/coins/markets', {
    vs_currency: 'usd',
    ids: coinId,
    order: 'market_cap_desc',
    per_page: '1',
    page: '1',
    price_change_percentage: '24h',
  }))
  if (!res.ok) throw new Error(`CoinGecko error ${res.status}`)
  const [coin] = await res.json()
  if (!coin) throw new Error(`Coin "${coinId}" not found`)
  return {
    price: coin.current_price,
    change24h: coin.price_change_percentage_24h ?? 0,
    marketCap: coin.market_cap,
    volume24h: coin.total_volume,
    name: coin.name,
    symbol: coin.symbol.toUpperCase(),
  }
}
