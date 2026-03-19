import { useState, useEffect, useCallback } from 'react'
import { getSolBalance, getUsdcBalance, getUsdtBalance } from '../lib/solana'
import { getLocal, setLocal } from '../lib/storage'
import { useWallet } from '../context/WalletContext'
import { getSolPrice } from '../lib/prices'
import type { TokenBalance } from '../types/tokens'
import { SOL_META, USDC_META, USDT_META } from '../lib/tokens'

export function useBalance() {
  const { account, network } = useWallet()
  const [balances, setBalances] = useState<TokenBalance[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchBalances = useCallback(async () => {
    if (!account?.publicKey) return
    try {
      const [sol, usdc, usdt, solPrice] = await Promise.all([
        getSolBalance(account.publicKey, network),
        getUsdcBalance(account.publicKey, network),
        getUsdtBalance(account.publicKey, network),
        getSolPrice().catch(() => 0),
      ])
      setBalances([
        { meta: SOL_META, amount: sol, usdValue: sol * solPrice },
        { meta: USDC_META, amount: usdc, usdValue: usdc },
        { meta: USDT_META, amount: usdt, usdValue: usdt },
      ])
      await setLocal('cachedSolBalance', sol)
      await setLocal('cachedUsdcBalance', usdc)
      await setLocal('cachedUsdtBalance', usdt)
    } catch {}
    setIsLoading(false)
  }, [account?.publicKey, network])

  useEffect(() => {
    Promise.all([
      getLocal('cachedSolBalance'),
      getLocal('cachedUsdcBalance'),
      getLocal('cachedUsdtBalance'),
    ]).then(([sol, usdc, usdt]) => {
      if (sol !== undefined) {
        setBalances([
          { meta: SOL_META, amount: sol ?? 0 },
          { meta: USDC_META, amount: usdc ?? 0 },
          { meta: USDT_META, amount: usdt ?? 0 },
        ])
        setIsLoading(false)
      }
    })
    fetchBalances()
    const id = setInterval(fetchBalances, 15_000)
    return () => clearInterval(id)
  }, [fetchBalances])

  return { balances, isLoading, refresh: fetchBalances }
}
