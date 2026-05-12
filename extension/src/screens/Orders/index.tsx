import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import Header from '../../components/layout/Header'
import BottomNav from '../../components/layout/BottomNav'
import Spinner from '../../components/ui/Spinner'
import { getOrders, cancelOrder } from '../../lib/orders'
import type { ConditionalOrder } from '../../types/orders'

const statusColors: Record<string, string> = {
  pending:  'bg-yellow-500/20 text-yellow-400',
  executed: 'bg-green-500/20 text-green-400',
  failed:   'bg-red-500/20 text-red-400',
}

function OrderRow({ order, onCancel }: { order: ConditionalOrder; onCancel: (id: string) => void }) {
  const dir = order.direction === 'below' ? 'drops to' : 'rises to'
  const change = order.percentChange < 0
    ? `${Math.abs(order.percentChange)}% drop`
    : `${order.percentChange}% rise`

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-bg rounded-2xl p-3.5 flex items-start gap-3 border border-transparent"
    >
      <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold">
            Buy {order.buyToken} with {order.spendAmount} {order.spendToken}
          </span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[order.status]}`}>
            {order.status}
          </span>
        </div>
        <p className="text-[10px] opacity-50 mt-0.5">
          Trigger when {order.buyToken} {dir} ${order.triggerPrice.toFixed(2)} ({change} from ${order.basePrice.toFixed(2)})
        </p>
        <p className="text-[9px] opacity-30 mt-0.5">
          Created {new Date(order.createdAt).toLocaleDateString()}
          {order.executedAt && ` · Executed ${new Date(order.executedAt).toLocaleDateString()}`}
        </p>
        {order.errorMessage && (
          <p className="text-[9px] text-red-400 mt-0.5 truncate">{order.errorMessage}</p>
        )}
        {order.txSignature && (
          <a
            href={`https://solscan.io/tx/${order.txSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-primary opacity-70 hover:opacity-100"
          >
            View tx ↗
          </a>
        )}
      </div>

      {order.status === 'pending' && (
        <button
          onClick={() => onCancel(order.id)}
          className="text-[10px] text-red-400 opacity-70 hover:opacity-100 shrink-0 mt-0.5 transition-opacity"
        >
          Cancel
        </button>
      )}
    </motion.div>
  )
}

export default function OrdersScreen() {
  const [orders, setOrders] = useState<ConditionalOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    setOrders(await getOrders())
    setIsLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleCancel = useCallback(async (id: string) => {
    await cancelOrder(id)
    setOrders(prev => prev.filter(o => o.id !== id))
  }, [])

  const pending = orders.filter(o => o.status === 'pending')
  const history = orders.filter(o => o.status !== 'pending')

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      <Header />
      <div className="flex-1 flex flex-col px-4 pb-16 overflow-y-auto">
        <div className="flex items-center justify-between py-3">
          <h2 className="text-lg font-bold">Orders</h2>
          <span className="text-[10px] opacity-30">Auto-executes via Jupiter</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center mt-10"><Spinner /></div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 mt-10 opacity-40">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/></svg>
            <p className="text-sm">No orders yet</p>
            <p className="text-[11px] text-center opacity-60 max-w-[200px]">
              Ask the AI to "buy 50 USDC of SOL if SOL drops 10%"
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {pending.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold opacity-50 mb-2">Active</p>
                <div className="flex flex-col gap-2">
                  {pending.map((o, i) => (
                    <motion.div key={o.id} transition={{ delay: i * 0.04 }}>
                      <OrderRow order={o} onCancel={handleCancel} />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {history.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold opacity-50 mb-2">History</p>
                <div className="flex flex-col gap-2">
                  {history.map((o, i) => (
                    <motion.div key={o.id} transition={{ delay: i * 0.04 }}>
                      <OrderRow order={o} onCancel={handleCancel} />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
