# SOLAI Wallet

![License](https://img.shields.io/badge/license-MIT-green) ![Version](https://img.shields.io/badge/version-1.0.6-blue) ![Platform](https://img.shields.io/badge/platform-Chrome%20Extension-yellow)

AI-first, non-custodial Solana wallet built as a Chrome Extension. Clean UI, real on-chain actions, and programmable agent wallets for automated payments.

<img width="1280" height="800" alt="SOLAI Wallet" src="https://github.com/user-attachments/assets/ff16e8e7-c422-4852-8b4b-40467f74e633" />

---

## Features

**Wallet**
- Create or import wallets from a 12-word seed phrase
- Multi-wallet support — switch between accounts in one click
- View SOL and SPL token balances
- Send / receive SOL, USDC, USDT, and other tokens
- Full transaction history (mainnet & devnet)
- NFT viewer

**Privacy**
- Stealth addresses — HD-derived one-time receive addresses (index 1–999) unlinkable to your main wallet on-chain
- Collect funds from stealth addresses back to main wallet with a single tap

**dApp Connectivity**
- Phantom-compatible provider (`window.solana`) and Wallet Standard support
- Sign Message / Sign Transaction / Sign & Send Transaction — always shows a confirmation popup, never auto-signs
- Connect approval UI with origin management
- Revoke access per dApp from Connected Apps

**AI**
- Natural language commands: "swap 0.5 SOL to USDC", "send 1 SOL to mom", "buy SOL if price drops 10%"
- Scheduled recurring payments
- Conditional orders (price-triggered swaps)
- OpenRouter API key integration

**Agent Wallets (x402/MPP)**
- HD-derived agent keypairs (index 1000+), isolated from your main wallet
- Programmatic guardrails per agent:
  - Daily budget (SOL)
  - Per-transaction limit (SOL)
  - Allowlisted origins only
  - Cooldown between payments
  - Kill-switch (enable/disable instantly)
- Auto-sign via session storage — no popup required once unlocked
- `window.solaiAgent.pay({ agentId, recipient, amountSol })` — x402-compatible payment primitive
- Fund and collect from any agent wallet
- Per-agent, per-network transaction history

**Security**
- AES-256-GCM encrypted keystore (password-derived)
- Session keys stored in `chrome.storage.session` (auto-expire, never touch disk)
- Wallet lockout after 10 failed attempts (5-minute cooldown)
- Reset to onboarding with password confirmation

---

## Install (no build required)

**Chrome Web Store:** [SOLAI Wallet](https://chromewebstore.google.com/detail/solai-wallet/lfclbffajamcijjdpaomclldjpdgopej)

**Manual (Developer Mode):**
1. Download the latest `v1.0.6.zip` from [Releases](../../releases)
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

Once a user has created an agent wallet in the extension, any web page can trigger payments:

```js
// Pay from an agent wallet (no confirmation popup)
const { signature } = await window.solaiAgent.pay({
  agentId: 'uuid-of-agent',
  recipient: 'SolanaAddressHere...',
  amountSol: 0.001,
})
```

Guardrails are enforced in the service worker before any key is used. If a guardrail is violated, an error is returned instead of signing.

**x402 pattern:**
```js
let res = await fetch('/api/resource')
if (res.status === 402) {
  const { recipient, amountSol, agentId } = await res.json()
  const { signature } = await window.solaiAgent.pay({ agentId, recipient, amountSol })
  res = await fetch('/api/resource', { headers: { 'X-Payment': signature } })
}
```

---

## Security

Non-custodial — private keys never leave your device. Found a vulnerability? See [SECURITY.md](./SECURITY.md) for responsible disclosure.

---

## License

Copyright (c) 2025 Gamandeep. Released under the [MIT License](./LICENSE).
