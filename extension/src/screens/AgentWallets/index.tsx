import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Header from '../../components/layout/Header'
import BottomNav from '../../components/layout/BottomNav'
import CopyButton from '../../components/ui/CopyButton'
import Spinner from '../../components/ui/Spinner'
import { useWallet } from '../../context/WalletContext'
import { useToast } from '../../components/ui/Toast'
import { getSolBalance } from '../../lib/solana'
import { getLocal } from '../../lib/storage'
import { getAgentAllowances, revokeAllowance } from '../../lib/allowances'
import type { AgentWallet, AgentGuardrails, AgentAutoRefill, TokenAllowance } from '../../types/agent'
import type { TxRecord } from '../../types/history'

function truncate(s: string) {
  return s ? `${s.slice(0, 6)}...${s.slice(-6)}` : ''
}

const DEFAULT_GUARDRAILS: AgentGuardrails = {
  dailyBudgetSol: 0,
  perTxLimitSol: 0,
  allowedOrigins: [],
  cooldownMs: 0,
  allowedTokens: [],
  tokenBudgets: {},
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  blank: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  dca: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  gaming: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15" cy="13" r="1"/><circle cx="18" cy="11" r="1"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/></svg>,
  subscription: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  tip: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  gas: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
}

const AGENT_TEMPLATES: { id: string; name: string; description: string; guardrails: AgentGuardrails }[] = [
  { id: 'blank', name: 'Custom', description: 'Start from scratch', guardrails: { ...DEFAULT_GUARDRAILS } },
  { id: 'dca', name: 'DCA Bot', description: 'Automated token buys with weekly guardrails', guardrails: { ...DEFAULT_GUARDRAILS, perTxLimitSol: 0.5, cooldownMs: 6 * 3_600_000, allowedTokens: ['SOL', 'USDC', 'USDT'] } },
  { id: 'gaming', name: 'Gaming', description: 'In-game micro-payments', guardrails: { ...DEFAULT_GUARDRAILS, perTxLimitSol: 0.05, cooldownMs: 3000, tokenBudgets: { USDC: { daily: 10, perTx: 2 } }, allowedTokens: ['SOL', 'USDC'] } },
  { id: 'subscription', name: 'Subscription', description: 'Recurring USDC/USDT payments', guardrails: { ...DEFAULT_GUARDRAILS, cooldownMs: 23 * 3_600_000, allowedTokens: ['USDC', 'USDT'] } },
  { id: 'tip', name: 'Tip Jar', description: 'Micro-tips to creators', guardrails: { ...DEFAULT_GUARDRAILS, perTxLimitSol: 0.01, cooldownMs: 1000, tokenBudgets: { USDC: { daily: 5, perTx: 1 } } } },
  { id: 'gas', name: 'Gas Wallet', description: 'Cover transaction fees only', guardrails: { ...DEFAULT_GUARDRAILS, perTxLimitSol: 0.001, cooldownMs: 0, allowedTokens: ['SOL'] } },
]

function GuardrailBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-2 py-1">
      <span className="text-[9px] opacity-40">{label}</span>
      <span className="text-[10px] font-medium">{value}</span>
    </div>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-10 h-5 rounded-full relative transition-colors ${checked ? 'bg-primary' : 'bg-[var(--color-border)]'}`}
    >
      <motion.div
        animate={{ x: checked ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow"
      />
    </button>
  )
}

interface AgentCardProps {
  agent: AgentWallet
  onToggle: (enabled: boolean) => void
  onEdit: () => void
  onFund: () => void
  onCollect: () => void
  onDelete: () => void
  onStats: () => void
}

function AgentCard({ agent, onToggle, onEdit, onFund, onCollect, onDelete, onStats }: AgentCardProps) {
  const { network } = useWallet()
  const [balance, setBalance] = useState<number | null>(null)
  const [recentTxs, setRecentTxs] = useState<TxRecord[]>([])

  useEffect(() => {
    getSolBalance(agent.publicKey, network).then(setBalance).catch(() => setBalance(0))
    getLocal('txLog').then(log => {
      const matching = (log ?? [])
        .filter((t: TxRecord) => t.agentId === agent.id && t.network === network)
        .slice(0, 3)
      setRecentTxs(matching)
    })
  }, [agent.id, agent.publicKey, network, agent.stats.txCount])

  const g = agent.guardrails
  const s = agent.stats
  const budgetPct = g.dailyBudgetSol > 0 ? Math.min(1, s.dailySpentSol / g.dailyBudgetSol) : 0
  const tokenBudgets = g.tokenBudgets ?? {}
  const tokenSpend = s.tokenSpend ?? {}

  return (
    <div className={`card-bg rounded-3xl overflow-hidden border ${agent.enabled ? 'border-[var(--color-border)]' : 'border-red-500/30'}`}>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">{agent.name}</p>
            {!agent.enabled && (
              <span className="text-[9px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full font-medium">disabled</span>
            )}
            {agent.autoRefill?.enabled && (
              <span className="text-[9px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">auto-refill</span>
            )}
          </div>
          <p className="text-[10px] font-mono opacity-40 mt-0.5">{truncate(agent.publicKey)}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[9px] opacity-30">ID:</span>
            <span className="text-[9px] font-mono opacity-30">{agent.id.slice(0, 8)}…</span>
            <CopyButton text={agent.id} className="!px-1.5 !py-0 !text-[9px]" />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CopyButton text={agent.publicKey} />
          <ToggleSwitch checked={agent.enabled} onChange={onToggle} />
        </div>
      </div>

      <div className="px-4 pb-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold">{balance === null ? '—' : `${balance.toFixed(4)} SOL`}</p>
            <p className="text-[9px] opacity-40 mt-0.5">Balance</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold">
              {g.dailyBudgetSol > 0 ? `${s.dailySpentSol.toFixed(4)} / ${g.dailyBudgetSol} SOL` : 'Unlimited'}
            </p>
            <p className="text-[9px] opacity-40 mt-0.5">Daily SOL spend</p>
          </div>
        </div>

        {g.dailyBudgetSol > 0 && (
          <div className="h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${budgetPct * 100}%`, background: budgetPct > 0.8 ? '#ef4444' : undefined }} />
          </div>
        )}

        {Object.entries(tokenBudgets).map(([sym, budget]) => {
          const tStat = tokenSpend[sym]
          const pct = budget.daily > 0 && tStat ? Math.min(1, tStat.daily / budget.daily) : 0
          return (
            <div key={sym} className="flex flex-col gap-1">
              <div className="flex justify-between">
                <span className="text-[10px] opacity-40">{sym} daily</span>
                <span className="text-[10px] font-medium">{tStat ? tStat.daily.toFixed(2) : 0} / {budget.daily} {sym}</span>
              </div>
              {budget.daily > 0 && (
                <div className="h-0.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                  <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct * 100}%` }} />
                </div>
              )}
            </div>
          )
        })}

        <div className="flex flex-wrap gap-1">
          <GuardrailBadge label="per-tx" value={g.perTxLimitSol > 0 ? `≤${g.perTxLimitSol} SOL` : 'unlimited'} />
          <GuardrailBadge label="cooldown" value={g.cooldownMs > 0 ? `${g.cooldownMs / 1000}s` : 'none'} />
          <GuardrailBadge label="origins" value={g.allowedOrigins.length > 0 ? `${g.allowedOrigins.length} allowed` : 'any'} />
          {(g.allowedTokens ?? []).length > 0 && (
            <GuardrailBadge label="tokens" value={(g.allowedTokens ?? []).join(', ')} />
          )}
        </div>

        {recentTxs.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-[9px] opacity-30 uppercase tracking-widest">Recent</p>
            {recentTxs.map(tx => (
              <div key={tx.sig} className="flex items-center justify-between">
                <p className="text-[10px] font-mono opacity-40 truncate max-w-[160px]">{tx.sig.slice(0, 12)}…</p>
                <p className={`text-[10px] ${tx.status === 'success' ? 'text-primary' : 'text-red-400'}`}>
                  {tx.status === 'success' ? `−${tx.amount ?? '?'} ${tx.token ?? 'SOL'}` : 'failed'}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-1.5">
          <button onClick={onFund} className="flex-1 py-1.5 rounded-xl border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10 transition-colors">Fund</button>
          <button onClick={onCollect} className="flex-1 py-1.5 rounded-xl border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-border)]/30 transition-colors opacity-70">Collect</button>
          <button onClick={onStats} className="flex-1 py-1.5 rounded-xl border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-border)]/30 transition-colors opacity-70">Stats</button>
          <button onClick={onEdit} className="flex-1 py-1.5 rounded-xl border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-border)]/30 transition-colors opacity-70">Edit</button>
          <button onClick={onDelete} className="w-8 py-1.5 rounded-xl border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-colors flex items-center justify-center">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AgentWalletsScreen() {
  const { activeId, agentWallets, keypair, createAgentWallet, updateAgentGuardrails, saveAgentWallet, toggleAgent, deleteAgentWallet, fundAgent, collectFromAgent } = useWallet()
  const { toast } = useToast()
  const myAgents = agentWallets.filter(a => a.walletId === activeId)

  // Create flow state
  const [createStep, setCreateStep] = useState<'template' | 'details'>('template')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(AGENT_TEMPLATES[0])
  const [createName, setCreateName] = useState('')
  const [createGuardrails, setCreateGuardrails] = useState<AgentGuardrails>({ ...DEFAULT_GUARDRAILS })
  const [createPassword, setCreatePassword] = useState('')
  const [createError, setCreateError] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Edit state
  const [editTarget, setEditTarget] = useState<AgentWallet | null>(null)
  const [editGuardrails, setEditGuardrails] = useState<AgentGuardrails>({ ...DEFAULT_GUARDRAILS })
  const [editAutoRefill, setEditAutoRefill] = useState<AgentAutoRefill>({ enabled: false, thresholdSol: 0.05, refillAmountSol: 0.1 })
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Fund/Collect/Delete state
  const [fundTarget, setFundTarget] = useState<AgentWallet | null>(null)
  const [fundAmount, setFundAmount] = useState('')
  const [fundError, setFundError] = useState('')
  const [isFunding, setIsFunding] = useState(false)
  const [collectTarget, setCollectTarget] = useState<AgentWallet | null>(null)
  const [collectPassword, setCollectPassword] = useState('')
  const [collectError, setCollectError] = useState('')
  const [isCollecting, setIsCollecting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AgentWallet | null>(null)

  // Analytics state
  const [statsTarget, setStatsTarget] = useState<AgentWallet | null>(null)
  const [statsTxs, setStatsTxs] = useState<TxRecord[]>([])
  const [statsAllowances, setStatsAllowances] = useState<TokenAllowance[]>([])

  function openCreate() {
    setCreateStep('template')
    setSelectedTemplate(AGENT_TEMPLATES[0])
    setCreateName('')
    setCreatePassword('')
    setCreateError('')
    setShowCreate(true)
  }

  function selectTemplate(t: typeof AGENT_TEMPLATES[0]) {
    setSelectedTemplate(t)
    setCreateGuardrails({ ...t.guardrails })
    setCreateStep('details')
  }

  async function handleCreate() {
    if (!createName.trim()) return setCreateError('Enter a name')
    if (!createPassword) return setCreateError('Enter your password')
    setIsCreating(true)
    setCreateError('')
    try {
      await createAgentWallet(createPassword, createName.trim(), createGuardrails)
      setShowCreate(false)
      toast('Agent wallet created', 'success')
    } catch (e: any) {
      setCreateError(e.message?.includes('Incorrect') || e.message?.includes('decrypt') ? 'Incorrect password' : (e.message ?? 'Failed'))
    } finally {
      setIsCreating(false)
    }
  }

  function openEdit(agent: AgentWallet) {
    setEditTarget(agent)
    setEditGuardrails({ ...DEFAULT_GUARDRAILS, ...agent.guardrails, tokenBudgets: { ...(agent.guardrails.tokenBudgets ?? {}) }, allowedTokens: [...(agent.guardrails.allowedTokens ?? [])] })
    setEditAutoRefill(agent.autoRefill ?? { enabled: false, thresholdSol: 0.05, refillAmountSol: 0.1 })
  }

  async function handleSaveEdit() {
    if (!editTarget) return
    setIsSavingEdit(true)
    try {
      await saveAgentWallet({ ...editTarget, guardrails: editGuardrails, autoRefill: editAutoRefill })
      setEditTarget(null)
      toast('Settings saved', 'success')
    } finally {
      setIsSavingEdit(false)
    }
  }

  async function handleFund() {
    if (!fundTarget) return
    const amount = parseFloat(fundAmount)
    if (!amount || amount <= 0) return setFundError('Enter a valid amount')
    if (!keypair) return setFundError('Wallet is locked')
    setIsFunding(true)
    setFundError('')
    try {
      const sig = await fundAgent(fundTarget.id, amount)
      setFundTarget(null)
      setFundAmount('')
      toast(`Funded! Tx: ${sig.slice(0, 8)}…`, 'success')
    } catch (e: any) {
      setFundError(e.message ?? 'Failed')
    } finally {
      setIsFunding(false)
    }
  }

  async function handleCollect() {
    if (!collectTarget) return
    if (!collectPassword) return setCollectError('Enter your password')
    setIsCollecting(true)
    setCollectError('')
    try {
      const sig = await collectFromAgent(collectTarget.id, collectPassword)
      setCollectTarget(null)
      setCollectPassword('')
      toast(`Collected! Tx: ${sig.slice(0, 8)}…`, 'success')
    } catch (e: any) {
      setCollectError(e.message?.includes('Incorrect') || e.message?.includes('decrypt') ? 'Incorrect password' : (e.message ?? 'Failed'))
    } finally {
      setIsCollecting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteAgentWallet(deleteTarget.id)
    setDeleteTarget(null)
    toast('Agent wallet deleted', 'success')
  }

  async function openStats(agent: AgentWallet) {
    setStatsTarget(agent)
    const [log, allowances] = await Promise.all([
      getLocal('txLog'),
      getAgentAllowances(agent.id),
    ])
    setStatsTxs((log ?? []).filter((t: TxRecord) => t.agentId === agent.id))
    setStatsAllowances(allowances)
  }

  async function handleRevokeAllowance(id: string) {
    await revokeAllowance(id)
    if (statsTarget) setStatsAllowances(prev => prev.filter(a => a.id !== id))
    toast('Allowance revoked', 'success')
  }

  // Analytics: build 7-day chart data
  function buildDailyChart(txs: TxRecord[]) {
    const days: { label: string; amount: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
      const dayTs = d.getTime()
      const nextDay = dayTs + 86_400_000
      const total = txs.filter(t => t.timestamp >= dayTs && t.timestamp < nextDay && t.status === 'success')
        .reduce((s, t) => s + (t.amount ?? 0), 0)
      days.push({ label: d.toLocaleDateString('en', { weekday: 'short' }), amount: total })
    }
    return days
  }

  function buildTopRecipients(txs: TxRecord[]) {
    const map: Record<string, number> = {}
    txs.filter(t => t.status === 'success' && t.toOrFrom).forEach(t => {
      map[t.toOrFrom!] = (map[t.toOrFrom!] ?? 0) + (t.amount ?? 0)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      <Header />
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        <div className="flex items-center justify-between py-3">
          <h2 className="text-lg font-bold">Agent Wallets</h2>
          <motion.button whileTap={{ scale: 0.93 }} onClick={openCreate}
            className="flex items-center gap-1.5 bg-primary text-black text-xs font-semibold px-3 py-1.5 rounded-xl">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Agent
          </motion.button>
        </div>

        <div className="mb-3 card-bg rounded-2xl px-4 py-3">
          <p className="text-[10px] opacity-50 leading-relaxed">
            Agent wallets auto-sign payments without confirmation. Use <span className="font-mono text-primary">window.solaiAgent.pay()</span> for SOL, <span className="font-mono text-primary">.payToken()</span> for USDC/USDT, or <span className="font-mono text-primary">.swapAndPay()</span> to swap then send.
          </p>
        </div>

        {myAgents.length === 0 ? (
          <div className="card-bg rounded-3xl px-4 py-10 flex flex-col items-center gap-2 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <p className="text-sm opacity-40">No agent wallets yet</p>
            <p className="text-xs opacity-30">Create one to enable automated payments</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {myAgents.map(agent => (
              <AgentCard key={agent.id} agent={agent}
                onToggle={enabled => toggleAgent(agent.id, enabled)}
                onEdit={() => openEdit(agent)}
                onFund={() => { setFundTarget(agent); setFundAmount(''); setFundError('') }}
                onCollect={() => { setCollectTarget(agent); setCollectPassword(''); setCollectError('') }}
                onDelete={() => setDeleteTarget(agent)}
                onStats={() => openStats(agent)}
              />
            ))}
          </div>
        )}
      </div>

      <BottomNav />

      {/* ── Create Sheet ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-end z-50"
            onClick={() => !isCreating && setShowCreate(false)}>
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className="w-full bg-[var(--color-card)] rounded-t-3xl p-5 flex flex-col gap-3 max-h-[92%] overflow-y-auto"
              onClick={e => e.stopPropagation()}>

              {createStep === 'template' ? (
                <>
                  <p className="text-sm font-semibold text-center">Choose a Template</p>
                  <div className="grid grid-cols-2 gap-2">
                    {AGENT_TEMPLATES.map(t => (
                      <motion.button key={t.id} whileTap={{ scale: 0.95 }}
                        onClick={() => selectTemplate(t)}
                        className="flex flex-col items-start gap-1.5 card-bg rounded-2xl p-3 border border-[var(--color-border)] hover:border-primary/40 transition-colors text-left">
                        <span className="text-primary opacity-70">{TEMPLATE_ICONS[t.id]}</span>
                        <p className="text-xs font-semibold">{t.name}</p>
                        <p className="text-[10px] opacity-40 leading-snug">{t.description}</p>
                      </motion.button>
                    ))}
                  </div>
                  <button onClick={() => setShowCreate(false)} className="w-full py-2 text-sm opacity-40">Cancel</button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCreateStep('template')} className="opacity-40 hover:opacity-80">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <p className="text-sm font-semibold flex-1 text-center">{selectedTemplate.name}</p>
                    <div className="w-4" />
                  </div>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs opacity-50">Agent name</span>
                    <input className="rounded-xl px-3 py-2.5 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] outline-none focus:border-primary/60"
                      placeholder="e.g. DeFi Bot"
                      value={createName}
                      onChange={e => { setCreateName(e.target.value); setCreateError('') }} />
                  </label>

                  <GuardrailsEditor guardrails={createGuardrails} onChange={setCreateGuardrails} />

                  <label className="flex flex-col gap-1">
                    <span className="text-xs opacity-50">Wallet password</span>
                    <input type="password"
                      className="rounded-xl px-3 py-2.5 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] outline-none focus:border-primary/60"
                      placeholder="Enter your wallet password"
                      value={createPassword}
                      onChange={e => { setCreatePassword(e.target.value); setCreateError('') }}
                      onKeyDown={e => e.key === 'Enter' && handleCreate()} />
                  </label>
                  {createError && <p className="text-xs text-red-400">{createError}</p>}
                  <button onClick={handleCreate} disabled={isCreating}
                    className="w-full py-3 rounded-2xl bg-primary text-black text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
                    {isCreating ? <><Spinner size="sm" /> Creating…</> : 'Create Agent Wallet'}
                  </button>
                  <button onClick={() => setShowCreate(false)} className="w-full py-2 text-sm opacity-40">Cancel</button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Edit Sheet ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {editTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-end z-50"
            onClick={() => !isSavingEdit && setEditTarget(null)}>
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className="w-full bg-[var(--color-card)] rounded-t-3xl p-5 flex flex-col gap-3 max-h-[92%] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <p className="text-sm font-semibold text-center">Edit — {editTarget.name}</p>

              <GuardrailsEditor guardrails={editGuardrails} onChange={setEditGuardrails} />

              {/* Auto-refill */}
              <div className="card-bg rounded-2xl p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold">Auto-Refill</p>
                    <p className="text-[10px] opacity-40">Auto-top-up from main wallet when low</p>
                  </div>
                  <button
                    onClick={() => setEditAutoRefill(r => ({ ...r, enabled: !r.enabled }))}
                    className={`w-10 h-5 rounded-full relative transition-colors ${editAutoRefill.enabled ? 'bg-primary' : 'bg-[var(--color-border)]'}`}>
                    <motion.div animate={{ x: editAutoRefill.enabled ? 20 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow" />
                  </button>
                </div>
                {editAutoRefill.enabled && (
                  <>
                    <GuardrailField label="Refill when below (SOL)" value={editAutoRefill.thresholdSol}
                      onChange={v => setEditAutoRefill(r => ({ ...r, thresholdSol: v }))} />
                    <GuardrailField label="Refill amount (SOL)" value={editAutoRefill.refillAmountSol}
                      onChange={v => setEditAutoRefill(r => ({ ...r, refillAmountSol: v }))} />
                  </>
                )}
              </div>

              <button onClick={handleSaveEdit} disabled={isSavingEdit}
                className="w-full py-3 rounded-2xl bg-primary text-black text-sm font-semibold disabled:opacity-40">
                {isSavingEdit ? 'Saving…' : 'Save Settings'}
              </button>
              <button onClick={() => setEditTarget(null)} className="w-full py-2 text-sm opacity-40">Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stats Sheet ────────────────────────────────────────────── */}
      <AnimatePresence>
        {statsTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-end z-50"
            onClick={() => setStatsTarget(null)}>
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className="w-full bg-[var(--color-card)] rounded-t-3xl p-5 flex flex-col gap-4 max-h-[90%] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <p className="text-sm font-semibold text-center">Stats — {statsTarget.name}</p>

              {/* Summary row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Total txns', value: String(statsTarget.stats.txCount) },
                  { label: 'Total SOL', value: statsTarget.stats.totalSpentSol.toFixed(4) },
                  { label: 'Today SOL', value: statsTarget.stats.dailySpentSol.toFixed(4) },
                ].map(s => (
                  <div key={s.label} className="card-bg rounded-2xl p-2.5 text-center">
                    <p className="text-sm font-bold">{s.value}</p>
                    <p className="text-[9px] opacity-40">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* 7-day chart */}
              <div>
                <p className="text-[10px] opacity-40 uppercase tracking-widest mb-2">7-day spend</p>
                <SpendChart days={buildDailyChart(statsTxs)} />
              </div>

              {/* Top recipients */}
              {buildTopRecipients(statsTxs).length > 0 && (
                <div>
                  <p className="text-[10px] opacity-40 uppercase tracking-widest mb-2">Top recipients</p>
                  <div className="flex flex-col gap-1.5">
                    {buildTopRecipients(statsTxs).map(([addr, amt]) => (
                      <div key={addr} className="flex items-center justify-between">
                        <p className="text-[10px] font-mono opacity-50 truncate max-w-[200px]">{addr.slice(0, 8)}…{addr.slice(-6)}</p>
                        <p className="text-[10px] font-semibold">{amt.toFixed(4)} SOL</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Allowances */}
              {statsAllowances.length > 0 && (
                <div>
                  <p className="text-[10px] opacity-40 uppercase tracking-widest mb-2">Active Allowances</p>
                  <div className="flex flex-col gap-2">
                    {statsAllowances.map(a => {
                      const hostname = (() => { try { return new URL(a.origin).hostname } catch { return a.origin } })()
                      const expDate = new Date(a.expiresAt).toLocaleDateString()
                      const remaining = a.maxAmount - a.spentAmount
                      return (
                        <div key={a.id} className="card-bg rounded-2xl p-3 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">{hostname}</p>
                            <p className="text-[10px] opacity-40">{remaining.toFixed(2)}/{a.maxAmount} {a.token} · expires {expDate}</p>
                          </div>
                          <button onClick={() => handleRevokeAllowance(a.id)}
                            className="text-[10px] px-2 py-1 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors shrink-0">
                            Revoke
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <button onClick={() => setStatsTarget(null)} className="w-full py-2.5 rounded-2xl border border-[var(--color-border)] text-sm opacity-60">Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Fund / Collect / Delete (unchanged) ───────────────────── */}
      <AnimatePresence>
        {fundTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-end z-50" onClick={() => !isFunding && setFundTarget(null)}>
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className="w-full bg-[var(--color-card)] rounded-t-3xl p-5 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
              <p className="text-sm font-semibold text-center">Fund — {fundTarget.name}</p>
              <p className="text-xs opacity-40 text-center">Send SOL from your main wallet to this agent.</p>
              <label className="flex flex-col gap-1">
                <span className="text-xs opacity-50">Amount (SOL)</span>
                <input type="number" min="0" step="0.001"
                  className="rounded-xl px-3 py-2.5 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] outline-none focus:border-primary/60"
                  placeholder="0.01" value={fundAmount}
                  onChange={e => { setFundAmount(e.target.value); setFundError('') }} />
              </label>
              {fundError && <p className="text-xs text-red-400">{fundError}</p>}
              <button onClick={handleFund} disabled={isFunding}
                className="w-full py-3 rounded-2xl bg-primary text-black text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
                {isFunding ? <><Spinner size="sm" /> Sending…</> : 'Send SOL to Agent'}
              </button>
              <button onClick={() => setFundTarget(null)} className="w-full py-2 text-sm opacity-40">Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {collectTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-end z-50" onClick={() => !isCollecting && setCollectTarget(null)}>
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className="w-full bg-[var(--color-card)] rounded-t-3xl p-5 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
              <p className="text-sm font-semibold text-center">Collect — {collectTarget.name}</p>
              <p className="text-xs opacity-40 text-center">Sweep all SOL from this agent back to your main wallet.</p>
              <label className="flex flex-col gap-1">
                <span className="text-xs opacity-50">Password</span>
                <input type="password"
                  className="rounded-xl px-3 py-2.5 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] outline-none focus:border-primary/60"
                  placeholder="Enter your wallet password" value={collectPassword}
                  onChange={e => { setCollectPassword(e.target.value); setCollectError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleCollect()} />
              </label>
              {collectError && <p className="text-xs text-red-400">{collectError}</p>}
              <button onClick={handleCollect} disabled={isCollecting}
                className="w-full py-3 rounded-2xl bg-primary text-black text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
                {isCollecting ? <><Spinner size="sm" /> Collecting…</> : 'Collect SOL'}
              </button>
              <button onClick={() => setCollectTarget(null)} className="w-full py-2 text-sm opacity-40">Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-end z-50" onClick={() => setDeleteTarget(null)}>
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className="w-full bg-[var(--color-card)] rounded-t-3xl p-5 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
              <p className="text-sm font-semibold text-center">Delete Agent Wallet?</p>
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3">
                <p className="text-xs text-red-400"><span className="font-medium">{deleteTarget.name}</span> will be removed. Collect funds first or they become inaccessible.</p>
              </div>
              <button onClick={handleDelete} className="w-full py-3 rounded-2xl bg-red-500 text-white text-sm font-semibold">Delete Agent Wallet</button>
              <button onClick={() => setDeleteTarget(null)} className="w-full py-2 text-sm opacity-40">Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function GuardrailField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] opacity-50">{label}</span>
      <input type="number" min="0" step="0.001"
        className="rounded-xl px-3 py-2 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] outline-none focus:border-primary/60"
        value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)} />
    </label>
  )
}

function GuardrailsEditor({ guardrails, onChange }: { guardrails: AgentGuardrails; onChange: (g: AgentGuardrails) => void }) {
  const [showTokenBudgets, setShowTokenBudgets] = useState(false)
  const BUDGET_TOKENS = ['USDC', 'USDT']

  return (
    <div className="card-bg rounded-2xl p-3 flex flex-col gap-2.5">
      <p className="text-[10px] opacity-40 uppercase tracking-widest">Guardrails</p>
      <GuardrailField label="Daily budget (SOL, 0 = unlimited)" value={guardrails.dailyBudgetSol}
        onChange={v => onChange({ ...guardrails, dailyBudgetSol: v })} />
      <GuardrailField label="Per-tx limit (SOL, 0 = unlimited)" value={guardrails.perTxLimitSol}
        onChange={v => onChange({ ...guardrails, perTxLimitSol: v })} />
      <GuardrailField label="Cooldown (seconds, 0 = none)" value={guardrails.cooldownMs / 1000}
        onChange={v => onChange({ ...guardrails, cooldownMs: v * 1000 })} />
      <label className="flex flex-col gap-1">
        <span className="text-[10px] opacity-50">Allowed origins (one per line, empty = any)</span>
        <textarea rows={2}
          className="rounded-xl px-3 py-2 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] outline-none focus:border-primary/60 resize-none font-mono"
          placeholder="https://app.example.com"
          value={(guardrails.allowedOrigins ?? []).join('\n')}
          onChange={e => onChange({ ...guardrails, allowedOrigins: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] opacity-50">Allowed tokens (comma-separated, empty = any)</span>
        <input className="rounded-xl px-3 py-2 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] outline-none focus:border-primary/60"
          placeholder="SOL, USDC, USDT"
          value={(guardrails.allowedTokens ?? []).join(', ')}
          onChange={e => onChange({ ...guardrails, allowedTokens: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
      </label>

      <button onClick={() => setShowTokenBudgets(v => !v)}
        className="flex items-center gap-1.5 text-[10px] text-primary opacity-70 hover:opacity-100 transition-opacity self-start">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {showTokenBudgets ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
        </svg>
        {showTokenBudgets ? 'Hide' : 'Set'} token budgets (USDC / USDT)
      </button>

      {showTokenBudgets && BUDGET_TOKENS.map(sym => {
        const b = (guardrails.tokenBudgets ?? {})[sym] ?? { daily: 0, perTx: 0 }
        return (
          <div key={sym} className="flex flex-col gap-2 pl-2 border-l border-primary/20">
            <p className="text-[10px] font-semibold opacity-60">{sym}</p>
            <GuardrailField label={`Daily limit (${sym}, 0 = unlimited)`} value={b.daily}
              onChange={v => onChange({ ...guardrails, tokenBudgets: { ...(guardrails.tokenBudgets ?? {}), [sym]: { ...b, daily: v } } })} />
            <GuardrailField label={`Per-tx limit (${sym}, 0 = unlimited)`} value={b.perTx}
              onChange={v => onChange({ ...guardrails, tokenBudgets: { ...(guardrails.tokenBudgets ?? {}), [sym]: { ...b, perTx: v } } })} />
          </div>
        )
      })}
    </div>
  )
}

function SpendChart({ days }: { days: { label: string; amount: number }[] }) {
  const max = Math.max(...days.map(d => d.amount), 0.0001)
  return (
    <div className="flex items-end gap-1.5 h-16">
      {days.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t-md bg-primary/20 flex items-end" style={{ height: 48 }}>
            <div className="w-full rounded-t-md bg-primary transition-all"
              style={{ height: `${(d.amount / max) * 100}%`, minHeight: d.amount > 0 ? 2 : 0 }} />
          </div>
          <span className="text-[8px] opacity-30">{d.label}</span>
        </div>
      ))}
    </div>
  )
}
