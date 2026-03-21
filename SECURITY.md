# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |

## Reporting a Vulnerability

SOLAI Wallet is a non-custodial wallet — your private keys never leave your device. If you discover a security vulnerability, please report it responsibly.

**Do not open a public GitHub issue for security bugs.**

Instead, email: **solaiwallet@gmail.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

You can expect a response within **48 hours**. We will coordinate a fix and disclosure timeline with you.

## Scope

In scope:
- Key derivation and encryption (BIP39, AES-GCM)
- Chrome storage handling
- Jupiter swap execution logic
- Conditional order execution in the background service worker

Out of scope:
- Third-party services (Jupiter, OpenRouter, Helius RPC)
- Phishing attacks on users outside the extension
