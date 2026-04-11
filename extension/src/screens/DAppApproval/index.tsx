import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Button from '../../components/ui/Button'
import { useWallet } from '../../context/WalletContext'
import { isSuspiciousUrl } from '../../lib/phishing'

interface ConnectRequest {
  requestId: string
  origin: string
}

export default function DAppApprovalScreen() {
  const { account, isLocked } = useWallet()
  const [request, setRequest] = useState<ConnectRequest | null>(null)
  const [isSuspicious, setIsSuspicious] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestId = params.get('requestId')
    const origin = params.get('origin')
    if (requestId && origin) {
      setRequest({ requestId, origin })
      setIsSuspicious(isSuspiciousUrl(origin))
    }
  }, [])

  function approve() {
    if (!request || !account) return
    chrome.runtime.sendMessage({
      type: 'SOLAI_CONNECT_RESPONSE',
      requestId: request.requestId,
      approved: true,
      publicKey: account.publicKey,
    })
    window.close()
  }

  function reject() {
    if (!request) return
    chrome.runtime.sendMessage({
      type: 'SOLAI_CONNECT_RESPONSE',
      requestId: request.requestId,
      approved: false,
    })
    window.close()
  }

  if (!request) return null

  return (
    <div className="w-[360px] h-[600px] flex flex-col items-center justify-center bg-[var(--color-bg)] text-[var(--color-text)] px-6 gap-5">
      <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      </div>

      <div className="text-center">
        <h2 className="text-lg font-bold mb-1">Connect Request</h2>
        <p className="text-sm opacity-60 break-all">{request.origin}</p>
      </div>

      {isSuspicious && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-3"
        >
          <p className="text-xs text-red-400 font-medium">Suspicious site detected</p>
          <p className="text-xs text-red-400/70 mt-0.5">This site may be a phishing attempt. Do not connect your wallet.</p>
        </motion.div>
      )}

      {isLocked ? (
        <p className="text-xs text-center opacity-50">Unlock your wallet first to connect to dApps.</p>
      ) : (
        <div className="w-full card-bg rounded-2xl p-4">
          <p className="text-xs opacity-40 mb-1">Connecting wallet</p>
          <p className="text-sm font-mono font-medium">
            {account?.publicKey ? `${account.publicKey.slice(0, 8)}...${account.publicKey.slice(-8)}` : '—'}
          </p>
        </div>
      )}

      <div className="flex gap-3 w-full">
        <Button variant="secondary" fullWidth onClick={reject}>Reject</Button>
        <Button fullWidth onClick={approve} disabled={isLocked || isSuspicious}>Connect</Button>
      </div>
    </div>
  )
}
