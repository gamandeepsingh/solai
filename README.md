# SOLAI Wallet

![License](https://img.shields.io/badge/license-MIT-green) ![Version](https://img.shields.io/badge/version-1.0.9-blue) ![Platform](https://img.shields.io/badge/platform-Chrome%20Extension-yellow)

Non-custodial Solana wallet built as a Chrome Extension. Autonomous agent wallets, privacy addresses, AI-powered commands, and full dApp connectivity.

<img width="1280" height="800" alt="SOLAI Wallet" src="https://github.com/user-attachments/assets/ff16e8e7-c422-4852-8b4b-40467f74e633" />

---

## What makes SOLAI different

**Agent Wallets** — programmable sub-wallets that auto-sign payments without confirmation. Set spend limits, allowed tokens, and trusted origins. Integrate with any dApp via `window.solaiAgent.pay()`.

**Privacy Addresses** — generate unlinkable one-time receive addresses derived from your seed. Share a different address with each contact. Collect funds back to your main wallet anytime.

---

## Features

### Wallet Core
- Create or import from a 12-word seed phrase
- Multi-wallet support — switch between accounts instantly
- Ledger hardware wallet — connect via USB, sign on device
- SOL and SPL token balances (USDC, USDT, JUP, BONK, and more)
- Send / receive / swap all tokens
- Transaction history — up to 1,000 records, grouped by month, per-network

### Agent Wallets
HD-derived sub-wallets (index 1000+) isolated from your main wallet. Guardrails enforced in the service worker — no bypass possible.

| API | Description |
|-----|-------------|
| `window.solaiAgent.pay()` | Send SOL without confirmation |
| `window.solaiAgent.payToken()` | Send USDC, USDT, or any SPL token |
| `window.solaiAgent.swapAndPay()` | Swap then send in one call (via Jupiter) |
| `window.solaiAgent.requestAllowance()` | Request a spending limit from the user |

**Guardrails per agent:**
- Daily SOL budget + per-token daily / per-tx limits (USDC, USDT)
- Per-transaction SOL limit
- Origin allowlist (hostname-exact)
- Cooldown between payments
- Allowed token whitelist
- Kill-switch (disable instantly)
- Auto-refill — top up from main wallet when balance drops below threshold

**Templates:** Custom, DCA Bot, Gaming, Subscription, Tip Jar, Gas Wallet

**Analytics per agent:** 7-day spend chart, top recipients, token breakdown, active allowances

### Privacy Addresses
- Generate multiple HD-derived receive addresses (index 1–999)
- Each address is unlinkable to your main wallet on-chain
- Share via copy button — pre-formatted message included
- "Send to privacy address" toggle on the Send screen when a contact has a saved privacy address
- Collect all funds back to main wallet with one tap

### AI Commands
Natural language via OpenRouter (bring your own key):
- "swap 0.5 SOL to USDC", "send $5 to Alice", "buy SOL if price drops 10%"
- Scheduled recurring payments — choose main wallet or an agent wallet to execute
- Conditional orders (price-triggered swaps via Jupiter) — assignable to an agent
- Streaming responses with markdown rendering

### Send
- **Batch Send** — paste `ADDRESS AMOUNT` pairs, preview all, send in one flow
- **Transaction Drafts** — auto-saved, resume on next open
- **Contact Autocomplete** — search by name or partial address
- **Privacy Send** — one toggle to route to a contact's privacy address

### dApp Connectivity
- Phantom-compatible provider (`window.solana`) + Wallet Standard
- Sign Message / Transaction / Sign & Send — always shows a confirmation popup
- Connect approval with 90-day per-origin memory
- Revoke access per dApp from Connected Apps

### Power User
- `Cmd/Ctrl+K` command palette — navigate anywhere without the mouse
- `Cmd/Ctrl+L` lock wallet
- Export contacts, agents, privacy labels, and scheduled jobs as JSON
- Spending heatmap (13-week GitHub-style calendar)
- Token watchlist — track prices independent of your balance
- Devnet faucet — one-click 1 SOL on devnet

---

## Install

**Chrome Web Store:** [SOLAI Wallet](https://chromewebstore.google.com/detail/solai-wallet/lfclbffajamcijjdpaomclldjpdgopej)

**Manual:**
1. Download `v1.0.9.zip` from [Releases](../../releases)
2. Unzip → `dist/` folder
3. `chrome://extensions` → Developer mode → Load unpacked → select `dist/`

Works on Chrome, Brave, Arc, and any Chromium-based browser.

---

## Build from source

```bash
cd extension
npm install
npm run build
```

Load `extension/dist/` as an unpacked extension.

---

## Agent Wallet API

```js
// SOL payment — no popup
const { signature } = await window.solaiAgent.pay({
  agentId: 'your-agent-uuid',
  recipient: 'DestinationAddress...',
  amountSol: 0.001,
})

// SPL token payment
const { signature } = await window.solaiAgent.payToken({
  agentId: 'your-agent-uuid',
  recipient: 'DestinationAddress...',
  token: 'USDC',
  amount: 5.00,
})

// Swap then pay in one call
const { signature } = await window.solaiAgent.swapAndPay({
  agentId: 'your-agent-uuid',
  recipient: 'DestinationAddress...',
  fromToken: 'USDC',
  toToken: 'SOL',
  toAmount: 0.05,
})

// Request a spending allowance (shows approval popup to user once)
const { approved, allowanceId, remaining } = await window.solaiAgent.requestAllowance({
  agentId: 'your-agent-uuid',
  token: 'USDC',
  maxAmount: 50,
  expireDays: 30,
  label: 'Monthly subscription',
})
```

**x402 micropayment pattern:**
```js
let res = await fetch('/api/resource')
if (res.status === 402) {
  const { recipient, amountSol, agentId } = await res.json()
  const { signature } = await window.solaiAgent.pay({ agentId, recipient, amountSol })
  res = await fetch('/api/resource', { headers: { 'X-Payment': signature } })
}
```

All guardrails are enforced in the service worker before any key is used. A guardrail violation returns an error — no signing occurs.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Command palette |
| `Cmd/Ctrl + L` | Lock wallet |

---

## Security

Non-custodial — private keys never leave your device. Found a vulnerability? See [SECURITY.md](./SECURITY.md).

---

## License

Copyright (c) 2025 Gamandeep. Released under the [MIT License](./LICENSE).
