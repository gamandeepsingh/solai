import { clsx } from 'clsx'
import type { InputHTMLAttributes, ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  rightElement?: ReactNode
}

export default function Input({ label, error, rightElement, className, ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && <label className="block text-xs font-medium text-[var(--color-text)] opacity-60 mb-1.5">{label}</label>}
      <div className="relative">
        <input
          className={clsx(
            'w-full rounded-2xl px-4 py-3 text-sm bg-[var(--color-card)] border border-[var(--color-border)]',
            'text-[var(--color-text)] placeholder:text-[var(--color-text)]/30',
            'outline-none focus:border-primary/60 transition-colors',
            rightElement && 'pr-12',
            className
          )}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
}
