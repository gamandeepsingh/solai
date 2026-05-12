const PHISHING_DOMAINS = [
  'solana-airdrop.com',
  'solana-airdrop.net',
  'solana-airdrop.io',
  'phantom-wallet.net',
  'phantom-wallet.com',
  'phantom-app.net',
  'phantomwallet.net',
  'solana-nft.com',
  'solana-nft.net',
  'free-solana.com',
  'solana-drop.com',
  'solanatoken.com',
  'solanaprotocol.com',
  'magiceden-nft.com',
  'jupiter-swap.net',
  'jup-swap.com',
]

const SUSPICIOUS_KEYWORDS = ['airdrop', 'free-sol', 'free-nft', 'sol-giveaway', 'claim-sol']

export function isSuspiciousUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    if (PHISHING_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) return true
    if (SUSPICIOUS_KEYWORDS.some(k => hostname.includes(k))) return true
    return false
  } catch {
    return false
  }
}

export function getSuspiciousUrlWarning(url: string): string | null {
  if (!isSuspiciousUrl(url)) return null
  try {
    const hostname = new URL(url).hostname
    return `"${hostname}" may be a phishing site. Do not connect your wallet or share your seed phrase.`
  } catch {
    return 'This URL may be a phishing site. Proceed with caution.'
  }
}
