import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, sendAndConfirmTransaction, Keypair } from '@solana/web3.js'
import { getAssociatedTokenAddress, createTransferInstruction, getAccount, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import nacl from 'tweetnacl'
import type { Network } from '../types/wallet'
import type { NFTAsset } from '../types/nft'
import { USDC_MINT, USDT_MINT } from './tokens'

const ENDPOINTS: Record<Network, string> = {
  mainnet: import.meta.env.VITE_RPC_MAINNET || 'https://api.mainnet-beta.solana.com',
  devnet:  import.meta.env.VITE_RPC_DEVNET  || 'https://api.devnet.solana.com',
}

let _connection: Connection | null = null
let _currentNetwork: Network = 'mainnet'

export function getConnection(network: Network, customRpc?: string): Connection {
  const endpoint = customRpc || ENDPOINTS[network]
  if (_connection && _currentNetwork === network && !customRpc) return _connection
  _connection = new Connection(endpoint, 'confirmed')
  _currentNetwork = network
  return _connection
}

export async function getSolBalance(publicKey: string, network: Network): Promise<number> {
  const conn = getConnection(network)
  const balance = await conn.getBalance(new PublicKey(publicKey))
  return balance / LAMPORTS_PER_SOL
}

async function getSplBalance(publicKey: string, network: Network, mintAddress: string): Promise<number> {
  const conn = getConnection(network)
  const mintKey = new PublicKey(mintAddress)
  const ownerKey = new PublicKey(publicKey)
  try {
    const ata = await getAssociatedTokenAddress(mintKey, ownerKey)
    const account = await getAccount(conn, ata)
    return Number(account.amount) / 1_000_000
  } catch {
    return 0
  }
}

export async function getUsdcBalance(publicKey: string, network: Network): Promise<number> {
  return getSplBalance(publicKey, network, USDC_MINT[network])
}

export async function getUsdtBalance(publicKey: string, network: Network): Promise<number> {
  return getSplBalance(publicKey, network, USDT_MINT[network])
}

function naclKeypairToSolana(keypair: nacl.SignKeyPair): Keypair {
  return Keypair.fromSecretKey(keypair.secretKey)
}

export async function sendSol(
  keypair: nacl.SignKeyPair,
  recipient: string,
  amount: number,
  network: Network
): Promise<string> {
  if (amount <= 0) throw new Error('Amount must be greater than 0')
  const conn = getConnection(network)
  const solanaKeypair = naclKeypairToSolana(keypair)
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: solanaKeypair.publicKey,
      toPubkey: new PublicKey(recipient),
      lamports: Math.round(amount * LAMPORTS_PER_SOL),
    })
  )
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash
  tx.feePayer = solanaKeypair.publicKey
  const simResult = await conn.simulateTransaction(tx)
  if (simResult.value.err) throw new Error(`Transaction simulation failed: ${JSON.stringify(simResult.value.err)}`)
  return sendAndConfirmTransaction(conn, tx, [solanaKeypair])
}

export async function sendSplToken(
  keypair: nacl.SignKeyPair,
  recipient: string,
  amount: number,
  mintAddress: string,
  network: Network,
  decimals = 6
): Promise<string> {
  if (amount <= 0) throw new Error('Amount must be greater than 0')
  const conn = getConnection(network)
  const solanaKeypair = naclKeypairToSolana(keypair)
  const mintKey = new PublicKey(mintAddress)
  const fromAta = await getAssociatedTokenAddress(mintKey, solanaKeypair.publicKey)
  const toKey = new PublicKey(recipient)
  const toAta = await getAssociatedTokenAddress(mintKey, toKey)

  const tx = new Transaction()
  try {
    await getAccount(conn, toAta)
  } catch {
    tx.add(createAssociatedTokenAccountInstruction(solanaKeypair.publicKey, toAta, toKey, mintKey))
  }
  tx.add(createTransferInstruction(fromAta, toAta, solanaKeypair.publicKey, BigInt(Math.round(amount * 10 ** decimals))))
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash
  tx.feePayer = solanaKeypair.publicKey
  const simResult = await conn.simulateTransaction(tx)
  if (simResult.value.err) throw new Error(`Transaction simulation failed: ${JSON.stringify(simResult.value.err)}`)
  return sendAndConfirmTransaction(conn, tx, [solanaKeypair])
}

