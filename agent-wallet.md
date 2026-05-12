# Agent Wallet — Feature Roadmap

## What exists today

The current `window.solaiAgent.pay()` API lets any web page trigger a SOL payment from a user's agent wallet — silently, without a confirmation modal — as long as it passes the guardrails (daily budget, per-tx limit, cooldown, origin allowlist). Agent keypairs are HD-derived sub-wallets of the user's seed, funded manually.

**Gap vs. Agent Cash / Lobster Cash:** those products treat agent wallets as programmable spending accounts for AI agents — multi-token, event-driven, server-callable. SOLAI's current system is browser-only and SOL-only. Everything below closes that gap.

---

## 1. SPL Token Transfers (highest priority)

**Problem:** `SOLAI_AGENT_PAY` only sends SOL. AI agents working in DeFi mostly transact in USDC, USDT, or other SPL tokens.

**What to build:**
- Extend `window.solaiAgent.payToken()` with a `mint` or `token` field
- Service worker handles SPL transfer via `sendSplToken()` (already exists in `lib/solana.ts`)
- Per-token guardrails: separate daily budget per token (e.g. `dailyBudgetUsdc: 50`)
- Token-specific spending stats alongside SOL stats

```js
// dApp usage
await window.solaiAgent.payToken({
  agentId: 'abc123',
  recipient: 'DestAddr...',
  token: 'USDC',
  amount: 5.00,
})
```

**Guardrail additions:**
```ts
interface AgentGuardrails {
  dailyBudgetSol: number
  dailyBudgetUsdc: number   // new
  dailyBudgetUsdt: number   // new
  perTxLimitSol: number
  perTxLimitUsdc: number    // new
  allowedOrigins: string[]
  cooldownMs: number
  allowedTokens: string[]   // whitelist of tokens this agent can spend
}
```

---

## 2. Token Allowances (Approve & Spend)

Inspired by ERC-20 `approve()` but for Solana.

**Flow:**
1. dApp calls `window.solaiAgent.requestAllowance({ agentId, token: 'USDC', maxAmount: 100, expiresDays: 30 })`
2. User sees a one-time approval modal: "Allow DappName to spend up to 100 USDC over 30 days"
3. Allowance is stored locally per agentId + token + origin
4. Subsequent `payToken()` calls auto-approve up to the allowance limit — no further prompts

This pattern matches how Agent Cash works: single approval up front, automatic spending within limit.

**Storage model:**
```ts
interface TokenAllowance {
  agentId: string
  origin: string
  token: string
  maxAmount: number
  spentAmount: number
  expiresAt: number
}
```

---

## 3. Swap-then-Pay (Pay in Any Token)

**Problem:** Agent holds USDC but dApp wants SOL. Or agent holds SOL but dApp charges in USDC.

**What to build:**
- `window.solaiAgent.swapAndPay({ agentId, fromToken: 'USDC', toToken: 'SOL', toAmount: 0.05, recipient })`
- Service worker: get Jupiter quote → execute swap → pay recipient, all atomically from agent's perspective
- Guardrails check on the `fromToken` budget pre-swap

This turns agent wallets into a "pay in any token" rail — the dApp specifies what it wants, the agent figures out how to fund it.

---

## 4. Auto-Refill / Treasury Management

**Problem:** Users manually fund agents today. When an agent runs dry, payments silently fail.

**What to build:**
- Per-agent setting: `refillThresholdSol`, `refillAmountSol`
- Background alarm checks agent balances every 30 min
- When balance < threshold, transfer `refillAmount` from main wallet automatically
- Notification sent: "Agent 'DCA Bot' refilled with 0.1 SOL"
- Optional: token-level refill (keep 50 USDC in agent at all times)

**Storage addition:**
```ts
interface AgentWallet {
  // ... existing fields
  autoRefill?: {
    enabled: boolean
    thresholdSol: number
    refillAmountSol: number
  }
}
```

---

## 5. Subscription Payments (Recurring with dApp binding)

Different from the existing scheduler — this is dApp-initiated, not user-initiated.

**Flow:**
1. dApp calls `window.solaiAgent.createSubscription({ agentId, amount: 9.99, token: 'USDC', interval: 'monthly', recipient, label: 'Pro Plan' })`
2. User approves once with the subscription terms shown clearly
3. Every interval, the service worker auto-executes the payment
4. dApp gets a webhook or polling endpoint to verify payment status
5. User can cancel anytime from the Agent screen

**Key difference from scheduler:** Subscriptions are bound to a specific origin and can be verified by that dApp. The scheduler is user-initiated recurring payments.

---

## 6. Programmable Spending Rules (beyond guardrails)

Current guardrails are simple limits. Add conditional logic:

| Rule | Example |
|------|---------|
| Time-of-day window | Only pay between 08:00–22:00 |
| Balance floor | Don't pay if main wallet < 0.5 SOL |
| Weekly cap | Max 1 SOL/week regardless of daily budget |
| Max recipients | Only pay up to N unique addresses |
| Recipient whitelist | Only pay pre-approved addresses |
| Price-gated | Only pay if SOL price > $100 (USD-protect spend) |

