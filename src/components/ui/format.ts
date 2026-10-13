export function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '—'
  const factor = 10 ** digits
  const rounded = Math.round(n * factor) / factor
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}

export function roundUp2(n: number): number {
  return Math.ceil(n * 100 - 1e-7) / 100
}

export function displayValue(value: number): number {
  return Math.floor(value + 1e-9)
}
