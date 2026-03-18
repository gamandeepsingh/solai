import { motion } from 'framer-motion'

const BORDER_RADII = [
  '60% 40% 30% 70% / 60% 30% 70% 40%',
  '30% 60% 70% 40% / 50% 60% 30% 60%',
  '50% 80% 20% 60% / 70% 20% 80% 30%',
  '40% 60% 60% 40% / 30% 70% 40% 60%',
  '60% 40% 30% 70% / 60% 30% 70% 40%',
]

export default function BlobBackground() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
      <motion.div
        animate={{ borderRadius: BORDER_RADII }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 320,
          height: 320,
          opacity: 0.12,
          background: 'linear-gradient(135deg, #ABFF7A 0%, #7AE8FF 50%, #B87AFF 100%)',
        }}
      />
    </div>
  )
}
