import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import nacl from 'tweetnacl'
import { VersionedTransaction, Transaction, PublicKey } from '@solana/web3.js'
import Button from '../../components/ui/Button'
import { useWallet } from '../../context/WalletContext'

interface PendingSign {
  type: 'signMessage' | 'signTransaction' | 'signAndSendTransaction'
  params: any
  tabId: number | null
}

interface Props {
  requestId: string
  onDone: () => void
}

export default function SignApprovalScreen({ requestId, onDone }: Props) {
  const { keypair, network } = useWallet()
  const [pendingSign, setPendingSign] = useState<PendingSign | null>(null)
  const [messageText, setMessageText] = useState<string | null>(null)
  const [isApproving, setIsApproving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    chrome.storage.session.get(`pendingSign_${requestId}`).then((stored: any) => {
      const data: PendingSign = stored[`pendingSign_${requestId}`]
      if (!data) return
      setPendingSign(data)
      if (data.type === 'signMessage' && data.params?.message) {
        try {
          setMessageText(new TextDecoder().decode(new Uint8Array(data.params.message)))
        } catch {
          setMessageText(null)
        }
      }
    })
  }, [requestId])

  async function pushResult(result: Record<string, any>) {
    await chrome.storage.session.remove(`pendingSign_${requestId}`)
    if (pendingSign?.tabId != null) {
      chrome.tabs.sendMessage(pendingSign.tabId, {
        type: 'SOLAI_SIGN_RESULT',
        requestId,
        ...result,
      }).catch(() => {})
    }
    onDone()
    window.close()
  }

  async function handleApprove() {
    if (!keypair || !pendingSign) return
    setIsApproving(true)
    setError('')

    try {
      if (pendingSign.type === 'signMessage') {
        const msgBytes = new Uint8Array(pendingSign.params.message)
        const signature = nacl.sign.detached(msgBytes, keypair.secretKey)
        await pushResult({ signature: Array.from(signature) })
        return
      }

      // Sign transaction bytes
      const txBytes = new Uint8Array(pendingSign.params.transaction)
      const signer = { publicKey: new PublicKey(keypair.publicKey), secretKey: keypair.secretKey }
      let signedBytes: Uint8Array
      try {
        const tx = VersionedTransaction.deserialize(txBytes)
        tx.sign([signer])
        signedBytes = tx.serialize()
      } catch {
        const tx = Transaction.from(txBytes)
        tx.partialSign(signer)
        signedBytes = tx.serialize({ requireAllSignatures: false })
      }

      if (pendingSign.type === 'signTransaction') {
        await pushResult({ signedTransaction: Array.from(signedBytes) })
        return
      }

      // signAndSendTransaction — submit to RPC
      const endpoint = network === 'devnet'
        ? 'https://api.devnet.solana.com'
        : 'https://api.mainnet-beta.solana.com'
      const b64 = btoa(Array.from(signedBytes).map(b => String.fromCharCode(b)).join(''))
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'sendTransaction',
          params: [b64, { encoding: 'base64', preflightCommitment: 'confirmed' }],
        }),
      })
      const { result: sig, error: rpcErr } = await res.json()
      if (rpcErr) {
        setError(rpcErr.message ?? 'Transaction rejected by network')
        setIsApproving(false)
        return
      }
      await pushResult({ signature: sig })
    } catch (e: any) {
      await pushResult({ error: e?.message ?? 'Signing failed' })
    }
  }

  async function handleReject() {
    await chrome.storage.session.remove(`pendingSign_${requestId}`)
    if (pendingSign?.tabId != null) {
      chrome.tabs.sendMessage(pendingSign.tabId, {
        type: 'SOLAI_SIGN_RESULT',
        requestId,
        error: 'User rejected the request',
      }).catch(() => {})
    }
    onDone()
    window.close()
  }

  if (!pendingSign) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--color-bg)]">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const origin: string = pendingSign.params?.origin ?? 'Unknown site'

  const typeLabel = {
    signMessage: 'Sign Message',
    signTransaction: 'Sign Transaction',
    signAndSendTransaction: 'Sign & Send Transaction',
  }[pendingSign.type]

  const typeDescription = {
    signMessage: 'A site is asking you to sign a message.',
    signTransaction: 'A site is asking you to sign a transaction.',
    signAndSendTransaction: 'A site is asking you to sign and submit a transaction.',
  }[pendingSign.type]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full h-full flex flex-col items-center justify-center bg-[var(--color-bg)] text-[var(--color-text)] px-6 gap-5"
    >
      <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
      </div>

      <div className="text-center">
        <h2 className="text-lg font-bold mb-1">{typeLabel}</h2>
        <p className="text-sm opacity-60 break-all">{origin}</p>
        <p className="text-xs opacity-40 mt-1">{typeDescription}</p>
      </div>

      {messageText && (
        <div className="w-full rounded-2xl bg-[var(--color-card)] border border-[var(--color-border)] px-4 py-3 max-h-40 overflow-y-auto">
          <p className="text-xs opacity-40 mb-1">Message</p>
          <p className="text-sm font-mono break-all whitespace-pre-wrap leading-relaxed">{messageText}</p>
        </div>
      )}

      {!messageText && pendingSign.type !== 'signMessage' && (
        <div className="w-full rounded-2xl bg-[var(--color-card)] border border-[var(--color-border)] px-4 py-3">
          <p className="text-xs opacity-40 mb-1">Details</p>
          <p className="text-sm opacity-70">
            {pendingSign.type === 'signAndSendTransaction'
              ? 'The signed transaction will be sent to the Solana network immediately.'
              : 'The signed transaction will be returned to the requesting app.'}
          </p>
        </div>
      )}

      {error && (
        <div className="w-full rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-3 w-full">
        <Button variant="secondary" fullWidth onClick={handleReject} disabled={isApproving}>
          Reject
        </Button>
        <Button fullWidth isLoading={isApproving} onClick={handleApprove}>
          Approve
        </Button>
      </div>
    </motion.div>
  )
}
