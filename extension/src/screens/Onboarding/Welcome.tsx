import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Button from '../../components/ui/Button'
import BlobShape from '../../components/animations/BlobShape'
import FloatingParticles from '../../components/animations/FloatingParticle'

function CuteCreature() {
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative flex items-center justify-center"
    >
      <div className="absolute w-32 h-32 bg-primary/10 blur-xl rounded-full" />

      <motion.div
        className="relative w-32 h-32"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <img src="/icons/octopus.png" alt="" className="w-full h-full object-contain" />

        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 128 128" fill="none">
          <defs>
            <clipPath id="welcomeClipEyeL">
              <circle cx="46" cy="54" r="9" />
            </clipPath>
            <clipPath id="welcomeClipEyeR">
              <circle cx="76" cy="54" r="9" />
            </clipPath>
          </defs>

          <circle cx="46" cy="54" r="9" fill="#fff" />
          <circle cx="46" cy="52" r="4.5" fill="#111" />
          <circle cx="44" cy="49.5" r="1.8" fill="#fff" opacity="0.9" />
          <motion.rect
            x="37" y="45" width="18"
            fill="#ABFF7A"
            clipPath="url(#welcomeClipEyeL)"
            initial={{ height: 0 }}
            animate={{ height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          />

          <circle cx="76" cy="54" r="9" fill="#fff" />
          <circle cx="76" cy="52" r="4.5" fill="#111" />
          <circle cx="74" cy="49.5" r="1.8" fill="#fff" opacity="0.9" />
          <motion.rect
            x="67" y="45" width="18"
            fill="#ABFF7A"
            clipPath="url(#welcomeClipEyeR)"
            initial={{ height: 0 }}
            animate={{ height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          />

          <motion.path
            d="M 50 68 Q 61 76 72 68"
            stroke="#333"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          />
        </svg>
      </motion.div>
    </motion.div>
  )
}

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
          <CuteCreature />
          <h1 className="text-3xl font-bold tracking-tight">SOLAI</h1>
          <p className="text-sm opacity-50 max-w-[200px]">Your autonomous, privacy-first Solana wallet</p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-[280px]">
          <Button size="lg" fullWidth onClick={() => navigate('/create')}>
            Create New Wallet
          </Button>
          <Button size="lg" variant="secondary" fullWidth onClick={() => navigate('/import')}>
            Import Existing Wallet
          </Button>
          <button
            onClick={() => navigate('/ledger-connect')}
            className="w-full py-3 rounded-2xl border border-[var(--color-border)] text-sm font-semibold flex items-center justify-center gap-2 opacity-70 hover:opacity-100 hover:border-primary/40 transition-all"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
              <line x1="12" y1="18" x2="12.01" y2="18"/>
            </svg>
            Connect Ledger
          </button>
        </div>
      </motion.div>
    </div>
  )
}
