import { Connection, VersionedTransaction, Keypair } from '@solana/web3.js'
import type { SignKeyPair } from 'tweetnacl'
import type { Network } from '../types/wallet'
import { getConnection } from './solana'

const QUOTE_URL = 'https://quote-api.jup.ag/v6/quote'
const SWAP_URL = 'https://quote-api.jup.ag/v6/swap'

const MINT: Record<'SOL' | 'USDC', string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
}

const DECIMALS: Record<'SOL' | 'USDC', number> = { SOL: 1e9, USDC: 1e6 }

export interface JupiterQuote {
  inputMint: string
  outputMint: string
  inAmount: string
  outAmount: string
  priceImpactPct: string
  routePlan: Array<{ swapInfo: { label: string } }>
  [key: string]: unknown
}

export interface QuoteDisplay {
  estimatedOutput: number
  priceImpactPct: string
  routeLabel: string
}

export async function getSwapQuote(
  inputToken: 'SOL' | 'USDC',
  outputToken: 'SOL' | 'USDC',
  inputAmount: number,
  slippageBps = 50
): Promise<JupiterQuote> {
  const lamports = Math.floor(inputAmount * DECIMALS[inputToken])
  const url = `${QUOTE_URL}?inputMint=${MINT[inputToken]}&outputMint=${MINT[outputToken]}&amount=${lamports}&slippageBps=${slippageBps}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error ?? `Jupiter quote error ${res.status}`)
  }
  return res.json()
}

export function parseQuoteForDisplay(quote: JupiterQuote, outputToken: 'SOL' | 'USDC'): QuoteDisplay {
  return {
    estimatedOutput: Number(quote.outAmount) / DECIMALS[outputToken],
    priceImpactPct: Number(quote.priceImpactPct).toFixed(3),
    routeLabel: quote.routePlan.map(r => r.swapInfo.label).join(' → ') || 'Jupiter',
  }
}

export async function executeSwap(
  quote: JupiterQuote,
  naclKeypair: SignKeyPair,
  network: Network
): Promise<string> {
  const solanaKeypair = Keypair.fromSecretKey(naclKeypair.secretKey)

  const res = await fetch(SWAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: solanaKeypair.publicKey.toString(),
      wrapAndUnwrapSol: true,
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error ?? `Jupiter swap error ${res.status}`)
  }
  const { swapTransaction } = await res.json()

  const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'))
  tx.sign([solanaKeypair])

  const conn = getConnection(network)
  const sig = await conn.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await conn.confirmTransaction(sig, 'confirmed')
  return sig
}
