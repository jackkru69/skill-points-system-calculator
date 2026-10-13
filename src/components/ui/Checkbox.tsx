import type { ReactNode } from 'react'
import { cn } from './cn'

export interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
  className?: string
  disabled?: boolean
}

export function Checkbox({ checked, onChange, label, className, disabled }: CheckboxProps) {
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 select-none',
        disabled && 'pointer-events-none opacity-40',
        className,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 cursor-pointer accent-amber-500"
      />
      {label}
    </label>
  )
}