**Implementation:** Add `advancedRules?: SpendRule[]` to `AgentGuardrails`. Each rule is evaluated in the service worker's `SOLAI_AGENT_PAY` handler before execution.

---

## 7. Agent API Key — Server-Side Agents

**Problem:** `window.solaiAgent.pay()` only works in a browser tab. Real AI agents (LLM backend, n8n workflow, Python script) need to call the wallet from a server.

**What to build:**
- User generates an API key per agent from the Agent Wallets screen
- API key = signed JWT containing agentId + permissions + expiry, signed with agent keypair
- The server-side AI posts to a local relay: the extension listens via `chrome.runtime.connectNative` or a WebSocket bridge
- Alternative (simpler): user exports a signed payment token — a one-time or time-limited credential the server can include in a payment request that the extension's background worker validates

**dApp/server usage:**
```bash
curl -X POST https://relay.solai.app/agent/pay \
  -H "Authorization: Bearer <agent-api-key>" \
  -d '{"recipient": "...", "token": "USDC", "amount": 5}'
```

This is what Lobster Cash and Agent Cash actually do — they're payment APIs for backend agents, not just browser extensions.

---

## 8. Agent Templates (one-click setup)

Users don't know what guardrails to set. Offer pre-built agent templates:

| Template | Description | Default guardrails |
|----------|-------------|-------------------|
| **DCA Bot** | Buy SOL/token weekly | $50/week, cooldown 6 days |
| **Subscription Agent** | Pay recurring SaaS | Per-origin allowance |
| **Gaming Agent** | In-game purchases | $2/tx, $10/day |
| **Tip Agent** | Tip content creators | $1/tx, $5/day |
| **Yield Optimizer** | Move idle USDC to yield | Only allowed protocols |
| **Gas Wallet** | Pay tx fees automatically | 0.01 SOL/tx, any origin |

Each template pre-fills the guardrails form. User just sets the agent name and confirms.

---

## 9. Spending Analytics Dashboard

Currently: each agent card shows a small progress bar for daily budget. Needs real analytics:

- **Per-agent spend chart**: bar chart of daily spend over 30 days
- **Top recipients**: who received the most from each agent
- **Token breakdown**: how much SOL vs USDC vs USDT
- **Budget utilization**: are agents over/under-funded?
- **Payment success rate**: how many payments succeeded vs failed vs rejected by guardrails

This data is already in `txLog` (filtered by `agentId`). Just needs a dedicated UI screen per agent.

---

## 10. Signed Receipts & Payment Proofs

**Problem:** dApp sends a payment request, agent pays, but dApp has no cryptographic proof the payment came from the right agent.

**What to build:**
- On successful payment, agent signs a receipt: `{sig, timestamp, agentId, agentPubkey, amount, token, recipient}`
- Receipt is returned in the `payToken()` response
- dApp can verify on-chain: transaction exists AND was sent from `agentPubkey`
- Optional: post receipt hash to Solana as a memo instruction for on-chain audit trail

```js
const { signature, receipt } = await window.solaiAgent.payToken({ ... })
// receipt.agentPubkey lets dApp verify on-chain who paid
```

---

## 11. dApp Registry / Integration Directory

A curated screen (or section in Agent Wallets) showing:
- dApps that have integrated `window.solaiAgent.pay()`
- For each: name, logo, what they charge for, trust level
- "Connect this agent to [DappName]" flow — pre-populates origin allowlist
- Community-submitted integrations

This turns agent wallets into a platform, not just a feature. Makes SOLAI the "Stripe for AI agents on Solana."

---

## 12. Multi-Agent Coordination

For power users and AI systems that orchestrate multiple agents:

- **Parent/child agents**: main agent allocates budget to sub-agents
- **Agent groups**: one on/off switch controls multiple agents
- **Inter-agent transfer**: Agent A can fund Agent B (within guardrails)
- **Aggregate budget**: shared daily limit across a group of agents

Example: AI assistant has a "Research Agent" (reads data, no spend) and a "Execution Agent" (can pay, max $10/day). Parent agent coordinates both.

---

## Priority order for implementation

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 🔴 High | SPL token transfers | Medium | Unblocks most use cases |
| 🔴 High | Token allowances | Medium | Core agent UX pattern |
| 🟡 Medium | Auto-refill | Low | Reliability |
| 🟡 Medium | Agent templates | Low | Discovery |
| 🟡 Medium | Spending analytics | Medium | Stickiness |
| 🟡 Medium | Swap-then-pay | Medium | Flexibility |
| 🟢 Later | Programmable rules | High | Power users |
| 🟢 Later | Server-side API key | High | AI agent backends |
| 🟢 Later | Subscriptions | High | dApp platform play |
| 🟢 Later | Signed receipts | Low | Trust/verification |
| 🟢 Later | dApp registry | Medium | Ecosystem |
| 🟢 Later | Multi-agent coordination | High | Power users |
