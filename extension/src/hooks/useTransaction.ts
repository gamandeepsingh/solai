import { useState } from 'react'
import { sendSol, sendUsdc, sendUsdt } from '../lib/solana'
import { useWallet } from '../context/WalletContext'

export function useTransaction() {
  const { keypair, network } = useWallet()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txSignature, setTxSignature] = useState<string | null>(null)

  async function send(recipient: string, amount: number, token: 'SOL' | 'USDC' | 'USDT') {
    if (!keypair) throw new Error('Wallet is locked')
    setIsLoading(true)
    setError(null)
    setTxSignature(null)
    try {
      const sig = token === 'SOL'
        ? await sendSol(keypair, recipient, amount, network)
        : token === 'USDT'
          ? await sendUsdt(keypair, recipient, amount, network)
          : await sendUsdc(keypair, recipient, amount, network)
      setTxSignature(sig)
      return sig
    } catch (e: any) {
      const msg = e?.message ?? 'Transaction failed'
      setError(msg)
      throw new Error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return { send, isLoading, error, txSignature }
}
