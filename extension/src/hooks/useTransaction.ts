import { useState } from 'react'
import { sendSol, sendSplToken, buildUnsignedSolTransfer, buildUnsignedSplTransfer, broadcastSignedTransaction } from '../lib/solana'
import { useWallet } from '../context/WalletContext'
import { CURATED_TOKENS, getMintForNetwork } from '../lib/tokens'

export function useTransaction() {
  const { keypair, network, isLedgerWallet, account } = useWallet()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [awaitingLedger, setAwaitingLedger] = useState(false)

  async function send(recipient: string, amount: number, tokenSymbol: string) {
    if (!isLedgerWallet && !keypair) throw new Error('Wallet is locked')
    setIsLoading(true)
    setError(null)
    setTxSignature(null)
    try {
      let sig: string
      if (isLedgerWallet) {
        sig = await sendWithLedger(recipient, amount, tokenSymbol)
      } else {
        if (tokenSymbol === 'SOL') {
          sig = await sendSol(keypair!, recipient, amount, network)
        } else {
          const meta = CURATED_TOKENS.find(t => t.symbol === tokenSymbol)
          if (!meta) throw new Error(`Unsupported token: ${tokenSymbol}`)
          const mint = getMintForNetwork(meta, network)
          sig = await sendSplToken(keypair!, recipient, amount, mint, network, meta.decimals)
        }
      }
      setTxSignature(sig)
      return sig
    } catch (e: any) {
      const msg = e?.message ?? 'Transaction failed'
      setError(msg)
      throw new Error(msg)
    } finally {
      setIsLoading(false)
      setAwaitingLedger(false)
    }
  }

  async function sendWithLedger(recipient: string, amount: number, tokenSymbol: string): Promise<string> {
    if (!account) throw new Error('No wallet connected')
    const { signTransactionBytesWithLedger, LEDGER_DEFAULT_PATH } = await import('../lib/ledger')
    const ledgerPath = account.ledgerPath ?? LEDGER_DEFAULT_PATH
    setAwaitingLedger(true)
    let txBytes: Uint8Array
    if (tokenSymbol === 'SOL') {
      const built = await buildUnsignedSolTransfer(account.publicKey, recipient, amount, network)
      txBytes = built.txBytes
    } else {
      const meta = CURATED_TOKENS.find(t => t.symbol === tokenSymbol)
      if (!meta) throw new Error(`Unsupported token: ${tokenSymbol}`)
      const mint = getMintForNetwork(meta, network)
      const built = await buildUnsignedSplTransfer(account.publicKey, recipient, amount, mint, network, meta.decimals)
      txBytes = built.txBytes
    }
    const signedBytes = await signTransactionBytesWithLedger(txBytes, account.publicKey, ledgerPath)
    return broadcastSignedTransaction(signedBytes, network)
  }

  return { send, isLoading, error, txSignature, awaitingLedger }
}
