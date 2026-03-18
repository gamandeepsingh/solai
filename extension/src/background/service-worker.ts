chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('balance-refresh', { periodInMinutes: 1 })
  chrome.alarms.create('scheduler-tick', { periodInMinutes: 1 })
  chrome.alarms.create('price-check', { periodInMinutes: 5 })
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'balance-refresh') {
    const { keystore } = await chrome.storage.local.get('keystore')
    if (!keystore) return

    const network = (await chrome.storage.sync.get('network'))?.network ?? 'mainnet'
    const endpoints: Record<string, string> = {
      mainnet: 'https://api.mainnet-beta.solana.com',
      devnet: 'https://api.devnet.solana.com',
      testnet: 'https://api.testnet.solana.com',
    }

    try {
      const res = await fetch(endpoints[network], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [keystore.publicKey] }),
      })
      const { result } = await res.json()
      await chrome.storage.local.set({ cachedSolBalance: result.value / 1_000_000_000 })
    } catch {}
  }

  if (alarm.name === 'scheduler-tick') {
    const { scheduledJobs = [] } = await chrome.storage.local.get('scheduledJobs')
    const now = Date.now()
    const due = scheduledJobs.filter((j: any) => j.nextRun <= now)
    if (!due.length) return

    for (const job of due) {
      chrome.notifications.create(`scheduled-${job.id}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Scheduled Payment Due',
        message: `Send ${job.action.amount.toFixed(6)} ${job.action.token} to ${job.action.recipientLabel}. Open SOLAI to confirm.`,
      })
    }

    const updated = scheduledJobs.map((j: any) =>
      due.find((d: any) => d.id === j.id) ? { ...j, nextRun: j.nextRun + j.intervalMs } : j
    )
    await chrome.storage.local.set({ scheduledJobs: updated })
  }

  if (alarm.name === 'price-check') {
    const { conditionalOrders = [] } = await chrome.storage.local.get('conditionalOrders')
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
            iconUrl: 'icons/icon128.png',
            title: `Price Alert: ${order.token} ${order.condition} $${order.targetPriceUsd}`,
            message: `Current: $${price.toFixed(2)}. Open SOLAI to execute: ${order.actionLabel}`,
          })
        }
      }
    } catch {}
  }
})
