  # SOLAI Wallet

  ![License](https://img.shields.io/badge/license-MIT-green) ![Version](https://img.shields.io/badge/version-1.0.9-blue) ![Platform](https://img.shields.io/badge/platform-Chrome%20Extension-yellow)

  Non-custodial Solana wallet built as a Chrome Extension. Autonomous agent wallets, ECDH stealth addresses, AI-powered commands, and full dApp connectivity.

  <img width="1280" height="800" alt="SOLAI Wallet" src="https://github.com/user-attachments/assets/ff16e8e7-c422-4852-8b4b-40467f74e633" />

  ---

  ## What makes SOLAI different

  **Agent Wallets** — programmable sub-wallets that auto-sign payments without a confirmation popup. Set spend limits per token, trusted origins, cooldowns, and auto-refill rules. Four APIs: SOL, SPL tokens, swap-then-pay, and spending allowances.

  **ECDH Stealth Addresses** — true Umbra-style privacy on Solana. Generate a single shareable meta-address; every sender derives a unique one-time address via X25519 ECDH. No address reuse, no on-chain link to your wallet.

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
  | `window.solaiAgent.swapAndPay()` | Swap via Jupiter then send in one call |
  | `window.solaiAgent.requestAllowance()` | Request a one-time spending limit from the user |

  **Guardrails per agent:**
  - Daily SOL budget + per-token daily / per-tx limits (USDC, USDT)
  - Per-transaction SOL limit
  - Origin allowlist (hostname-exact)
  - Cooldown between payments
  - Allowed token whitelist
  - Kill-switch (disable instantly)
  - Auto-refill — top up from main wallet when balance drops below threshold

  **Templates:** Custom, DCA Bot, Gaming, Subscription, Tip Jar, Gas Wallet

  **Analytics per agent:** 7-day spend chart, top recipients, token breakdown, active allowances with revoke

  ### ECDH Stealth Addresses (Umbra-style)
  - **Meta-address** — one shareable public key (`solai:stealth:v1:...`) derived from your seed at a dedicated BIP44 path using Curve25519 (X25519)
  - **Sender flow** — paste a meta-address → SOLAI derives a unique one-time Ed25519 address via ECDH (different every send) and broadcasts an ephemeral pubkey announcement via Solana Memo
  - **Recipient scanning** — background scan every 30 min; your viewing key decodes announcements and discovers incoming stealth payments automatically
  - **Collect** — ECDH-derived addresses sweep to main wallet without re-entering a password (uses session key)
  - **HD privacy addresses** — simpler option: manually generate unlinkable HD-derived addresses and share them per-contact

  ### AI Commands
  Natural language via OpenRouter (bring your own key):
  - "swap 0.5 SOL to USDC", "send $5 to Alice", "buy SOL if price drops 10%"
  - Scheduled recurring payments — assign to main wallet or any agent wallet
  - Conditional orders (price-triggered swaps via Jupiter) — assignable to an agent
  - Streaming responses with markdown rendering

  ### Send
  - **Stealth Send** — paste a `solai:stealth:v1:...` meta-address, SOLAI computes the one-time address automatically
  - **Privacy Send** — toggle to route to a contact's saved privacy address
  - **Batch Send** — paste `ADDRESS AMOUNT` pairs, preview all, send in one flow
  - **Transaction Drafts** — auto-saved, resume on next open
  - **Contact Autocomplete** — search by name or partial address

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

  ## Stealth Address Protocol

  ECDH-based stealth addresses adapted for Solana — no new dependencies, uses `tweetnacl` (already bundled).

  ```
  RECIPIENT generates a meta-address:
    wallet seed → BIP44 m/44'/501'/9999'/0' → X25519 keypair
    meta-address = "solai:stealth:v1:<base58(xPub)>"

  SENDER (given meta-address):
    1. ephemeral = nacl.box.keyPair()               // fresh X25519 keypair per send
    2. S = nacl.scalarMult(ephemeral.priv, xPub)    // ECDH shared secret
    3. seed = SHA256(S ++ ephemeral.pub)             // deterministic stealth seed
    4. stealthKp = nacl.sign.keyPair.fromSeed(seed) // one-time Ed25519 address
    5. Send SOL/tokens to stealthKp.publicKey
    6. Send dust + Memo("SOLAI_STEALTH:<ephemeral.pub>") to recipient's main address

  RECIPIENT scans (every 30 min, no password needed):
    For each announcement ephemeral pub R:
      S = nacl.scalarMult(xPriv, R)                 // same ECDH
      seed = SHA256(S ++ R)
      stealthKp = nacl.sign.keyPair.fromSeed(seed)
      if balance(stealthKp.publicKey) > 0 → discovered!
  ```

  Privacy guarantee: the stealth address has no on-chain link to the recipient's main wallet. Each send produces a different one-time address even to the same recipient.

  ---

  ## Agent Wallet API

  ```js
  // SOL payment — no popup
  const { signature } = await window.solaiAgent.pay({
    agentId: 'your-agent-uuid',
    recipient: 'DestinationAddress...',
    amountSol: 0.001,
  })

  // SPL token payment (USDC, USDT, etc.)
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

  // Request spending allowance (shows approval popup once)
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

  All guardrails are enforced in the service worker before any key is used. A violation returns an error — no signing occurs.

  ---

  ## Keyboard Shortcuts

  | Shortcut | Action |
  |----------|--------|
  | `Cmd/Ctrl + K` | Command palette |
  | `Cmd/Ctrl + L` | Lock wallet |

  ---

  ## Security

  Non-custodial — private keys never leave your device. Stealth viewing keys are cached in `chrome.storage.session` (30-min TTL, cleared on lock). Found a vulnerability? See [SECURITY.md](./SECURITY.md).

  ---

  ## License

  Copyright (c) 2025 Gamandeep. Released under the [MIT License](./LICENSE).
