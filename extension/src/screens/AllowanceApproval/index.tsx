import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Spinner from '../../components/ui/Spinner'

interface Props {
  requestId: string
}

interface PendingAllowance {
  agentId: string
  token: string
  maxAmount: number
  expireDays: number
  label: string
  origin: string
}

export default function AllowanceApprovalScreen({ requestId }: Props) {
  const [request, setRequest] = useState<PendingAllowance | null>(null)
  const [agentName, setAgentName] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    chrome.storage.session.get(`pendingAllowance_${requestId}`).then((stored: any) => {
      const req = stored[`pendingAllowance_${requestId}`]
      if (req) {
        setRequest(req)
        chrome.storage.local.get('agentWallets').then((r: any) => {
          const agent = (r.agentWallets ?? []).find((a: any) => a.id === req.agentId)
          if (agent) setAgentName(agent.name)
        })
      }
    })
  }, [requestId])

  function respond(approved: boolean) {
    chrome.runtime.sendMessage({ type: 'SOLAI_ALLOWANCE_RESPONSE', requestId, approved })
    setDone(true)
    setTimeout(() => window.close(), 1200)
  }

  if (!request) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--color-bg)]">
        <Spinner />
      </div>
    )
  }

  const hostname = (() => { try { return new URL(request.origin).hostname } catch { return request.origin } })()

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)] px-5 py-6 gap-5">
      <div className="flex flex-col items-center gap-2 pt-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <p className="text-sm font-bold text-center">Spending Allowance Request</p>
        <p className="text-[11px] opacity-50 text-center">{hostname} is requesting permission to spend from your agent wallet</p>
      </div>

      <div className="card-bg rounded-3xl p-4 flex flex-col gap-3">
        <Row label="Agent" value={agentName || request.agentId.slice(0, 8) + '…'} />
        <Row label="Token" value={request.token} />
        <Row label="Max Amount" value={`${request.maxAmount} ${request.token}`} />
        <Row label="Expires" value={`${request.expireDays} day${request.expireDays !== 1 ? 's' : ''}`} />
        <Row label="Purpose" value={request.label} />
        <Row label="From" value={hostname} />
      </div>

      <p className="text-[10px] opacity-40 text-center leading-relaxed">
        Once approved, {hostname} can spend up to {request.maxAmount} {request.token} from <strong>{agentName || 'this agent'}</strong> without further confirmation. All guardrails still apply.
      </p>

      {done ? (
        <div className="flex items-center justify-center gap-2 py-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><polyline points="20 6 9 17 4 12"/></svg>
          <p className="text-sm text-primary">Done</p>
        </div>
      ) : (
        <div className="flex gap-3 mt-auto">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => respond(false)}
            className="flex-1 py-3 rounded-2xl border border-[var(--color-border)] text-sm font-semibold opacity-60"
          >
            Reject
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => respond(true)}
            className="flex-1 py-3 rounded-2xl bg-primary text-black text-sm font-semibold"
          >
            Approve
          </motion.button>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[11px] opacity-40">{label}</span>
      <span className="text-xs font-semibold text-right max-w-[60%] truncate">{value}</span>
    </div>
  )
}
