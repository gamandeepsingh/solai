import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import Header from '../../components/layout/Header'
import BottomNav from '../../components/layout/BottomNav'
import CopyButton from '../../components/ui/CopyButton'
import FadeIn from '../../components/animations/FadeIn'
import Spinner from '../../components/ui/Spinner'
import { useWallet } from '../../context/WalletContext'
import { useTheme } from '../../context/ThemeContext'
import { useToast } from '../../components/ui/Toast'
import { getSolBalance, getAllSplTokenBalances } from '../../lib/solana'
import { CURATED_TOKENS, getMintForNetwork } from '../../lib/tokens'
import type { StealthAddress } from '../../context/WalletContext'
import type { Network } from '../../types/wallet'

function truncate(s: string) {
  return s ? `${s.slice(0, 6)}...${s.slice(-6)}` : ''
}

function fmtAmount(n: number, decimals = 6): string {
  if (n === 0) return '0'
  if (n < 0.0001) return n.toExponential(2)
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return n.toFixed(Math.min(decimals, 4))
}

interface TokenBal { symbol: string; amount: number; logoUri: string }

async function fetchStealthBalances(publicKey: string, network: Network): Promise<TokenBal[]> {
  const [sol, splTokens] = await Promise.all([
    getSolBalance(publicKey, network),
    getAllSplTokenBalances(publicKey, network).catch(() => []),
  ])
  const mintMap = new Map(splTokens.map(t => [t.mint, t.amount]))
  const results: TokenBal[] = []
  if (sol > 0) {
    const meta = CURATED_TOKENS.find(t => t.symbol === 'SOL')!
    results.push({ symbol: 'SOL', amount: sol, logoUri: meta.logoUri })
  }
  for (const meta of CURATED_TOKENS) {
    if (meta.symbol === 'SOL') continue
    const mint = getMintForNetwork(meta, network)
    const amount = mintMap.get(mint) ?? 0
    if (amount > 0) results.push({ symbol: meta.symbol, amount, logoUri: meta.logoUri })
  }
  return results
}

