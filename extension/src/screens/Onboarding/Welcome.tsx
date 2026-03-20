import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Button from '../../components/ui/Button'
import BlobShape from '../../components/animations/BlobShape'
import FloatingParticles from '../../components/animations/FloatingParticle'

export default function Welcome() {
  const navigate = useNavigate()

  return (
    <div className="relative h-full flex flex-col items-center justify-center overflow-hidden bg-[var(--color-bg)] px-6">
      <FloatingParticles count={10} />
      <div className="absolute opacity-20">
        <BlobShape size={380} />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center text-center gap-6"
      >
        <div className="flex flex-col items-center gap-3">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="w-20 h-20 rounded-3xl bg-black flex items-center justify-center shadow-[0_0_40px_rgba(171,255,122,0.4)]"
          >
            <img src="/icons/icon128.png" alt="SOLAI" className="w-14 h-14 object-contain" />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight">SOLAI</h1>
          <p className="text-sm opacity-50 max-w-[200px]">Your friendly Solana wallet, powered by AI</p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-[280px]">
          <Button size="lg" fullWidth onClick={() => navigate('/create')}>
            Create New Wallet
          </Button>
          <Button size="lg" variant="secondary" fullWidth onClick={() => navigate('/import')}>
            Import Existing Wallet
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
