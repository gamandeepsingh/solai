chrome.alarms.create('balance-refresh', { periodInMinutes: 1 })

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'balance-refresh') return

  const { keystore, cachedSolBalance } = await chrome.storage.local.get(['keystore', 'cachedSolBalance'])
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
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [keystore.publicKey],
      }),
    })
    const { result } = await res.json()
    const sol = result.value / 1_000_000_000
    await chrome.storage.local.set({ cachedSolBalance: sol })
  } catch {}
})

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('balance-refresh', { periodInMinutes: 1 })
})
