// @solana/web3.js uses window.WebSocket in its browser bundle — polyfill for service worker
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).window = globalThis

import nacl from 'tweetnacl'
import { sendSol, sendUsdc, sendUsdt } from '../lib/solana'
import { logTx } from '../lib/history'
import type { ScheduledJob } from '../types/agent'
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
    if (!conditionalOrders.length) return

    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
      const data = await res.json()
      const solPrice: number = data.solana?.usd ?? 0
      if (!solPrice) return

      for (const order of conditionalOrders) {
        const price = order.token === 'SOL' ? solPrice : 1
        const triggered =
          (order.condition === 'below' && price < order.targetPriceUsd) ||
          (order.condition === 'above' && price > order.targetPriceUsd)

        if (triggered) {
          chrome.notifications.create(`conditional-${order.id}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon128.png'),
            title: `Price Alert: ${order.token} ${order.condition} $${order.targetPriceUsd}`,
            message: `Current: $${price.toFixed(2)}. Open SOLAI to execute: ${order.actionLabel}`,
          })
        }
      }
    } catch {}
  }
})
