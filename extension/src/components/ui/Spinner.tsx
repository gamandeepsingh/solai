import { clsx } from 'clsx'

export default function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <div className={clsx(
      'border-2 border-primary border-t-transparent rounded-full animate-spin',
      size === 'sm' && 'w-4 h-4',
      size === 'md' && 'w-6 h-6',
      size === 'lg' && 'w-8 h-8',
      className
    )} />
  )
}
