import { DEFAULT_CONFIG } from '../../engine'
import type { Config, Threshold } from '../../engine'
import { sanitizeConfig } from '../../store/share'

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Number of config fields that differ from DEFAULT_CONFIG. */
export function countChanged(config: Config): number {
  let n = 0
  for (const key of Object.keys(DEFAULT_CONFIG) as (keyof Config)[]) {
    const v = config[key]
    if (isNum(v) && v !== DEFAULT_CONFIG[key]) n++
  }
  if (config.bleedMode !== DEFAULT_CONFIG.bleedMode) n++
  config.thresholds.forEach((t, i) => {
    const d = DEFAULT_CONFIG.thresholds[i] as Threshold | undefined
    if (t.from !== d?.from) n++
    if (t.cost !== d?.cost) n++
  })
  for (const s of config.skills) {
    const d = DEFAULT_CONFIG.skills.find((x) => x.id === s.id)
    if (!d) continue
    if (s.baseStats[0] !== d.baseStats[0]) n++
    if (s.baseStats[1] !== d.baseStats[1]) n++
    if (s.baseMult !== d.baseMult) n++
    if (s.bleedLinks[0] !== d.bleedLinks[0]) n++
    if (s.bleedLinks[1] !== d.bleedLinks[1]) n++
    if (s.bleedCoef !== d.bleedCoef) n++
  }
  return n
}

/** Parse imported JSON (a Config or `{ config }`), filling gaps from DEFAULT_CONFIG. Throws on garbage. */
export function parseConfigJson(text: string): Config {
  let raw: unknown = JSON.parse(text)
  if (raw && typeof raw === 'object' && 'config' in raw) raw = (raw as { config: unknown }).config
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('ожидался объект конфига')
  const src = raw as Record<string, unknown>

  if (Array.isArray(src.thresholds)) {
    const ok = src.thresholds.every(
      (t) => !!t && typeof t === 'object' && isNum((t as Threshold).from) && isNum((t as Threshold).cost),
    )
    if (!ok || src.thresholds.length === 0) throw new Error('некорректные пороги')
  }
  return sanitizeConfig(src)
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
