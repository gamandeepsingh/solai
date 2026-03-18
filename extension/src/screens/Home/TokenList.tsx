import { motion } from 'framer-motion'
import type { TokenBalance } from '../../types/tokens'

function TokenRow({ token, index }: { token: TokenBalance; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className="flex items-center justify-between py-3 px-4 rounded-2xl hover:bg-white/5 transition-colors"
    >
      <div className="flex items-center gap-3">
        <img src={token.meta.logoUri} alt={token.meta.symbol} className="w-8 h-8 rounded-full" onError={e => { (e.target as HTMLImageElement).src = '' }} />
        <div>
          <p className="text-sm font-semibold">{token.meta.symbol}</p>
          <p className="text-[10px] opacity-40">{token.meta.name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium">{token.amount.toFixed(token.meta.symbol === 'SOL' ? 4 : 2)}</p>
        <p className="text-[10px] opacity-40">{token.meta.symbol}</p>
      </div>
    </motion.div>
  )
}

export default function TokenList({ balances }: { balances: TokenBalance[] }) {
  if (!balances.length) return null
  return (
    <div className="mx-4 card-bg rounded-3xl overflow-hidden">
      {balances.map((token, i) => (
        <div key={token.meta.symbol}>
          <TokenRow token={token} index={i} />
          {i < balances.length - 1 && <div className="mx-4 h-px bg-[var(--color-border)]" />}
        </div>
      ))}
    </div>
  )
}
