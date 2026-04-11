import { VersionedTransaction, Keypair } from '@solana/web3.js'
import type { SignKeyPair } from 'tweetnacl'
import type { Network } from '../types/wallet'
import type { AgentToken } from '../types/agent'
import { getConnection } from './solana'

const QUOTE_URL = 'https://api.jup.ag/swap/v1/quote'
const SWAP_URL  = 'https://api.jup.ag/swap/v1/swap'
const JUP_KEY   = import.meta.env.VITE_JUP_API_KEY

function jupHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...(JUP_KEY ? { 'x-api-key': JUP_KEY } : {}),
    ...extra,
  }
}

const MINT: Record<AgentToken, string> = {
  SOL:  'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  JUP:  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  PYTH: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  HNT:  'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux',
  RAY:  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  JTO:  'jtojtomepa8bdBCVqzm8E6cXB6zyRsGAbKp5RaGKimNV',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  GMT:  '7i5KKsX2weiTkry7jA4ZwSuXGhs5eJBEjY8vVxR4pfRx',
  SRM:  'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
  COPE: '8HGyAAB1yoM1ttS7pXjHMa3dukTFGQggnFFH3hJZgzQh',
}

const DECIMALS: Record<AgentToken, number> = {
  SOL: 1e9, USDC: 1e6, USDT: 1e6,
  JUP: 1e6, BONK: 1e5, PYTH: 1e6,
  HNT: 1e8, RAY: 1e6, JTO: 1e9,
  ORCA: 1e6, GMT: 1e9, SRM: 1e6, COPE: 1e6,
}

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
  inputToken: AgentToken,
  outputToken: AgentToken,
  inputAmount: number,
  slippageBps = 50
): Promise<JupiterQuote> {
  const lamports = Math.floor(inputAmount * DECIMALS[inputToken])
  const url = `${QUOTE_URL}?inputMint=${MINT[inputToken]}&outputMint=${MINT[outputToken]}&amount=${lamports}&slippageBps=${slippageBps}`
  let res: Response
  try {
    res = await fetch(url, { headers: jupHeaders() })
  } catch {
    throw new Error('Could not reach Jupiter — reload the extension and try again')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error ?? `Jupiter quote error ${res.status}`)
  }
  return res.json()
}

export function parseQuoteForDisplay(quote: JupiterQuote, outputToken: AgentToken): QuoteDisplay {
  return {
    estimatedOutput: Number(quote.outAmount) / DECIMALS[outputToken],
    priceImpactPct: Number(quote.priceImpactPct).toFixed(3),
    routeLabel: quote.routePlan.map(r => r.swapInfo.label).join(' → ') || 'Jupiter',
  }
}

export async function executeSwap(
  quote: JupiterQuote,
  naclKeypair: SignKeyPair
): Promise<string> {
  const network: Network = 'mainnet'
  const solanaKeypair = Keypair.fromSecretKey(naclKeypair.secretKey)

  const res = await fetch(SWAP_URL, {
    method: 'POST',
    headers: jupHeaders({ 'Content-Type': 'application/json' }),
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
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash()
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')
  return sig
}
