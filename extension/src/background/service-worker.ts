// @solana/web3.js uses window.WebSocket in its browser bundle — polyfill for service worker
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).window = globalThis

import nacl from 'tweetnacl'
import { sendSol, sendUsdc, sendUsdt } from '../lib/solana'
import { getSwapQuote, executeSwap } from '../lib/jupiter'
import { logTx } from '../lib/history'
import { getLocal, setLocal } from '../lib/storage'
import { CURATED_TOKENS, getMintForNetwork } from '../lib/tokens'
import type { ScheduledJob } from '../types/agent'
import type { ConditionalOrder } from '../types/orders'
import type { Network } from '../types/wallet'

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('balance-refresh', { periodInMinutes: 1 })
  chrome.alarms.create('scheduler-tick', { periodInMinutes: 1 })
  chrome.alarms.create('price-check', { periodInMinutes: 5 })
})

async function getSessionKeypair(): Promise<nacl.SignKeyPair | null> {
  const session = await chrome.storage.session.get('walletSession') as any
  const ws = session?.walletSession
  if (!ws || ws.expiresAt <= Date.now()) return null
  // New multi-wallet format: { keypairs: Record<id, number[]>, expiresAt }
  if (ws.keypairs) {
    const { activeWalletId } = await chrome.storage.local.get('activeWalletId') as any
    const sk = ws.keypairs[activeWalletId]
    if (!sk) return null
    return nacl.sign.keyPair.fromSecretKey(new Uint8Array(sk))
  }
  // Legacy fallback: { secretKey: number[], expiresAt }
  if (ws.secretKey) return nacl.sign.keyPair.fromSecretKey(new Uint8Array(ws.secretKey))
  return null
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'balance-refresh') {
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
      if (prevSolBalance !== undefined && newSolBalance > prevSolBalance + 0.000001) {
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

        if (!isFirstSplCheck) {
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

    const keypair = await getSessionKeypair()
    const network: Network = (await chrome.storage.sync.get('network') as any)?.network ?? 'mainnet'

    for (const job of due) {
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
          await logTx({ sig, type: 'send', timestamp: Date.now(), amount: job.action.amount, token: job.action.token, status: 'success' })
          chrome.notifications.create(`scheduled-done-${job.id}-${now}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon128.png'),
            title: 'Scheduled Payment Sent',
            message: `Sent ${job.action.amount} ${job.action.token} to ${job.action.recipientLabel}`,
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

      const keypair = await getSessionKeypair()
      const updatedOrders = [...conditionalOrders]

      for (const order of pending) {
        const price = prices[order.buyToken] ?? 0
        if (!price) continue

        const triggered = order.direction === 'below'
          ? price <= order.triggerPrice
          : price >= order.triggerPrice

        if (!triggered) continue

        const idx = updatedOrders.findIndex((o: ConditionalOrder) => o.id === order.id)

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
})

const pendingConnectRequests: Map<string, (response: any) => void> = new Map()

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false

  if (message?.type === 'PING') {
    sendResponse({ type: 'PONG' })
    return false
  }

  if (message?.type === 'SOLAI_CONNECT') {
    const { requestId, params } = message
    pendingConnectRequests.set(requestId, sendResponse)
    chrome.windows.create({
      url: `src/popup/index.html?page=dapp-approval&requestId=${requestId}&origin=${encodeURIComponent(params.origin)}`,
      type: 'popup',
      width: 360,
      height: 600,
    })
    return true
  }

  if (message?.type === 'SOLAI_CONNECT_RESPONSE') {
    const { requestId, approved, publicKey } = message
    const resolve = pendingConnectRequests.get(requestId)
    if (resolve) {
      pendingConnectRequests.delete(requestId)
      if (approved) resolve({ publicKey })
      else resolve(null)
    }
    return false
  }

  return false
})
