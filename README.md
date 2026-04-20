# SOLAI Wallet

![License](https://img.shields.io/badge/license-MIT-green) ![Version](https://img.shields.io/badge/version-1.0.8-blue) ![Platform](https://img.shields.io/badge/platform-Chrome%20Extension-yellow)

AI-first, non-custodial Solana wallet built as a Chrome Extension. Clean UI, real on-chain actions, programmable agent wallets for automated payments, and a full suite of power-user tools.

<img width="1280" height="800" alt="SOLAI Wallet" src="https://github.com/user-attachments/assets/ff16e8e7-c422-4852-8b4b-40467f74e633" />

---

## Features

### Wallet
- Create or import wallets from a 12-word seed phrase
- Multi-wallet support — switch between accounts in one click
- Ledger hardware wallet support — connect via USB, sign directly on device
- View SOL and SPL token balances
- Send / receive SOL, USDC, USDT, and all SPL tokens
- Full transaction history grouped by month, filtered per network (mainnet / devnet)
- NFT viewer

### Send
- **Batch Send** — paste a list of `ADDRESS AMOUNT` pairs, preview all recipients, send in one flow
- **Transaction Drafts** — unfinished sends are saved automatically; resume on next open
- **Contact Autocomplete** — type a name or partial address to see matching contacts inline
- **Emoji Contacts** — add an emoji to any contact for instant visual recognition

### Privacy
- **Stealth Addresses** — HD-derived one-time receive addresses (index 1–999), unlinkable to your main wallet on-chain
- Collect funds back to main wallet with a single tap and password confirm

### dApp Connectivity
- Phantom-compatible provider (`window.solana`) and Wallet Standard support
- Appears alongside Phantom and Solflare in all dApp wallet selectors
- Sign Message / Sign Transaction / Sign & Send Transaction — always shows a confirmation popup, never auto-signs
- Connect approval UI with origin management and 90-day auto-expiry
- Revoke access per dApp from the Connected Apps screen

### AI
- Natural language commands: "swap 0.5 SOL to USDC", "send 1 SOL to mom", "buy SOL if price drops 10%"
- Scheduled recurring payments
- Conditional orders (price-triggered swaps via Jupiter)
- OpenRouter API key integration — bring your own model

### Agent Wallets (x402/MPP)
- HD-derived agent keypairs (index 1000+), isolated from your main wallet
- Programmatic guardrails enforced in the service worker — no bypass possible:
  - Daily budget (SOL)
  - Per-transaction limit (SOL)
  - Allowlisted origins (hostname-exact matching)
  - Cooldown between payments
  - Kill-switch (disable instantly without deleting)
- Auto-sign via session-stored keypairs — no popup required once wallet is unlocked
- `window.solaiAgent.pay({ agentId, recipient, amountSol })` — x402-compatible payment primitive
- Fund from main wallet / collect back in one tap
- Per-agent, per-network transaction history

### Token Watchlist
- Track any Solana token by price — independent of your wallet balance
- Shows current price and 24h % change from CoinGecko
- Add / remove from a curated list of 10 tokens (SOL, USDC, USDT, JUP, BONK, JTO, RAY, ORCA, HNT, PYTH)

### History & Analytics
- Full transaction history — no 7-day limit, stores up to 1,000 records, grouped by month
- Per-network filtering — mainnet and devnet histories are kept separate
- **Spending Heatmap** — GitHub-style 13-week activity calendar built from your local tx log
- **Transaction Breakdown** — visual bar showing sends / receives / swaps ratio and total SOL sent

### Notifications
- Push notifications when SOL or any SPL token arrives in your wallet
- Toggle on/off from Settings — default on
- Clicking a notification opens the extension popup

### Power User
- **Keyboard Shortcuts** — `Cmd/Ctrl+K` opens the command palette, `Cmd/Ctrl+L` locks the wallet
- **Command Palette** — search and navigate to any screen without touching the mouse
- **Export Settings** — download contacts, agent configs, stealth labels, and scheduled jobs as JSON
- **In-App Changelog** — "What's new" sheet shown automatically after each update
- **Devnet Faucet** — one-click 1 SOL request on devnet (24-hour rate limit) from the Receive screen

---

## Install

**Chrome Web Store:** [SOLAI Wallet](https://chromewebstore.google.com/detail/solai-wallet/lfclbffajamcijjdpaomclldjpdgopej)

**Manual (Developer Mode):**
1. Download the latest `v1.0.8.zip` from [Releases](../../releases)
2. Unzip — you'll get a `dist/` folder
3. Open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `dist/`

Works on Chrome, Brave, Arc, and any Chromium-based browser.

---

## Build from source

```bash
cd extension
pnpm install
pnpm build
```

Load `extension/dist/` as an unpacked extension.

---

## Agent Wallet API

Any web page can trigger payments from an agent wallet once the user has created and funded one:

```js
// Pay from an agent wallet — no popup, no user confirmation
const { signature } = await window.solaiAgent.pay({
  agentId: 'uuid-of-agent',
  recipient: 'SolanaAddress...',
  amountSol: 0.001,
})
```

All guardrails (daily budget, per-tx limit, origin allowlist, cooldown, kill-switch) are enforced in the service worker before any key is used. If a guardrail is violated, an error is returned instead of signing.

**x402 micropayment pattern:**
```js
let res = await fetch('/api/resource')
if (res.status === 402) {
  const { recipient, amountSol, agentId } = await res.json()
  const { signature } = await window.solaiAgent.pay({ agentId, recipient, amountSol })
  res = await fetch('/api/resource', { headers: { 'X-Payment': signature } })
}
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open command palette |
| `Cmd/Ctrl + L` | Lock wallet |

---

## Security

Non-custodial — private keys never leave your device. Found a vulnerability? See [SECURITY.md](./SECURITY.md) for responsible disclosure.

---

## License

Copyright (c) 2025 Gamandeep. Released under the [MIT License](./LICENSE).
