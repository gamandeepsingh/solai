import { useState } from 'react'
import { sendSol, sendSplToken } from '../lib/solana'
import { useWallet } from '../context/WalletContext'
import { CURATED_TOKENS, getMintForNetwork } from '../lib/tokens'

export function useTransaction() {
  const { keypair, network } = useWallet()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txSignature, setTxSignature] = useState<string | null>(null)

  async function send(recipient: string, amount: number, tokenSymbol: string) {
    if (!keypair) throw new Error('Wallet is locked')
    setIsLoading(true)
    setError(null)
    setTxSignature(null)
    try {
      let sig: string
      if (tokenSymbol === 'SOL') {
        sig = await sendSol(keypair, recipient, amount, network)
      } else {
        const meta = CURATED_TOKENS.find(t => t.symbol === tokenSymbol)
        if (!meta) throw new Error(`Unsupported token: ${tokenSymbol}`)
        const mint = getMintForNetwork(meta, network)
        sig = await sendSplToken(keypair, recipient, amount, mint, network, meta.decimals)
      }
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
