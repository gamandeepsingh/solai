import { motion } from 'framer-motion'

const BORDER_RADII = [
  '60% 40% 30% 70% / 60% 30% 70% 40%',
  '30% 60% 70% 40% / 50% 60% 30% 60%',
  '50% 80% 20% 60% / 70% 20% 80% 30%',
  '60% 40% 30% 70% / 60% 30% 70% 40%',
]

export default function BlobShape({ size = 300, className = '', opacity = 1 }: { size?: number; className?: string; opacity?: number }) {
  return (
    <motion.div
      animate={{ borderRadius: BORDER_RADII }}
      transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        width: size,
        height: size,
        opacity,
        background: 'linear-gradient(135deg, rgba(171,255,122,0.7) 0%, rgba(122,232,255,0.5) 50%, rgba(184,122,255,0.6) 100%)',
      }}
      className={className}
    />
  )
}
