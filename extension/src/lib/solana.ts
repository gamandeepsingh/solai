import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, sendAndConfirmTransaction, Keypair } from '@solana/web3.js'
import { getAssociatedTokenAddress, createTransferInstruction, getAccount, createAssociatedTokenAccountInstruction } from '@solana/spl-token'
import nacl from 'tweetnacl'
import type { Network } from '../types/wallet'
import { USDC_MINT } from './tokens'

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

export async function getUsdcBalance(publicKey: string, network: Network): Promise<number> {
  const conn = getConnection(network)
  const mintKey = new PublicKey(USDC_MINT[network])
  const ownerKey = new PublicKey(publicKey)
  try {
    const ata = await getAssociatedTokenAddress(mintKey, ownerKey)
    const account = await getAccount(conn, ata)
    return Number(account.amount) / 1_000_000
  } catch {
    return 0
  }
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
  const conn = getConnection(network)
  const solanaKeypair = naclKeypairToSolana(keypair)
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: solanaKeypair.publicKey,
      toPubkey: new PublicKey(recipient),
      lamports: Math.round(amount * LAMPORTS_PER_SOL),
    })
  )
  return sendAndConfirmTransaction(conn, tx, [solanaKeypair])
}

export async function sendUsdc(
  keypair: nacl.SignKeyPair,
  recipient: string,
  amount: number,
  network: Network
): Promise<string> {
  const conn = getConnection(network)
  const solanaKeypair = naclKeypairToSolana(keypair)
  const mintKey = new PublicKey(USDC_MINT[network])
  const fromAta = await getAssociatedTokenAddress(mintKey, solanaKeypair.publicKey)
  const toKey = new PublicKey(recipient)
  const toAta = await getAssociatedTokenAddress(mintKey, toKey)

  const tx = new Transaction()

  try {
    await getAccount(conn, toAta)
  } catch {
    tx.add(createAssociatedTokenAccountInstruction(solanaKeypair.publicKey, toAta, toKey, mintKey))
  }

  tx.add(createTransferInstruction(fromAta, toAta, solanaKeypair.publicKey, BigInt(Math.round(amount * 1_000_000))))
  return sendAndConfirmTransaction(conn, tx, [solanaKeypair])
}

export async function estimateFee(network: Network): Promise<number> {
  return 0.000005
}

export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}
