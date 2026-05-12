import TransportWebHID from '@ledgerhq/hw-transport-webhid'
import Solana from '@ledgerhq/hw-app-solana'
import { VersionedTransaction, Transaction, PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'

export const LEDGER_DEFAULT_PATH = "44'/501'/0'/0'"

const LEDGER_VENDOR_ID = 0x2c97

async function getTransport(forceRequest = false) {
  if (forceRequest) return TransportWebHID.request()
  const devices = await (TransportWebHID as any).list()
  const ledger = devices.find((d: any) => d.vendorId === LEDGER_VENDOR_ID)
  if (ledger) return TransportWebHID.open(ledger)
  return TransportWebHID.request()
}

export async function getLedgerPublicKey(
  path = LEDGER_DEFAULT_PATH,
  forceRequest = false
): Promise<string> {
  const transport = await getTransport(forceRequest)
  try {
    const solana = new Solana(transport)
    const { address } = await solana.getAddress(path)
    return bs58.encode(Buffer.from(address as Buffer))
  } finally {
    await transport.close()
  }
}

export async function signMessageWithLedger(
  message: Uint8Array,
  path = LEDGER_DEFAULT_PATH
): Promise<Uint8Array> {
  const transport = await getTransport()
  try {
    const solana = new Solana(transport)
    const result = await (solana as any).signOffchainMessage(path, Buffer.from(message))
    return new Uint8Array(result.signature)
  } finally {
    await transport.close()
  }
}

export async function signTransactionBytesWithLedger(
  txBytes: Uint8Array,
  publicKeyStr: string,
  path = LEDGER_DEFAULT_PATH
): Promise<Uint8Array> {
  const transport = await getTransport()
  try {
    const solana = new Solana(transport)
    const publicKey = new PublicKey(publicKeyStr)
    let signedBytes: Uint8Array
    try {
      const tx = VersionedTransaction.deserialize(txBytes)
      const msgBytes = Buffer.from(tx.message.serialize())
      const { signature } = await solana.signTransaction(path, msgBytes)
      tx.signatures[0] = new Uint8Array(signature)
      signedBytes = tx.serialize()
    } catch {
      const tx = Transaction.from(txBytes)
      const msgBytes = Buffer.from(tx.serializeMessage())
      const { signature } = await solana.signTransaction(path, msgBytes)
      tx.addSignature(publicKey, Buffer.from(signature))
      signedBytes = tx.serialize({ requireAllSignatures: false })
    }
    return signedBytes
  } finally {
    await transport.close()
  }
}
