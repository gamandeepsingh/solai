// @solana/web3.js uses window.WebSocket in its browser bundle — polyfill for service worker
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).window = globalThis

import nacl from 'tweetnacl'
import { sendSol, sendUsdc, sendUsdt } from '../lib/solana'
import { getSwapQuote, executeSwap } from '../lib/jupiter'
import { logTx } from '../lib/history'
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
    const local = await chrome.storage.local.get(['wallets', 'activeWalletId', 'keystore']) as any
    const wallets = local.wallets as Array<{ id: string; keystore: { publicKey: string } }> | undefined
    const activeId = local.activeWalletId as string | undefined
    const activeWallet = wallets?.find(w => w.id === activeId) ?? wallets?.[0]
    const publicKey = activeWallet?.keystore.publicKey ?? local.keystore?.publicKey
    if (!publicKey) return

    const sync = await chrome.storage.sync.get('network') as any
    const network: Network = sync?.network ?? 'mainnet'
    const endpoints: Record<string, string> = {
      mainnet: 'https://api.mainnet-beta.solana.com',
      devnet: 'https://api.devnet.solana.com',
    }

    try {
      const res = await fetch(endpoints[network] ?? endpoints.mainnet, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [publicKey] }),
      })
      const { result } = await res.json()
      await chrome.storage.local.set({ cachedSolBalance: result.value / 1_000_000_000 })
    } catch {}
  }

  if (alarm.name === 'scheduler-tick') {
    const { scheduledJobs = [] } = await chrome.storage.local.get('scheduledJobs') as any
    const now = Date.now()
    const due: ScheduledJob[] = scheduledJobs.filter((j: ScheduledJob) => j.nextRun <= now)
    if (!due.length) return

    const keypair = await getSessionKeypair()
    const sync = await chrome.storage.sync.get('network') as any
    const network: Network = sync?.network ?? 'mainnet'

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
    await chrome.storage.local.set({ scheduledJobs: updated })
  }

  if (alarm.name === 'price-check') {
    const { conditionalOrders = [] } = await chrome.storage.local.get('conditionalOrders') as any
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

      await chrome.storage.local.set({ conditionalOrders: updatedOrders })
    } catch {}
  }
})
