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
import type { AgentWallet, AgentGuardrails } from '../../types/agent'
import type { TxRecord } from '../../types/history'

function truncate(s: string) {
  return s ? `${s.slice(0, 6)}...${s.slice(-6)}` : ''
}

const DEFAULT_GUARDRAILS: AgentGuardrails = {
  dailyBudgetSol: 0,
  perTxLimitSol: 0,
  allowedOrigins: [],
  cooldownMs: 0,
}

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
}

function AgentCard({ agent, onToggle, onEdit, onFund, onCollect, onDelete }: AgentCardProps) {
  const { network } = useWallet()
  const [balance, setBalance] = useState<number | null>(null)
  const [recentTxs, setRecentTxs] = useState<TxRecord[]>([])

  useEffect(() => {
    getSolBalance(agent.publicKey, network).then(setBalance).catch(() => setBalance(0))
    getLocal('txLog').then(log => {
      const matching = (log ?? [])
        .filter(t => t.agentId === agent.id && t.network === network)
        .slice(0, 5)
      setRecentTxs(matching)
    })
  }, [agent.id, agent.publicKey, network, agent.stats.txCount])

  const g = agent.guardrails
  const s = agent.stats
  const budgetPct = g.dailyBudgetSol > 0 ? Math.min(1, s.dailySpentSol / g.dailyBudgetSol) : 0

  return (
    <div className={`card-bg rounded-3xl overflow-hidden border ${agent.enabled ? 'border-[var(--color-border)]' : 'border-red-500/30'}`}>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">{agent.name}</p>
            {!agent.enabled && (
              <span className="text-[9px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full font-medium">disabled</span>
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
            <p className="text-xs font-semibold">
              {balance === null ? '—' : `${balance.toFixed(4)} SOL`}
            </p>
            <p className="text-[9px] opacity-40 mt-0.5">Balance</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold">
              {g.dailyBudgetSol > 0 ? `${s.dailySpentSol.toFixed(4)} / ${g.dailyBudgetSol} SOL` : 'Unlimited'}
            </p>
            <p className="text-[9px] opacity-40 mt-0.5">Daily spend</p>
          </div>
        </div>

        {g.dailyBudgetSol > 0 && (
          <div className="h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${budgetPct * 100}%`, background: budgetPct > 0.8 ? '#ef4444' : undefined }}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          <GuardrailBadge label="per-tx" value={g.perTxLimitSol > 0 ? `≤${g.perTxLimitSol} SOL` : 'unlimited'} />
          <GuardrailBadge label="cooldown" value={g.cooldownMs > 0 ? `${g.cooldownMs / 1000}s` : 'none'} />
          <GuardrailBadge label="origins" value={g.allowedOrigins.length > 0 ? `${g.allowedOrigins.length} allowed` : 'any'} />
        </div>

        {recentTxs.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-[9px] opacity-30 uppercase tracking-widest">Recent</p>
            {recentTxs.map(tx => (
              <div key={tx.sig} className="flex items-center justify-between">
                <p className="text-[10px] font-mono opacity-40 truncate max-w-[160px]">{tx.sig.slice(0, 12)}…</p>
                <p className={`text-[10px] ${tx.status === 'success' ? 'text-primary' : 'text-red-400'}`}>
                  {tx.status === 'success' ? `−${tx.amount ?? '?'} SOL` : 'failed'}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-1.5">
          <button onClick={onFund}
            className="flex-1 py-1.5 rounded-xl border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10 transition-colors">
            Fund
          </button>
          <button onClick={onCollect}
            className="flex-1 py-1.5 rounded-xl border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-border)]/30 transition-colors opacity-70">
            Collect
          </button>
          <button onClick={onEdit}
            className="flex-1 py-1.5 rounded-xl border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-border)]/30 transition-colors opacity-70">
            Edit
          </button>
          <button onClick={onDelete}
            className="w-8 py-1.5 rounded-xl border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-colors flex items-center justify-center">
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
  const {
    activeId, agentWallets, keypair,
    createAgentWallet, updateAgentGuardrails, toggleAgent, deleteAgentWallet,
    fundAgent, collectFromAgent,
  } = useWallet()
  const { toast } = useToast()

  const myAgents = agentWallets.filter(a => a.walletId === activeId)

  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createGuardrails, setCreateGuardrails] = useState<AgentGuardrails>({ ...DEFAULT_GUARDRAILS })
  const [createPassword, setCreatePassword] = useState('')
  const [createError, setCreateError] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const [editTarget, setEditTarget] = useState<AgentWallet | null>(null)
  const [editGuardrails, setEditGuardrails] = useState<AgentGuardrails>({ ...DEFAULT_GUARDRAILS })
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const [fundTarget, setFundTarget] = useState<AgentWallet | null>(null)
  const [fundAmount, setFundAmount] = useState('')
  const [fundError, setFundError] = useState('')
  const [isFunding, setIsFunding] = useState(false)

  const [collectTarget, setCollectTarget] = useState<AgentWallet | null>(null)
  const [collectPassword, setCollectPassword] = useState('')
  const [collectError, setCollectError] = useState('')
  const [isCollecting, setIsCollecting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<AgentWallet | null>(null)

  async function handleCreate() {
    if (!createName.trim()) return setCreateError('Enter a name')
    if (!createPassword) return setCreateError('Enter your password')
    setIsCreating(true)
    setCreateError('')
    try {
      await createAgentWallet(createPassword, createName.trim(), createGuardrails)
      setShowCreate(false)
      setCreateName('')
      setCreatePassword('')
      setCreateGuardrails({ ...DEFAULT_GUARDRAILS })
      toast('Agent wallet created', 'success')
    } catch (e: any) {
      setCreateError(e.message?.includes('Incorrect') || e.message?.includes('decrypt') ? 'Incorrect password' : (e.message ?? 'Failed'))
    } finally {
      setIsCreating(false)
    }
  }

  async function handleSaveEdit() {
    if (!editTarget) return
    setIsSavingEdit(true)
    try {
      await updateAgentGuardrails(editTarget.id, editGuardrails)
      setEditTarget(null)
      toast('Guardrails updated', 'success')
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

  function openEdit(agent: AgentWallet) {
    setEditTarget(agent)
    setEditGuardrails({ ...agent.guardrails })
  }

  function openFund(agent: AgentWallet) {
    setFundTarget(agent)
    setFundAmount('')
    setFundError('')
  }

  function openCollect(agent: AgentWallet) {
    setCollectTarget(agent)
    setCollectPassword('')
    setCollectError('')
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      <Header />
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        <div className="flex items-center justify-between py-3">
          <h2 className="text-lg font-bold">Agent Wallets</h2>
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => { setShowCreate(true); setCreateName(''); setCreatePassword(''); setCreateError('') }}
            className="flex items-center gap-1.5 bg-primary text-black text-xs font-semibold px-3 py-1.5 rounded-xl"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Agent
          </motion.button>
        </div>

        <div className="mb-3 card-bg rounded-2xl px-4 py-3">
          <p className="text-[10px] opacity-50 leading-relaxed">
            Agent wallets auto-sign payments without confirmation. Set guardrails to control spend. Use <span className="font-mono text-primary">window.solaiAgent.pay()</span> to trigger payments from web apps.
          </p>
        </div>

        {myAgents.length === 0 ? (
          <div className="card-bg rounded-3xl px-4 py-10 flex flex-col items-center gap-2 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <p className="text-sm opacity-40">No agent wallets yet</p>
            <p className="text-xs opacity-30">Create one to enable automated payments</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {myAgents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onToggle={enabled => toggleAgent(agent.id, enabled)}
                onEdit={() => openEdit(agent)}
                onFund={() => openFund(agent)}
                onCollect={() => openCollect(agent)}
                onDelete={() => setDeleteTarget(agent)}
              />
            ))}
          </div>
        )}
      </div>

      <BottomNav />

      {/* Create Sheet */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-end z-50"
            onClick={() => !isCreating && setShowCreate(false)}
          >
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className="w-full bg-[var(--color-card)] rounded-t-3xl p-5 flex flex-col gap-3 max-h-[90%] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-center">Create Agent Wallet</p>

              <label className="flex flex-col gap-1">
                <span className="text-xs opacity-50">Name</span>
                <input
                  className="rounded-xl px-3 py-2.5 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] outline-none focus:border-primary/60"
                  placeholder="e.g. DeFi Bot"
                  value={createName}
                  onChange={e => { setCreateName(e.target.value); setCreateError('') }}
                />
              </label>

              <div className="card-bg rounded-2xl p-3 flex flex-col gap-2.5">
                <p className="text-[10px] opacity-40 uppercase tracking-widest">Guardrails</p>
                <GuardrailField label="Daily budget (SOL, 0 = unlimited)" value={createGuardrails.dailyBudgetSol}
                  onChange={v => setCreateGuardrails(g => ({ ...g, dailyBudgetSol: v }))} />
                <GuardrailField label="Per-tx limit (SOL, 0 = unlimited)" value={createGuardrails.perTxLimitSol}
                  onChange={v => setCreateGuardrails(g => ({ ...g, perTxLimitSol: v }))} />
                <GuardrailField label="Cooldown (seconds, 0 = none)" value={createGuardrails.cooldownMs / 1000}
                  onChange={v => setCreateGuardrails(g => ({ ...g, cooldownMs: v * 1000 }))} />
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] opacity-50">Allowed origins (one per line, empty = any)</span>
                  <textarea
                    rows={2}
                    className="rounded-xl px-3 py-2 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] outline-none focus:border-primary/60 resize-none font-mono"
                    placeholder="https://app.example.com"
                    value={createGuardrails.allowedOrigins.join('\n')}
                    onChange={e => setCreateGuardrails(g => ({ ...g, allowedOrigins: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) }))}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs opacity-50">Wallet password</span>
                <input type="password"
                  className="rounded-xl px-3 py-2.5 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] outline-none focus:border-primary/60"
                  placeholder="Enter your wallet password"
                  value={createPassword}
                  onChange={e => { setCreatePassword(e.target.value); setCreateError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
              </label>
              {createError && <p className="text-xs text-red-400">{createError}</p>}
              <button onClick={handleCreate} disabled={isCreating}
                className="w-full py-3 rounded-2xl bg-primary text-black text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
                {isCreating ? <><Spinner size="sm" /> Creating…</> : 'Create Agent Wallet'}
              </button>
              <button onClick={() => setShowCreate(false)} className="w-full py-2 text-sm opacity-40">Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Guardrails Sheet */}
      <AnimatePresence>
        {editTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-end z-50"
            onClick={() => !isSavingEdit && setEditTarget(null)}
          >
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className="w-full bg-[var(--color-card)] rounded-t-3xl p-5 flex flex-col gap-3 max-h-[90%] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-center">Edit Guardrails — {editTarget.name}</p>
              <div className="flex flex-col gap-2.5">
                <GuardrailField label="Daily budget (SOL, 0 = unlimited)" value={editGuardrails.dailyBudgetSol}
                  onChange={v => setEditGuardrails(g => ({ ...g, dailyBudgetSol: v }))} />
                <GuardrailField label="Per-tx limit (SOL, 0 = unlimited)" value={editGuardrails.perTxLimitSol}
                  onChange={v => setEditGuardrails(g => ({ ...g, perTxLimitSol: v }))} />
                <GuardrailField label="Cooldown (seconds, 0 = none)" value={editGuardrails.cooldownMs / 1000}
                  onChange={v => setEditGuardrails(g => ({ ...g, cooldownMs: v * 1000 }))} />
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] opacity-50">Allowed origins (one per line, empty = any)</span>
                  <textarea
                    rows={2}
                    className="rounded-xl px-3 py-2 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] outline-none focus:border-primary/60 resize-none font-mono"
                    placeholder="https://app.example.com"
                    value={editGuardrails.allowedOrigins.join('\n')}
                    onChange={e => setEditGuardrails(g => ({ ...g, allowedOrigins: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) }))}
                  />
                </label>
              </div>
              <button onClick={handleSaveEdit} disabled={isSavingEdit}
                className="w-full py-3 rounded-2xl bg-primary text-black text-sm font-semibold disabled:opacity-40">
                {isSavingEdit ? 'Saving…' : 'Save Guardrails'}
              </button>
              <button onClick={() => setEditTarget(null)} className="w-full py-2 text-sm opacity-40">Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fund Sheet */}
      <AnimatePresence>
        {fundTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-end z-50"
            onClick={() => !isFunding && setFundTarget(null)}
          >
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className="w-full bg-[var(--color-card)] rounded-t-3xl p-5 flex flex-col gap-3"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-center">Fund — {fundTarget.name}</p>
              <p className="text-xs opacity-40 text-center">Send SOL from your main wallet to this agent.</p>
              <label className="flex flex-col gap-1">
                <span className="text-xs opacity-50">Amount (SOL)</span>
                <input type="number" min="0" step="0.001"
                  className="rounded-xl px-3 py-2.5 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] outline-none focus:border-primary/60"
                  placeholder="0.01"
                  value={fundAmount}
                  onChange={e => { setFundAmount(e.target.value); setFundError('') }}
                />
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

      {/* Collect Sheet */}
      <AnimatePresence>
        {collectTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-end z-50"
            onClick={() => !isCollecting && setCollectTarget(null)}
          >
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className="w-full bg-[var(--color-card)] rounded-t-3xl p-5 flex flex-col gap-3"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-center">Collect — {collectTarget.name}</p>
              <p className="text-xs opacity-40 text-center">Sweep all SOL from this agent back to your main wallet.</p>
              <label className="flex flex-col gap-1">
                <span className="text-xs opacity-50">Password</span>
                <input type="password"
                  className="rounded-xl px-3 py-2.5 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] outline-none focus:border-primary/60"
                  placeholder="Enter your wallet password"
                  value={collectPassword}
                  onChange={e => { setCollectPassword(e.target.value); setCollectError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleCollect()}
                />
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

      {/* Delete Confirm Sheet */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-end z-50"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className="w-full bg-[var(--color-card)] rounded-t-3xl p-5 flex flex-col gap-3"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-center">Delete Agent Wallet?</p>
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3">
                <p className="text-xs text-red-400">
                  <span className="font-medium">{deleteTarget.name}</span> will be removed. Any remaining funds in the agent wallet will be inaccessible unless you collect first.
                </p>
              </div>
              <button onClick={handleDelete}
                className="w-full py-3 rounded-2xl bg-red-500 text-white text-sm font-semibold">
                Delete Agent Wallet
              </button>
              <button onClick={() => setDeleteTarget(null)} className="w-full py-2 text-sm opacity-40">Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function GuardrailField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] opacity-50">{label}</span>
      <input type="number" min="0" step="0.001"
        className="rounded-xl px-3 py-2 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] outline-none focus:border-primary/60"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
      />
    </label>
  )
}
