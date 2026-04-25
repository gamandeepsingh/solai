// @solana/web3.js uses window.WebSocket in its browser bundle — polyfill for service worker
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).window = globalThis

import nacl from 'tweetnacl'
import { PublicKey } from '@solana/web3.js'
import { sendSol, sendUsdc, sendUsdt, sendSplToken, getSolBalance, getAllSplTokenBalances } from '../lib/solana'
import { getSwapQuote, executeSwap } from '../lib/jupiter'
import { logTx } from '../lib/history'
import { getLocal, setLocal } from '../lib/storage'
import { CURATED_TOKENS, getMintForNetwork } from '../lib/tokens'
import { getAllowances, saveAllowance, consumeAllowance } from '../lib/allowances'
import type { ScheduledJob, AgentWallet, TokenAllowance } from '../types/agent'
import type { ConditionalOrder } from '../types/orders'
import type { Network } from '../types/wallet'

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('balance-refresh', { periodInMinutes: 1 })
  chrome.alarms.create('scheduler-tick', { periodInMinutes: 1 })
  chrome.alarms.create('price-check', { periodInMinutes: 5 })
  chrome.alarms.create('agent-refill', { periodInMinutes: 30 })
  chrome.alarms.create('inactivity-check', { periodInMinutes: 360 }) // every 6 hours
})

chrome.notifications.onClicked.addListener(() => {
  chrome.action.openPopup?.().catch(() => {})
})

async function getAgentKeypair(agentId: string): Promise<nacl.SignKeyPair | null> {
  const session = await chrome.storage.session.get('agentSession') as any
  const as = session?.agentSession
  if (!as || as.expiresAt <= Date.now()) return null
  const sk = as.keypairs?.[agentId]
  if (!sk) return null
  return nacl.sign.keyPair.fromSecretKey(new Uint8Array(sk))
}

