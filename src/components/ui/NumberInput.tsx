import { useState, type KeyboardEvent } from 'react'
import { cn } from './cn'
import { fmt } from './format'

export interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  integer?: boolean
  className?: string
  disabled?: boolean
  title?: string
  'aria-label'?: string
}

function parse(raw: string): number | null {
  const s = raw.trim().replace(',', '.')
  if (s === '' || s === '-' || s === '.') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function NumberInput({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  integer = false,
  className,
  disabled,
  title,
  'aria-label': ariaLabel,
}: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null)

  const normalize = (n: number) => {
    const v = integer ? Math.round(n) : Math.round(n * 1e6) / 1e6
    return Math.min(max, Math.max(min, v))
  }

  const commit = (n: number) => {
    const v = normalize(n)
    if (v !== value) onChange(v)
    return v
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setDraft(null)
      e.currentTarget.blur()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const base = parse(draft ?? '') ?? value
      const delta = step * (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1)
      setDraft(String(commit(base + delta)))
    }
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      value={draft ?? fmt(value, 6)}
      onFocus={(e) => {
        setDraft(fmt(value, 6))
        e.currentTarget.select()
      }}
      onChange={(e) => {
        const raw = e.target.value
        setDraft(raw)
        const n = parse(raw)
        if (n !== null && n >= min && n <= max && (!integer || Number.isInteger(n))) commit(n)
      }}
      onBlur={() => {
        const n = parse(draft ?? '')
        if (n !== null) commit(n)
        setDraft(null)
      }}
      onKeyDown={onKeyDown}
      className={cn(
        'h-7 w-16 rounded border border-zinc-700 bg-zinc-900 px-1.5 text-right text-sm tabular-nums text-zinc-100',
        'hover:border-zinc-600 focus:border-amber-500/70 focus:outline-none focus:ring-1 focus:ring-amber-500/40',
        'disabled:opacity-40',
        className,
      )}
    />
  )
}
