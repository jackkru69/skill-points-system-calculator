import { cn } from './cn'

export interface SelectOption<T extends string> {
  value: T
  label: string
}

export interface SelectProps<T extends string> {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  className?: string
  disabled?: boolean
  title?: string
  'aria-label'?: string
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  className,
  disabled,
  title,
  'aria-label': ariaLabel,
}: SelectProps<T>) {
  return (
    <select
      value={value}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn(
        'h-7 rounded border border-zinc-700 bg-zinc-900 px-1 text-sm text-zinc-100',
        'hover:border-zinc-600 focus:border-amber-500/70 focus:outline-none focus:ring-1 focus:ring-amber-500/40',
        'disabled:opacity-40',
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