export async function sendUsdc(keypair: nacl.SignKeyPair, recipient: string, amount: number, network: Network): Promise<string> {
  return sendSplToken(keypair, recipient, amount, USDC_MINT[network], network)
}

export async function sendUsdt(keypair: nacl.SignKeyPair, recipient: string, amount: number, network: Network): Promise<string> {
  return sendSplToken(keypair, recipient, amount, USDT_MINT[network], network)
}

export async function estimateFee(network: Network): Promise<number> {
  return 0.000005
}

export async function getAllSplTokenBalances(
  publicKey: string,
  network: Network
): Promise<{ mint: string; amount: number; decimals: number }[]> {
  const conn = getConnection(network)
  const pk = new PublicKey(publicKey)
  const { value } = await conn.getParsedTokenAccountsByOwner(pk, { programId: TOKEN_PROGRAM_ID })
  return value
    .filter(a => Number(a.account.data.parsed.info.tokenAmount.uiAmount) > 0)
    .map(a => ({
      mint: a.account.data.parsed.info.mint as string,
      amount: Number(a.account.data.parsed.info.tokenAmount.uiAmount),
      decimals: Number(a.account.data.parsed.info.tokenAmount.decimals),
    }))
}

const HELIUS_RPC_URL = import.meta.env.VITE_HELIUS_RPC_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${import.meta.env.VITE_HELIUS_RPC_KEY}`
  : null

export async function getNFTs(
  publicKey: string,
  network: Network
): Promise<NFTAsset[]> {
  if (HELIUS_RPC_URL && network === 'mainnet') {
    try {
      const res = await fetch(HELIUS_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'getAssetsByOwner',
          params: { ownerAddress: publicKey, page: 1, limit: 100 },
        }),
      })
      const data = await res.json()
      const assets = data?.result?.items ?? []
      return assets
        .filter((a: any) => a.interface === 'V1_NFT' || a.interface === 'ProgrammableNFT')
        .map((a: any): NFTAsset => ({
          mint: a.id,
          name: a.content?.metadata?.name ?? 'Unknown NFT',
          image: a.content?.links?.image ?? '',
          collection: a.grouping?.find((g: any) => g.group_key === 'collection')?.group_value,
          description: a.content?.metadata?.description,
        }))
    } catch {}
  }

  const conn = getConnection(network)
  const pk = new PublicKey(publicKey)
  const { value } = await conn.getParsedTokenAccountsByOwner(pk, { programId: TOKEN_PROGRAM_ID })
  return value
    .filter(a => {
      const info = a.account.data.parsed.info
      return Number(info.tokenAmount.amount) === 1 && Number(info.tokenAmount.decimals) === 0
    })
    .map((a): NFTAsset => ({
      mint: a.account.data.parsed.info.mint,
      name: `NFT (${(a.account.data.parsed.info.mint as string).slice(0, 8)}...)`,
      image: '',
    }))
}


const SYSTEM_PROGRAM_BLOCKLIST = [
  '11111111111111111111111111111111',           // System Program
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token Program
  'TokenzQdBNbequnxGnFkfHHzYA1r7a8MXWdLLQqwF',  // Token-2022
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', // Memo Program
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s', // Metaplex Token Metadata
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bJ',  // Associated Token Program
  'So11111111111111111111111111111111111111112',   // Wrapped SOL mint
]

export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}

export async function validateRecipientAddress(
  address: string,
  network: Network
): Promise<{ valid: boolean; warning?: string }> {
  try {
    new PublicKey(address)
  } catch {
    return { valid: false, warning: 'Invalid Solana address' }
  }

  if (SYSTEM_PROGRAM_BLOCKLIST.includes(address)) {
    return { valid: false, warning: 'This is a system program address — sending here will burn your tokens' }
  }

  try {
    const conn = getConnection(network)
    const info = await conn.getAccountInfo(new PublicKey(address))
    if (info?.executable) {
      return { valid: true, warning: 'This address is a program, not a wallet — double-check before sending' }
    }
  } catch {}

  return { valid: true }
}