async function getSessionKeypair(): Promise<nacl.SignKeyPair | null> {
  const session = await chrome.storage.session.get('walletSession') as any
  const ws = session?.walletSession
  if (!ws || ws.expiresAt <= Date.now()) return null
  // New multi-wallet format: { keypairs: Record<id, number[]>, expiresAt }
  if (ws.keypairs) {
    const activeWalletId = await getLocal('activeWalletId')
    const sk = ws.keypairs[activeWalletId!]
    if (!sk) return null
    return nacl.sign.keyPair.fromSecretKey(new Uint8Array(sk))
  }
  // Legacy fallback: { secretKey: number[], expiresAt }
  if (ws.secretKey) return nacl.sign.keyPair.fromSecretKey(new Uint8Array(ws.secretKey))
  return null
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'balance-refresh') {
    const notifSetting = (await chrome.storage.sync.get('notificationsEnabled') as any)?.notificationsEnabled
    const notifEnabled = notifSetting !== false

    const [wallets, activeId, legacyKeystore] = await Promise.all([
      getLocal('wallets'),
      getLocal('activeWalletId'),
      getLocal('keystore'),
    ])
    const activeWallet = wallets?.find(w => w.id === activeId) ?? wallets?.[0]
    const publicKey = activeWallet?.keystore.publicKey ?? legacyKeystore?.publicKey
    if (!publicKey) return

    const network: Network = (await chrome.storage.sync.get('network') as any)?.network ?? 'mainnet'
    const endpoint = network === 'devnet'
      ? 'https://api.devnet.solana.com'
      : 'https://api.mainnet-beta.solana.com'

    // Read previous cached balances BEFORE fetching new ones
    const [prevSolBalance, prevSplBalances] = await Promise.all([
      getLocal('cachedSolBalance'),
      getLocal('cachedSplBalances'),
    ])
    const isFirstSplCheck = prevSplBalances === undefined

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [publicKey] }),
      })
      const { result } = await res.json()
      const newSolBalance = result.value / 1_000_000_000

      // Notify if SOL balance increased (skip on very first cache population)
      if (notifEnabled && prevSolBalance !== undefined && newSolBalance > prevSolBalance + 0.000001) {
        const received = (newSolBalance - prevSolBalance).toFixed(6)
        chrome.notifications.create(`recv-sol-${Date.now()}`, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: 'SOL Received',
          message: `+${received} SOL received in your wallet`,
        })
      }
      await setLocal('cachedSolBalance', newSolBalance)
    } catch {}

    // Check SPL token balances for incoming tokens
    try {
      const splRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 2,
          method: 'getParsedTokenAccountsByOwner',
          params: [publicKey, { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, { encoding: 'jsonParsed' }],
        }),
      })
      const { result: splResult } = await splRes.json()

      // Build mint → symbol reverse map for the current network
      const mintToSymbol: Record<string, string> = {}
      for (const t of CURATED_TOKENS) {
        if (t.symbol === 'SOL') continue
        const mint = getMintForNetwork(t, network)
        mintToSymbol[mint] = t.symbol
      }

      const cachedSpl = prevSplBalances ?? {}
      const newSplBalances: Record<string, number> = {}

      for (const acc of splResult?.value ?? []) {
        const info = acc.account.data.parsed.info
        const mint: string = info.mint
        const amount = Number(info.tokenAmount.uiAmount ?? 0)
        if (amount > 0) newSplBalances[mint] = amount

        if (notifEnabled && !isFirstSplCheck) {
          const prev = cachedSpl[mint] ?? 0
          if (amount > prev + 0.000001) {
            const symbol = mintToSymbol[mint] ?? 'Token'
            const diff = amount - prev
            const formatted = diff < 0.001 ? diff.toExponential(2) : diff.toFixed(diff >= 1000 ? 0 : 4)
            chrome.notifications.create(`recv-spl-${mint.slice(0, 8)}-${Date.now()}`, {
              type: 'basic',
              iconUrl: chrome.runtime.getURL('icons/icon128.png'),
              title: `${symbol} Received`,
              message: `+${formatted} ${symbol} received in your wallet`,
            })
          }
        }
      }

      await setLocal('cachedSplBalances', newSplBalances)
    } catch {}
  }

  if (alarm.name === 'scheduler-tick') {
    const scheduledJobs: ScheduledJob[] = (await getLocal('scheduledJobs')) ?? []
    const now = Date.now()
    const due: ScheduledJob[] = scheduledJobs.filter((j: ScheduledJob) => j.nextRun <= now)
    if (!due.length) return

    const mainKeypair = await getSessionKeypair()
    const network: Network = (await chrome.storage.sync.get('network') as any)?.network ?? 'mainnet'

    for (const job of due) {
      const keypair = job.agentId
        ? (await getAgentKeypair(job.agentId)) ?? mainKeypair
        : mainKeypair
      if (keypair) {
        try {
          let sig: string
          if (job.action.token === 'SOL') {
            sig = await sendSol(keypair, job.action.recipient, job.action.amount, network)
          } else if (job.action.token === 'USDT') {
            sig = await sendUsdt(keypair, job.action.recipient, job.action.amount, network)
          } else {
            sig = await sendUsdc(keypair, job.action.recipient, job.action.amount, network)
          }
          await logTx({ sig, type: 'send', timestamp: Date.now(), amount: job.action.amount, token: job.action.token, status: 'success', agentId: job.agentId })
          chrome.notifications.create(`scheduled-done-${job.id}-${now}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon128.png'),
            title: 'Scheduled Payment Sent',
            message: `${job.action.amount} ${job.action.token} sent successfully`,
          })
        } catch (e: any) {
          chrome.notifications.create(`scheduled-err-${job.id}-${now}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon128.png'),
            title: 'Scheduled Payment Failed',
            message: `Could not send to ${job.action.recipientLabel}: ${e?.message ?? 'unknown error'}`,
          })
        }
      } else {
        chrome.notifications.create(`scheduled-${job.id}`, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: 'Scheduled Payment Due',
          message: `Open SOLAI to send ${job.action.amount} ${job.action.token} to ${job.action.recipientLabel}`,
        })
      }
    }

    const updated = scheduledJobs.map((j: ScheduledJob) =>
      due.find((d) => d.id === j.id) ? { ...j, nextRun: j.nextRun + j.intervalMs } : j
    )
    await setLocal('scheduledJobs', updated)
  }

  if (alarm.name === 'price-check') {
    const conditionalOrders: ConditionalOrder[] = (await getLocal('conditionalOrders')) ?? []
    const pending: ConditionalOrder[] = conditionalOrders.filter((o: ConditionalOrder) => o.status === 'pending')
    if (!pending.length) return

    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana,usd-coin,tether&vs_currencies=usd')
      const data = await res.json()
      const prices: Record<string, number> = {
        SOL: data.solana?.usd ?? 0,
        USDC: data['usd-coin']?.usd ?? 1,
        USDT: data.tether?.usd ?? 1,
      }

      const mainKeypair = await getSessionKeypair()
      const updatedOrders = [...conditionalOrders]

      for (const order of pending) {
        const price = prices[order.buyToken] ?? 0
        if (!price) continue

        const triggered = order.direction === 'below'
          ? price <= order.triggerPrice
          : price >= order.triggerPrice

        if (!triggered) continue

        const idx = updatedOrders.findIndex((o: ConditionalOrder) => o.id === order.id)
        const keypair = order.agentId
          ? (await getAgentKeypair(order.agentId)) ?? mainKeypair
          : mainKeypair

        if (!keypair) {
          chrome.notifications.create(`order-locked-${order.id}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon128.png'),
            title: 'Order Triggered — Wallet Locked',
            message: `Buy ${order.buyToken} order triggered at $${price.toFixed(2)}. Open SOLAI to execute.`,
          })
          continue
        }

        try {
          const quote = await getSwapQuote(order.spendToken, order.buyToken, order.spendAmount, 50)
          const sig = await executeSwap(quote, keypair)
          await logTx({ sig, type: 'swap', timestamp: Date.now(), amount: order.spendAmount, token: `${order.spendToken}→${order.buyToken}`, status: 'success' })
          if (idx !== -1) updatedOrders[idx] = { ...order, status: 'executed', executedAt: new Date().toISOString(), txSignature: sig }
          chrome.notifications.create(`order-done-${order.id}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon128.png'),
            title: 'Order Executed',
            message: `Bought ${order.buyToken} with ${order.spendAmount} ${order.spendToken} at $${price.toFixed(2)}`,
          })
        } catch (e: any) {
          if (idx !== -1) updatedOrders[idx] = { ...order, status: 'failed', errorMessage: e?.message ?? 'Unknown error' }
          chrome.notifications.create(`order-failed-${order.id}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon128.png'),
            title: 'Order Failed',
            message: `Could not buy ${order.buyToken}: ${(e?.message ?? 'Unknown error').slice(0, 80)}`,
          })
        }
      }

      await setLocal('conditionalOrders', updatedOrders)
    } catch {}
  }

  if (alarm.name === 'agent-refill') {
    const agentWalletList: AgentWallet[] = (await getLocal('agentWallets')) ?? []
    const refillable = agentWalletList.filter(a => a.autoRefill?.enabled && a.enabled)
    if (!refillable.length) return
    const mainKeypair = await getSessionKeypair()
    if (!mainKeypair) return
    const network: Network = (await chrome.storage.sync.get('network') as any)?.network ?? 'mainnet'
    for (const agent of refillable) {
      const { thresholdSol, refillAmountSol } = agent.autoRefill!
      try {
        const bal = await getSolBalance(agent.publicKey, network)
        if (bal < thresholdSol) {
          const sig = await sendSol(mainKeypair, agent.publicKey, refillAmountSol, network)
          await logTx({ sig, type: 'send', timestamp: Date.now(), amount: refillAmountSol, token: 'SOL', toOrFrom: agent.publicKey, status: 'success', network })
          chrome.notifications.create(`refill-${agent.id}-${Date.now()}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon128.png'),
            title: 'Agent Wallet Refilled',
            message: `${agent.name} auto-refilled with ${refillAmountSol} SOL (balance was ${bal.toFixed(4)} SOL)`,
          })
        }
      } catch {}
    }
  }

  if (alarm.name === 'inactivity-check') {
    const guard = await getLocal('inactivityGuard')
    if (!guard?.enabled || !guard.recipientAddress) return

    const now = Date.now()
    const daysSince = (now - (guard.lastActivityAt || now)) / 86_400_000
    const warningThreshold = guard.inactivityDays - 7

    if (daysSince < warningThreshold) return

    const daysLeft = Math.max(0, Math.ceil(guard.inactivityDays - daysSince))
    const hoursSinceWarn = (now - (guard.lastWarnedAt ?? 0)) / 3_600_000

    // Still in warning window — notify once per 24h
    if (daysLeft > 0) {
      if (hoursSinceWarn >= 24) {
        chrome.notifications.create(`inactivity-warn-${now}`, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: 'Wallet Inactivity Warning',
          message: `Auto-sweep in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Open SOLAI to reset the timer.`,
        })
        await setLocal('inactivityGuard', { ...guard, lastWarnedAt: now })
      }
      return
    }

    // Past deadline
    const keypair = await getSessionKeypair()
    if (!keypair) {
      // Session expired — mark pending, notify
      if (hoursSinceWarn >= 24) {
        chrome.notifications.create(`inactivity-pending-${now}`, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: 'Auto-Sweep Pending',
          message: 'Inactivity period exceeded. Unlock SOLAI to complete the sweep or cancel.',
        })
        await setLocal('inactivityGuard', { ...guard, pendingSweep: true, lastWarnedAt: now })
      }
      return
    }

    // Execute sweep
    try {
      const network: Network = (await chrome.storage.sync.get('network') as any)?.network ?? 'mainnet'
      const pubkey = new PublicKey(keypair.publicKey).toBase58()
      const SOL_FEE_RESERVE = 0.01

      const solBalance = await getSolBalance(pubkey, network)
      if (solBalance > SOL_FEE_RESERVE + 0.001) {
        const sig = await sendSol(keypair, guard.recipientAddress, solBalance - SOL_FEE_RESERVE, network)
        await logTx({ sig, type: 'send', timestamp: now, amount: solBalance - SOL_FEE_RESERVE, token: 'SOL', toOrFrom: guard.recipientAddress, status: 'success', network })
      }

      const splTokens = await getAllSplTokenBalances(pubkey, network)
      for (const token of splTokens) {
        if (token.amount > 0) {
          try {
            const sig = await sendSplToken(keypair, guard.recipientAddress, token.amount, token.mint, network, token.decimals)
            await logTx({ sig, type: 'send', timestamp: Date.now(), amount: token.amount, token: token.mint.slice(0, 6), toOrFrom: guard.recipientAddress, status: 'success', network })
          } catch {}
        }
      }

      await setLocal('inactivityGuard', { ...guard, enabled: false, pendingSweep: false, lastActivityAt: now })
      chrome.notifications.create(`inactivity-swept-${now}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Wallet Swept',
        message: `All tokens sent to ${guard.recipientAddress.slice(0, 8)}… due to inactivity.`,
      })
    } catch {}
  }
})

const pendingConnectRequests: Map<string, { resolve: (r: any) => void; origin: string }> = new Map()

async function openSignApprovalPopup(requestId: string) {
  const W = 360, H = 600
  let left: number | undefined, top: number | undefined
  try {
    const focused = await chrome.windows.getLastFocused({ populate: false })
    left = Math.round((focused.left ?? 0) + ((focused.width ?? 1280) - W) / 2)
    top  = Math.round((focused.top  ?? 0) + ((focused.height ?? 800) - H) / 2)
  } catch {}
  chrome.windows.create({
    url: `src/popup/index.html?page=sign-approval&requestId=${requestId}`,
    type: 'popup',
    width: W,
    height: H,
    ...(left !== undefined && { left, top }),
  })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false

  if (message?.type === 'PING') {
    sendResponse({ type: 'PONG' })
    return false
  }

  if (message?.type === 'SOLAI_CONNECT') {
    const { requestId, params } = message

    ;(async () => {
      // If this origin was previously approved and not expired, return the public key silently
      const ORIGIN_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000 // 90 days
      const approvedOrigins = (await getLocal('approvedOrigins')) ?? []
      const approvedEntry = approvedOrigins.find(a =>
        a.origin === params.origin &&
        Date.now() - new Date(a.connectedAt).getTime() < ORIGIN_EXPIRY_MS
      )
      if (approvedEntry) {
        // Update lastUsedAt
        const updated = approvedOrigins.map(a =>
          a.origin === params.origin ? { ...a, lastUsedAt: new Date().toISOString() } : a
        )
        await setLocal('approvedOrigins', updated as any)
        const [wallets, activeId, legacyKs] = await Promise.all([
          getLocal('wallets'), getLocal('activeWalletId'), getLocal('keystore'),
        ])
        const wallet = wallets?.find(w => w.id === activeId) ?? wallets?.[0]
        const pk = wallet?.keystore?.publicKey ?? wallet?.publicKey ?? legacyKs?.publicKey
        if (pk) { sendResponse({ publicKey: pk }); return }
      }

      // First-time connection — open centered approval popup
      pendingConnectRequests.set(requestId, { resolve: sendResponse, origin: params.origin })
      const W = 360, H = 600
      let left: number | undefined, top: number | undefined
      try {
        const focused = await chrome.windows.getLastFocused({ populate: false })
        left = Math.round((focused.left ?? 0) + ((focused.width ?? 1280) - W) / 2)
        top  = Math.round((focused.top  ?? 0) + ((focused.height ?? 800) - H) / 2)
      } catch {}
      chrome.windows.create({
        url: `src/popup/index.html?page=dapp-approval&requestId=${requestId}&origin=${encodeURIComponent(params.origin)}`,
        type: 'popup',
        width: W,
        height: H,
        ...(left !== undefined && { left, top }),
      })
    })()

    return true
  }

  if (message?.type === 'SOLAI_CONNECT_RESPONSE') {
    const { requestId, approved, publicKey } = message
    const pending = pendingConnectRequests.get(requestId)
    if (pending) {
      pendingConnectRequests.delete(requestId)
      if (approved) {
        pending.resolve({ publicKey })
        ;(async () => {
          const origins = (await getLocal('approvedOrigins')) ?? []
          if (!origins.some(a => a.origin === pending.origin)) {
            origins.push({ origin: pending.origin, connectedAt: new Date().toISOString() })
            await setLocal('approvedOrigins', origins)
          }
        })()
      } else {
        pending.resolve(null)
      }
    }
    return false
  }

  if (
    message?.type === 'SOLAI_SIGNMESSAGE' ||
    message?.type === 'SOLAI_SIGNTRANSACTION' ||
    message?.type === 'SOLAI_SIGNANDSENDTRANSACTION'
  ) {
    const typeMap: Record<string, string> = {
      SOLAI_SIGNMESSAGE: 'signMessage',
      SOLAI_SIGNTRANSACTION: 'signTransaction',
      SOLAI_SIGNANDSENDTRANSACTION: 'signAndSendTransaction',
    }
    const requestId: string = message.requestId ?? crypto.randomUUID()
    const tabId: number | undefined = sender.tab?.id

    ;(async () => {
      // Always show the sign approval popup — never auto-sign.
      // The popup handles unlock (if locked) and user confirmation before signing.
      await chrome.storage.session.set({
        [`pendingSign_${requestId}`]: { type: typeMap[message.type], params: message.params, tabId },
      })
      await openSignApprovalPopup(requestId)
      sendResponse({ queued: true, requestId })
    })()
    return true
  }

  if (message?.type === 'SOLAI_DISCONNECT') {
    sendResponse({})
    return false
  }

  if (message?.type === 'SOLAI_AGENT_PAY') {
    ;(async () => {
      const { agentId, recipient, amountSol, origin } = message.params ?? {}
      const agentWalletList: AgentWallet[] = (await getLocal('agentWallets')) ?? []
      const idx = agentWalletList.findIndex(a => a.id === agentId)
      if (idx === -1) { sendResponse({ error: 'Agent not found' }); return }
      const agent = { ...agentWalletList[idx], stats: { ...agentWalletList[idx].stats } }
      if (!agent.enabled) { sendResponse({ error: 'Agent is disabled (kill-switch active)' }); return }

      const now = Date.now()
      const todayMidnight = new Date().setHours(0, 0, 0, 0)
      if (agent.stats.dailyResetAt < todayMidnight) {
        agent.stats.dailySpentSol = 0
        agent.stats.dailyResetAt = todayMidnight
      }
      const g = agent.guardrails
      if (g.perTxLimitSol > 0 && amountSol > g.perTxLimitSol) {
        sendResponse({ error: `Per-tx limit: ${g.perTxLimitSol} SOL` }); return
      }
      if (g.dailyBudgetSol > 0 && agent.stats.dailySpentSol + amountSol > g.dailyBudgetSol) {
        sendResponse({ error: `Daily budget exceeded (${agent.stats.dailySpentSol.toFixed(4)}/${g.dailyBudgetSol} SOL used)` }); return
      }
      if (g.allowedOrigins.length > 0 && !g.allowedOrigins.some((o: string) => {
        try { return new URL(origin).hostname === new URL(o).hostname } catch { return false }
      })) {
        sendResponse({ error: 'Origin not in allowlist' }); return
      }
      if (g.cooldownMs > 0 && agent.stats.lastPaymentAt > 0 && now - agent.stats.lastPaymentAt < g.cooldownMs) {
        const rem = Math.ceil((g.cooldownMs - (now - agent.stats.lastPaymentAt)) / 1000)
        sendResponse({ error: `Cooldown active: ${rem}s remaining` }); return
      }

      const keypair = await getAgentKeypair(agentId)
      if (!keypair) { sendResponse({ error: 'Session expired — unlock wallet to re-authorize agents' }); return }

      const network: Network = (await chrome.storage.sync.get('network') as any)?.network ?? 'mainnet'
      try {
        const sig = await sendSol(keypair, recipient, amountSol, network)
        agent.stats.dailySpentSol += amountSol
        agent.stats.totalSpentSol += amountSol
        agent.stats.lastPaymentAt = now
        agent.stats.txCount++
        const updatedList = [...agentWalletList]
        updatedList[idx] = agent
        await setLocal('agentWallets', updatedList)
        await logTx({ sig, type: 'send', timestamp: now, amount: amountSol, token: 'SOL', status: 'success', network, agentId })
        sendResponse({ signature: sig })
      } catch (e: any) {
        sendResponse({ error: e?.message ?? 'Payment failed' })
      }
    })()
    return true
  }

  if (message?.type === 'SOLAI_AGENT_PAY_TOKEN') {
    ;(async () => {
      const { agentId, recipient, token, amount, origin } = message.params ?? {}
      const agentWalletList: AgentWallet[] = (await getLocal('agentWallets')) ?? []
      const idx = agentWalletList.findIndex(a => a.id === agentId)
      if (idx === -1) { sendResponse({ error: 'Agent not found' }); return }
      const agent = { ...agentWalletList[idx], stats: { ...agentWalletList[idx].stats } }
      if (!agent.enabled) { sendResponse({ error: 'Agent is disabled' }); return }

      const g = agent.guardrails
      const allowedTokens: string[] = g.allowedTokens ?? []
      if (allowedTokens.length > 0 && !allowedTokens.includes(token)) {
        sendResponse({ error: `Token ${token} not in allowed list` }); return
      }
      if (g.allowedOrigins.length > 0 && !g.allowedOrigins.some((o: string) => {
        try { return new URL(origin).hostname === new URL(o).hostname } catch { return false }
      })) {
        sendResponse({ error: 'Origin not in allowlist' }); return
      }

      const tokenBudgets = g.tokenBudgets ?? {}
      const budget = tokenBudgets[token]
      const now = Date.now()
      const todayMidnight = new Date().setHours(0, 0, 0, 0)

      if (!agent.stats.tokenSpend) agent.stats.tokenSpend = {}
      if (!agent.stats.tokenSpend[token]) agent.stats.tokenSpend[token] = { daily: 0, total: 0, dailyResetAt: 0 }
      const tStat = agent.stats.tokenSpend[token]
      if (tStat.dailyResetAt < todayMidnight) { tStat.daily = 0; tStat.dailyResetAt = todayMidnight }

      if (budget) {
        if (budget.perTx > 0 && amount > budget.perTx) { sendResponse({ error: `Per-tx limit: ${budget.perTx} ${token}` }); return }
        if (budget.daily > 0 && tStat.daily + amount > budget.daily) { sendResponse({ error: `Daily ${token} budget exceeded (${tStat.daily}/${budget.daily} used)` }); return }
      }

      if (g.cooldownMs > 0 && agent.stats.lastPaymentAt > 0 && now - agent.stats.lastPaymentAt < g.cooldownMs) {
        const rem = Math.ceil((g.cooldownMs - (now - agent.stats.lastPaymentAt)) / 1000)
        sendResponse({ error: `Cooldown active: ${rem}s remaining` }); return
      }

      const tokenMeta = CURATED_TOKENS.find(t => t.symbol === token)
      if (!tokenMeta) { sendResponse({ error: `Unknown token: ${token}` }); return }

      const keypair = await getAgentKeypair(agentId)
      if (!keypair) { sendResponse({ error: 'Session expired — unlock wallet to re-authorize agents' }); return }

      const network: Network = (await chrome.storage.sync.get('network') as any)?.network ?? 'mainnet'
      try {
        const mint = getMintForNetwork(tokenMeta, network)
        const sig = await sendSplToken(keypair, recipient, amount, mint, network, tokenMeta.decimals)
        tStat.daily += amount
        tStat.total += amount
        agent.stats.lastPaymentAt = now
        agent.stats.txCount++
        const updatedList = [...agentWalletList]
        updatedList[idx] = agent
        await setLocal('agentWallets', updatedList)
        await logTx({ sig, type: 'send', timestamp: now, amount, token: token as any, status: 'success', network, agentId })
        sendResponse({ signature: sig })
      } catch (e: any) {
        sendResponse({ error: e?.message ?? 'Payment failed' })
      }
    })()
    return true
  }

  if (message?.type === 'SOLAI_AGENT_SWAP_PAY') {
    ;(async () => {
      const { agentId, recipient, fromToken, toToken, toAmount } = message.params ?? {}
      const agentWalletList: AgentWallet[] = (await getLocal('agentWallets')) ?? []
      const agent = agentWalletList.find(a => a.id === agentId)
      if (!agent) { sendResponse({ error: 'Agent not found' }); return }
      if (!agent.enabled) { sendResponse({ error: 'Agent is disabled' }); return }

      const keypair = await getAgentKeypair(agentId)
      if (!keypair) { sendResponse({ error: 'Session expired — unlock wallet to re-authorize agents' }); return }

      const network: Network = (await chrome.storage.sync.get('network') as any)?.network ?? 'mainnet'
      if (network !== 'mainnet') { sendResponse({ error: 'Swaps require mainnet' }); return }

      try {
        const quote = await getSwapQuote(fromToken, toToken, toAmount, 50)
        await executeSwap(quote, keypair)
        const toMeta = CURATED_TOKENS.find(t => t.symbol === toToken)
        let sig: string
        if (toToken === 'SOL') {
          sig = await sendSol(keypair, recipient, toAmount, network)
        } else if (toMeta) {
          const mint = getMintForNetwork(toMeta, network)
          sig = await sendSplToken(keypair, recipient, toAmount, mint, network, toMeta.decimals)
        } else {
          sendResponse({ error: `Unknown target token: ${toToken}` }); return
        }
        await logTx({ sig, type: 'swap', timestamp: Date.now(), amount: toAmount, token: `${fromToken}→${toToken}` as any, status: 'success', network, agentId })
        sendResponse({ signature: sig })
      } catch (e: any) {
        sendResponse({ error: e?.message ?? 'Swap-and-pay failed' })
      }
    })()
    return true
  }

  const pendingAllowanceRequests: Map<string, (r: any) => void> = (globalThis as any).__solaiPendingAllowances ??
    ((globalThis as any).__solaiPendingAllowances = new Map())

  if (message?.type === 'SOLAI_AGENT_REQUEST_ALLOWANCE') {
    ;(async () => {
      const { agentId, token, maxAmount, expireDays, label, origin } = message.params ?? {}
      const existing = (await getAllowances()).find(a =>
        a.agentId === agentId && a.origin === origin && a.token === token && a.expiresAt > Date.now()
      )
      if (existing) {
        const remaining = existing.maxAmount - existing.spentAmount
        sendResponse({ approved: true, allowanceId: existing.id, remaining })
        return
      }
      const requestId = crypto.randomUUID()
      pendingAllowanceRequests.set(requestId, sendResponse)
      await chrome.storage.session.set({
        [`pendingAllowance_${requestId}`]: { agentId, token, maxAmount, expireDays, label, origin },
      })
      const W = 360, H = 600
      let left: number | undefined, top: number | undefined
      try {
        const focused = await chrome.windows.getLastFocused({ populate: false })
        left = Math.round((focused.left ?? 0) + ((focused.width ?? 1280) - W) / 2)
        top  = Math.round((focused.top  ?? 0) + ((focused.height ?? 800) - H) / 2)
      } catch {}
      chrome.windows.create({
        url: `src/popup/index.html?page=allowance-request&requestId=${requestId}`,
        type: 'popup', width: W, height: H,
        ...(left !== undefined && { left, top }),
      })
    })()
    return true
  }

  if (message?.type === 'SOLAI_ALLOWANCE_RESPONSE') {
    ;(async () => {
      const { requestId, approved } = message
      const resolve = pendingAllowanceRequests.get(requestId)
      pendingAllowanceRequests.delete(requestId)
      if (!approved || !resolve) return
      const stored = await chrome.storage.session.get(`pendingAllowance_${requestId}`) as any
      const req = stored[`pendingAllowance_${requestId}`]
      if (!req) return
      await chrome.storage.session.remove(`pendingAllowance_${requestId}`)
      const allowance = await saveAllowance({
        agentId: req.agentId,
        origin: req.origin,
        label: req.label,
        token: req.token,
        maxAmount: req.maxAmount,
        expiresAt: Date.now() + req.expireDays * 86_400_000,
      })
      resolve({ approved: true, allowanceId: allowance.id, remaining: allowance.maxAmount })
    })()
    return false
  }

  return false
})
