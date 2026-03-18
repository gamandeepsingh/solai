import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
  isLoading?: boolean
  fullWidth?: boolean
}

export default function Button({ variant = 'primary', size = 'md', children, isLoading, fullWidth, className, disabled, ...props }: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: disabled || isLoading ? 1 : 1.03 }}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.97 }}
      className={clsx(
        'rounded-full font-medium transition-all duration-200 outline-none focus:outline-none',
        fullWidth && 'w-full',
        size === 'sm' && 'px-4 py-1.5 text-sm',
        size === 'md' && 'px-6 py-2.5 text-sm',
        size === 'lg' && 'px-8 py-3 text-base',
        variant === 'primary' && 'bg-primary text-black hover:shadow-[0_0_20px_rgba(171,255,122,0.5)] disabled:opacity-50',
        variant === 'secondary' && 'bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text)] hover:border-primary/50',
        variant === 'ghost' && 'text-[var(--color-text)] hover:bg-white/10',
        variant === 'danger' && 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20',
        (disabled || isLoading) && 'cursor-not-allowed',
        className
      )}
      disabled={disabled || isLoading}
      {...(props as any)}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          {children}
        </span>
      ) : children}
    </motion.button>
  )
}