export default function ReceiveScreen() {
  const { account, activeId, network, stealthAddresses, generateStealthAddress, collectFromStealth, deleteStealthAddress } = useWallet()
  const { theme } = useTheme()
  const { toast } = useToast()
  const address = account?.publicKey ?? ''
  const [tab, setTab] = useState<'main' | 'stealth'>('main')
  const [isClaiming, setIsClaiming] = useState(false)
  const [faucetCooldownHrs, setFaucetCooldownHrs] = useState(0)

  const FAUCET_KEY = '_faucetLastClaim'
  const FAUCET_COOLDOWN_MS = 24 * 60 * 60 * 1000

  useEffect(() => {
    if (network !== 'devnet') return
    chrome.storage.local.get(FAUCET_KEY).then((stored: any) => {
      const last = stored[FAUCET_KEY]
      if (last) {
        const remaining = FAUCET_COOLDOWN_MS - (Date.now() - last)
        if (remaining > 0) setFaucetCooldownHrs(Math.ceil(remaining / (60 * 60 * 1000)))
      }
    })
  }, [network])

  async function handleFaucet() {
    if (!address || faucetCooldownHrs > 0) return
    setIsClaiming(true)
    try {
      const res = await fetch('https://faucet.solana.com/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, amount: 1 }),
      })
      if (res.ok) {
        await chrome.storage.local.set({ [FAUCET_KEY]: Date.now() })
        setFaucetCooldownHrs(24)
        toast('1 devnet SOL requested! May take a few seconds.', 'success')
      } else {
        toast('Faucet request failed — try faucet.solana.com directly', 'error')
      }
    } catch {
      toast('Could not reach faucet — try faucet.solana.com directly', 'error')
    } finally {
      setIsClaiming(false)
    }
  }

  const myStealthAddresses = stealthAddresses.filter(s => s.walletId === activeId)

  // Map: publicKey → token balances array (null = loading)
  const [stealthBalances, setStealthBalances] = useState<Record<string, TokenBal[] | null>>({})

  useEffect(() => {
    if (tab !== 'stealth' || myStealthAddresses.length === 0) return
    let cancelled = false
    // Initialise with null (loading) for any not yet fetched
    setStealthBalances(prev => {
      const next = { ...prev }
      for (const s of myStealthAddresses) {
        if (!(s.publicKey in next)) next[s.publicKey] = null
      }
      return next
    })
    for (const s of myStealthAddresses) {
      fetchStealthBalances(s.publicKey, network).then(bals => {
        if (cancelled) return
        setStealthBalances(prev => ({ ...prev, [s.publicKey]: bals }))
      }).catch(() => {
        if (cancelled) return
        setStealthBalances(prev => ({ ...prev, [s.publicKey]: [] }))
      })
    }
    return () => { cancelled = true }
  }, [tab, myStealthAddresses.length, network])

  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [genPassword, setGenPassword] = useState('')
  const [genLabel, setGenLabel] = useState('')
  const [genError, setGenError] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [newStealthKey, setNewStealthKey] = useState('')

  const [showCollectModal, setShowCollectModal] = useState(false)
  const [collectTarget, setCollectTarget] = useState('')
  const [collectPassword, setCollectPassword] = useState('')
  const [collectError, setCollectError] = useState('')
  const [isCollecting, setIsCollecting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<StealthAddress | null>(null)

  async function handleGenerate() {
    if (!genPassword) return setGenError('Enter your password')
    setIsGenerating(true)
    setGenError('')
    try {
      const label = genLabel.trim() || `Stealth #${myStealthAddresses.length + 1}`
      const pubkey = await generateStealthAddress(genPassword, label)
      setNewStealthKey(pubkey)
    } catch (e: any) {
      setGenError(e.message?.includes('Incorrect') || e.message?.includes('decrypt') ? 'Incorrect password' : (e.message ?? 'Failed'))
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleCollect() {
    if (!collectPassword) return setCollectError('Enter your password')
    setIsCollecting(true)
    setCollectError('')
    try {
      const sig = await collectFromStealth(collectTarget, collectPassword)
      setShowCollectModal(false)
      setStealthBalances(prev => ({ ...prev, [collectTarget]: [] }))
      toast(`Collected! Tx: ${sig.slice(0, 8)}…`, 'success')
    } catch (e: any) {
      setCollectError(e.message?.includes('Incorrect') || e.message?.includes('decrypt') ? 'Incorrect password' : (e.message ?? 'Failed'))
    } finally {
      setIsCollecting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteStealthAddress(deleteTarget.publicKey)
    setDeleteTarget(null)
    toast('Stealth address removed', 'success')
  }

  function openCollect(pubkey: string) {
    setCollectTarget(pubkey)
    setCollectPassword('')
    setCollectError('')
    setShowCollectModal(true)
  }

  function openGenerate() {
    setGenPassword('')
    setGenLabel('')
    setGenError('')
    setNewStealthKey('')
    setShowGenerateModal(true)
  }

  const collectTargetBals = stealthBalances[collectTarget] ?? []
  const hasFunds = (bals: TokenBal[] | null) => bals !== null && bals.length > 0
  const deleteHasBalance = deleteTarget ? hasFunds(stealthBalances[deleteTarget.publicKey] ?? null) : false

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      <Header />

      <div className="px-4 pt-2 pb-1">
        <div className="flex gap-1 p-1 rounded-2xl bg-[var(--color-card)] border border-[var(--color-border)]">
          <button
            onClick={() => setTab('main')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-colors ${tab === 'main' ? 'bg-primary text-black' : 'opacity-40'}`}
          >
            Main
          </button>
          <button
            onClick={() => setTab('stealth')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${tab === 'stealth' ? 'bg-primary text-black' : 'opacity-40'}`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Stealth
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-16">
        {tab === 'main' ? (
          <FadeIn className="flex flex-col items-center gap-5 px-6 py-4">
            <div>
              <h2 className="text-xl font-bold text-center mb-1">Receive</h2>
              <p className="text-xs opacity-40 text-center">Share your address to receive SOL or tokens</p>
            </div>
            <motion.div whileHover={{ scale: 1.02 }} className="p-4 rounded-3xl card-bg">
              <QRCodeSVG value={address} size={180} bgColor="transparent"
                fgColor={theme === 'light' ? '#000000' : '#ABFF7A'} level="M" />
            </motion.div>
            <div className="w-full card-bg rounded-2xl p-4">
              <p className="text-[10px] opacity-40 mb-1.5">Your Solana Address</p>
              <p className="text-xs font-mono break-all leading-relaxed opacity-80">{address}</p>
              <div className="mt-3 flex justify-end"><CopyButton text={address} /></div>
            </div>

            {network === 'devnet' && (
              <button
                onClick={handleFaucet}
                disabled={isClaiming || faucetCooldownHrs > 0}
                className="w-full py-2.5 rounded-2xl border border-primary/30 text-primary text-xs font-semibold flex items-center justify-center gap-2 hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isClaiming ? (
                  <div className="w-3.5 h-3.5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v6M12 18v4M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M18 12h4M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24"/>
                  </svg>
                )}
                {faucetCooldownHrs > 0
                  ? `Available in ${faucetCooldownHrs}h`
                  : 'Get 1 devnet SOL from faucet'}
              </button>
            )}
          </FadeIn>
        ) : (
          <div className="flex flex-col gap-3 px-4 py-4">
            <div>
              <h2 className="text-base font-bold mb-0.5">Stealth Addresses</h2>
              <p className="text-xs opacity-40">HD-derived addresses unlinkable to your main wallet on-chain.</p>
            </div>

            {myStealthAddresses.length === 0 ? (
              <div className="card-bg rounded-3xl px-4 py-8 flex flex-col items-center gap-2 text-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <p className="text-sm opacity-40">No stealth addresses yet</p>
                <p className="text-xs opacity-30">Generate one below to receive privately</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {myStealthAddresses.map(s => {
                  const bals = stealthBalances[s.publicKey]
                  const hasAny = hasFunds(bals)
                  return (
                    <div key={s.publicKey} className="card-bg rounded-3xl overflow-hidden">
                      {/* Header row */}
                      <div className="flex items-center justify-between px-4 pt-3 pb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{s.label}</p>
                          <p className="text-[10px] font-mono opacity-40">{truncate(s.publicKey)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <CopyButton text={s.publicKey} />
                          <motion.button
                            whileTap={{ scale: 0.93 }}
                            onClick={() => setDeleteTarget(s)}
                            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-red-500/10 opacity-30 hover:opacity-80 hover:text-red-400 transition-all"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6l-1 14H6L5 6"/>
                              <path d="M10 11v6M14 11v6"/>
                              <path d="M9 6V4h6v2"/>
                            </svg>
                          </motion.button>
                        </div>
                      </div>

                      {/* Balances */}
                      <div className="px-4 pb-3">
                        {bals === null ? (
                          <div className="flex items-center gap-1.5 py-1">
                            <Spinner size="sm" />
                            <span className="text-[10px] opacity-30">Loading balances…</span>
                          </div>
                        ) : bals.length === 0 ? (
                          <p className="text-[10px] opacity-30 py-1">Empty — no tokens yet</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {bals.map(b => (
                              <div key={b.symbol} className="flex items-center gap-1 bg-[var(--color-bg)] rounded-xl px-2 py-1 border border-[var(--color-border)]">
                                <img src={b.logoUri} alt={b.symbol}
                                  className="w-3.5 h-3.5 rounded-full shrink-0"
                                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                                />
                                <span className="text-[10px] font-medium text-[#ABFF7A]">{fmtAmount(b.amount)}</span>
                                <span className="text-[9px] opacity-50">{b.symbol}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {hasAny && (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => openCollect(s.publicKey)}
                            className="w-full py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                          >
                            Collect to Main Wallet
                          </motion.button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={openGenerate}
              className="w-full py-3 rounded-2xl bg-primary text-black text-sm font-semibold flex items-center justify-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Generate New Stealth Address
            </motion.button>
          </div>
        )}
      </div>

      <BottomNav />

      {/* Generate Modal */}
      <AnimatePresence>
        {showGenerateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-end z-50"
            onClick={() => !isGenerating && !newStealthKey && setShowGenerateModal(false)}
          >
            <motion.div initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
              className="w-full bg-[var(--color-card)] rounded-t-3xl p-5 flex flex-col gap-3"
              onClick={e => e.stopPropagation()}
            >
              {newStealthKey ? (
                <>
                  <p className="text-sm font-semibold text-center">Stealth Address Generated</p>
                  <div className="flex justify-center">
                    <div className="p-3 rounded-2xl card-bg">
                      <QRCodeSVG value={newStealthKey} size={140} bgColor="transparent"
                        fgColor={theme === 'light' ? '#000000' : '#ABFF7A'} level="M" />
                    </div>
                  </div>
                  <div className="card-bg rounded-2xl p-3">
                    <p className="text-[10px] opacity-40 mb-1">Address</p>
                    <p className="text-[10px] font-mono break-all opacity-80">{newStealthKey}</p>
                    <div className="mt-2 flex justify-end"><CopyButton text={newStealthKey} /></div>
                  </div>
                  <button onClick={() => setShowGenerateModal(false)}
                    className="w-full py-3 rounded-2xl bg-primary text-black text-sm font-semibold">
                    Done
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-center">Generate Stealth Address</p>
                  <div className="flex flex-col gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs opacity-50">Label (optional)</span>
                      <input
                        className="rounded-xl px-3 py-2.5 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] outline-none focus:border-primary/60"
                        placeholder={`Stealth #${myStealthAddresses.length + 1}`}
                        value={genLabel}
                        onChange={e => setGenLabel(e.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs opacity-50">Password</span>
                      <input type="password"
                        className="rounded-xl px-3 py-2.5 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] outline-none focus:border-primary/60"
                        placeholder="Enter your wallet password"
                        value={genPassword}
                        onChange={e => { setGenPassword(e.target.value); setGenError('') }}
                      />
                    </label>
                    {genError && <p className="text-xs text-red-400">{genError}</p>}
                  </div>
                  <button onClick={handleGenerate} disabled={isGenerating}
                    className="w-full py-3 rounded-2xl bg-primary text-black text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
                    {isGenerating ? <><Spinner size="sm" /> Generating…</> : 'Generate'}
                  </button>
                  <button onClick={() => setShowGenerateModal(false)} className="w-full py-2 text-sm opacity-40">Cancel</button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collect Modal */}
      <AnimatePresence>
        {showCollectModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-end z-50"
            onClick={() => !isCollecting && setShowCollectModal(false)}
          >
            <motion.div initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
              className="w-full bg-[var(--color-card)] rounded-t-3xl p-5 flex flex-col gap-3"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-center">Collect to Main Wallet</p>
              <p className="text-xs opacity-40 text-center">Sweeps all SOL from this stealth address back to your main wallet.</p>
              <div className="card-bg rounded-2xl px-3 py-2.5 flex flex-col gap-1.5">
                <p className="text-[10px] opacity-40">From {truncate(collectTarget)}</p>
                {collectTargetBals.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {collectTargetBals.map(b => (
                      <div key={b.symbol} className="flex items-center gap-1 bg-[var(--color-border)]/30 rounded-lg px-1.5 py-0.5">
                        <img src={b.logoUri} alt={b.symbol} className="w-3 h-3 rounded-full"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        <span className="text-[10px] font-medium">{fmtAmount(b.amount)} {b.symbol}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-xs opacity-50">Password</span>
                <input type="password"
                  className="rounded-xl px-3 py-2.5 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] outline-none focus:border-primary/60"
                  placeholder="Enter your wallet password"
                  value={collectPassword}
                  onChange={e => { setCollectPassword(e.target.value); setCollectError('') }}
                />
              </label>
              {collectError && <p className="text-xs text-red-400">{collectError}</p>}
              <button onClick={handleCollect} disabled={isCollecting}
                className="w-full py-3 rounded-2xl bg-primary text-black text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
                {isCollecting ? <><Spinner size="sm" /> Collecting…</> : 'Collect SOL'}
              </button>
              <button onClick={() => setShowCollectModal(false)} className="w-full py-2 text-sm opacity-40">Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-end z-50"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
              className="w-full bg-[var(--color-card)] rounded-t-3xl p-5 flex flex-col gap-3"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-center">Remove Stealth Address?</p>
              {deleteHasBalance && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-3 flex items-start gap-2">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400 shrink-0 mt-0.5">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <div>
                    <p className="text-xs text-yellow-400 font-medium">This address has funds!</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(stealthBalances[deleteTarget.publicKey] ?? []).map(b => (
                        <span key={b.symbol} className="text-[10px] text-yellow-300/80">{fmtAmount(b.amount)} {b.symbol}</span>
                      ))}
                    </div>
                    <p className="text-[10px] text-yellow-400/70 mt-1">Collect first or funds will be inaccessible.</p>
                  </div>
                </div>
              )}
              <p className="text-xs opacity-40 text-center">
                <span className="font-medium opacity-60">{deleteTarget.label}</span> will be removed from this list. It can always be regenerated from your seed.
              </p>
              <button onClick={handleDelete}
                className="w-full py-3 rounded-2xl bg-red-500 text-white text-sm font-semibold">
                {deleteHasBalance ? 'Remove Anyway' : 'Remove'}
              </button>
              <button onClick={() => setDeleteTarget(null)} className="w-full py-2 text-sm opacity-40">Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
