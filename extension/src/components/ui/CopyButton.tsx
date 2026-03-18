import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={handleCopy}
      className={`text-xs px-3 py-1 rounded-full border border-[var(--color-border)] transition-colors ${copied ? 'border-primary text-primary' : 'text-[var(--color-text)]/50 hover:border-primary/50'} ${className ?? ''}`}
    >
      <AnimatePresence mode="wait">
        <motion.span key={copied ? 'copied' : 'copy'} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.15 }}>
          {copied ? '✓ Copied' : 'Copy'}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}
