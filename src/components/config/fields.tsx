import { useState, type KeyboardEvent, type ReactNode } from 'react'

export const changedRing = 'ring-1 ring-amber-500/80 bg-amber-500/10'

const baseInput =
  'h-6 rounded border border-zinc-700 bg-zinc-900 px-1.5 text-xs text-zinc-100 tabular-nums outline-none ' +
  'focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 disabled:opacity-50'

function fmt(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return ''
  return String(Math.round(v * 1e6) / 1e6)
}

function parse(text: string): number | null | undefined {
  const t = text.trim().replace(',', '.')
  if (t === '') return null
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

interface NumberFieldProps {
  value: number | null
  onCommit: (value: number | null) => void
  min?: number
  max?: number
  integer?: boolean
  /** empty input commits null */
  nullable?: boolean
  step?: number
  placeholder?: string
  changed?: boolean
  /** shown in tooltip when changed */
  defaultValue?: number | null
  className?: string
  title?: string
  ariaLabel?: string
}

/**
 * Text-based number input: user can type freely ("0.", "1,5", "-"), valid
 * in-range numbers are committed immediately, the rest is clamped / reverted on blur.
 */
export function NumberField({
  value,
  onCommit,
  min,
  max,
  integer,
  nullable,
  step = 1,
  placeholder,
  changed,
  defaultValue,
  className = 'w-14',
  title,
  ariaLabel,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? fmt(value)

  const isValid = (n: number | null | undefined): n is number | null => {
    if (n === undefined) return false
    if (n === null) return !!nullable
    if (integer && !Number.isInteger(n)) return false
    if (min !== undefined && n < min) return false
    if (max !== undefined && n > max) return false
    return true
  }

  const clamp = (n: number) => {
    let r = integer ? Math.round(n) : n
    if (min !== undefined) r = Math.max(min, r)
    if (max !== undefined) r = Math.min(max, r)
    return r
  }

  const commit = (n: number | null) => {
    if (n !== value) onCommit(n)
  }

  const handleChange = (t: string) => {
    setDraft(t)
    const n = parse(t)
    if (isValid(n)) commit(n)
  }

  const handleBlur = () => {
    if (draft !== null) {
      const n = parse(draft)
      if (typeof n === 'number') commit(clamp(n))
      else if (n === null && nullable) commit(null)
    }
    setDraft(null)
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setDraft(null)
      e.currentTarget.blur()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const cur = parse(text)
      const baseVal = typeof cur === 'number' ? cur : (value ?? 0)
      const d = (e.shiftKey ? 10 : 1) * step * (e.key === 'ArrowUp' ? 1 : -1)
      const next = clamp(Math.round((baseVal + d) * 1e6) / 1e6)
      setDraft(fmt(next))
      commit(next)
    }
  }

  const invalid = draft !== null && !isValid(parse(draft))
  const tip =
    title ??
    (changed && defaultValue !== undefined
      ? `По умолчанию: ${defaultValue === null ? '—' : fmt(defaultValue)}`
      : undefined)

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      title={tip}
      className={`${baseInput} ${className} ${
        invalid ? 'ring-1 ring-red-500 border-red-500' : changed ? changedRing : ''
      }`}
      value={text}
      placeholder={placeholder}
      onFocus={(e) => {
        setDraft(fmt(value))
        e.currentTarget.select()
      }}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKey}
    />
  )
}

export interface SelectOption<T extends string> {
  value: T
  label: string
}

interface SelectFieldProps<T extends string> {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  changed?: boolean
  className?: string
  title?: string
  ariaLabel?: string
}

export function SelectField<T extends string>({
  value,
  options,
  onChange,
  changed,
  className = '',
  title,
  ariaLabel,
}: SelectFieldProps<T>) {
  return (
    <select
      aria-label={ariaLabel}
      title={title}
      className={`${baseInput} cursor-pointer pr-0 ${className} ${changed ? changedRing : ''}`}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-zinc-900">
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Section({
  title,
  right,
  children,
}: {
  title: string
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="border-b border-zinc-800 px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  )
}

export function SmallButton({
  children,
  onClick,
  variant = 'default',
  title,
}: {
  children: ReactNode
  onClick: () => void
  variant?: 'default' | 'accent' | 'danger'
  title?: string
}) {
  const v =
    variant === 'accent'
      ? 'border-amber-600/60 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
      : variant === 'danger'
        ? 'border-red-700/60 bg-red-500/10 text-red-300 hover:bg-red-500/20'
        : 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`h-6 rounded border px-2 text-xs whitespace-nowrap transition-colors ${v}`}
    >
      {children}
    </button>
  )
}
