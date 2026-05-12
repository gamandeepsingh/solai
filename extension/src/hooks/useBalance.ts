import { useState, useEffect, useCallback } from 'react'
import { getSolBalance, getAllSplTokenBalances } from '../lib/solana'
import { getLocal, setLocal } from '../lib/storage'
import { useWallet } from '../context/WalletContext'
import { getSolPrice } from '../lib/prices'
import { getTokenMeta, unknownTokenMeta } from '../lib/tokenMetadata'
import type { TokenBalance } from '../types/tokens'
import { SOL_META, CURATED_TOKENS, getMintForNetwork } from '../lib/tokens'
import type { Network } from '../types/wallet'

function buildCuratedMap(network: Network): Map<string, typeof CURATED_TOKENS[0]> {
  const map = new Map<string, typeof CURATED_TOKENS[0]>()
  for (const token of CURATED_TOKENS) {
    const mint = getMintForNetwork(token, network)
    map.set(mint, token)
  }
  return map
}

export interface BalanceData {
  /** Tokens the user actually holds (amount > 0), sorted: SOL first, then by USD value desc */
  ownedBalances: TokenBalance[]
  /** All 13 curated tokens with amounts filled in (including zeros) */
  allTokenBalances: TokenBalance[]
  isLoading: boolean
  refresh: () => void
}

export function useBalance(): BalanceData {
  const { account, network } = useWallet()
  const [ownedBalances, setOwnedBalances] = useState<TokenBalance[]>([])
  const [allTokenBalances, setAllTokenBalances] = useState<TokenBalance[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchBalances = useCallback(async () => {
    if (!account?.publicKey) return
    try {
      const curatedMap = buildCuratedMap(network)

      const [sol, splTokens, solPrice] = await Promise.all([
        getSolBalance(account.publicKey, network),
        getAllSplTokenBalances(account.publicKey, network),
        getSolPrice().catch(() => 0),
      ])

      // Build mint → {amount, decimals} map from on-chain
      const onChainMap = new Map<string, { amount: number; decimals: number }>()
      for (const t of splTokens) {
        onChainMap.set(t.mint, { amount: t.amount, decimals: t.decimals })
      }

      // Build curated list with real balances
      const curatedBalances: TokenBalance[] = CURATED_TOKENS.map(meta => {
        const mint = getMintForNetwork(meta, network)
        if (meta.symbol === 'SOL') {
          return { meta, amount: sol, usdValue: sol * solPrice }
        }
        const onChain = onChainMap.get(mint)
        const amount = onChain?.amount ?? 0
        // USDC/USDT are stablecoins → USD value = amount
        const usdValue = (meta.symbol === 'USDC' || meta.symbol === 'USDT') ? amount : undefined
        return { meta: { ...meta, mint }, amount, usdValue }
      })

      // Discover any extra SPL tokens the user holds that aren't in our curated list
      const curatedMints = new Set(CURATED_TOKENS.map(t => getMintForNetwork(t, network)))
      const extraTokens: TokenBalance[] = await Promise.all(
        splTokens
          .filter(t => !curatedMints.has(t.mint) && t.amount > 0)
          .map(async ({ mint, amount, decimals }) => {
            const meta = (await getTokenMeta(mint)) ?? unknownTokenMeta(mint, decimals)
            return { meta: { ...meta, mint }, amount }
          })
      )

      // Owned = curated with balance > 0 + extra tokens
      const owned: TokenBalance[] = [
        ...curatedBalances.filter(b => b.amount > 0),
        ...extraTokens,
      ].sort((a, b) => {
        if (a.meta.symbol === 'SOL') return -1
        if (b.meta.symbol === 'SOL') return 1
        return (b.usdValue ?? 0) - (a.usdValue ?? 0)
      })

      setOwnedBalances(owned)
      setAllTokenBalances(curatedBalances)
      await setLocal('cachedSolBalance', sol)
    } catch {}
    setIsLoading(false)
  }, [account?.publicKey, network])

  // Load cached balance immediately for instant UI
  useEffect(() => {
    getLocal('cachedSolBalance').then(sol => {
      if (sol !== undefined) {
        setOwnedBalances([{ meta: SOL_META, amount: sol ?? 0 }])
        setIsLoading(false)
      }
    })
    fetchBalances()
    const id = setInterval(fetchBalances, 15_000)
    return () => clearInterval(id)
  }, [fetchBalances])

  return { ownedBalances, allTokenBalances, isLoading, refresh: fetchBalances }
}
