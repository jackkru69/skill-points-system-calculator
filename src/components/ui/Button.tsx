import type { ButtonHTMLAttributes } from 'react'
import { cn } from './cn'

type Variant = 'default' | 'primary' | 'ghost' | 'danger' | 'success'
type Size = 'xs' | 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  active?: boolean
}

const variants: Record<Variant, string> = {
  default: 'bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600',
  primary: 'bg-amber-500 text-zinc-950 border-amber-400 hover:bg-amber-400 font-semibold',
  ghost: 'bg-transparent text-zinc-400 border-transparent hover:bg-zinc-800 hover:text-zinc-200',
  danger: 'bg-zinc-800 text-red-300 border-zinc-700 hover:bg-red-500/20 hover:border-red-500/50',
  success: 'bg-zinc-800 text-emerald-300 border-zinc-700 hover:bg-emerald-500/20 hover:border-emerald-500/50',
}

const sizes: Record<Size, string> = {
  xs: 'h-6 px-1.5 text-xs',
  sm: 'h-7 px-2 text-xs',
  md: 'h-8 px-3 text-sm',
}

export function Button({
  variant = 'default',
  size = 'sm',
  active = false,
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-1 rounded border whitespace-nowrap tabular-nums transition-colors select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60',
        'disabled:pointer-events-none disabled:opacity-35',
        variants[variant],
        sizes[size],
        active && 'ring-1 ring-amber-500/70 border-amber-500/60 text-amber-300',
        className,
      )}
      {...rest}
    />
  )
}
