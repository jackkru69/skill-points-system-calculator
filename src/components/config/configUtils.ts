import { DEFAULT_CONFIG, STATS } from '../../engine'
import type { Config, SkillDef, SkillId, StatId, Threshold } from '../../engine'

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const statIds = new Set<string>(STATS.map((s) => s.id))
const skillIds = new Set<string>(DEFAULT_CONFIG.skills.map((s) => s.id))

/** Number of config fields that differ from DEFAULT_CONFIG. */
export function countChanged(config: Config): number {
  let n = 0
  for (const key of Object.keys(DEFAULT_CONFIG) as (keyof Config)[]) {
    const v = config[key]
    if (isNum(v) && v !== DEFAULT_CONFIG[key]) n++
  }
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
    if (s.bleedTargets[0] !== d.bleedTargets[0]) n++
    if (s.bleedTargets[1] !== d.bleedTargets[1]) n++
    if (s.bleedCoef !== d.bleedCoef) n++
  }
  return n
}

/** Parse imported JSON (a Config or `{ config }`), filling gaps from DEFAULT_CONFIG. Throws on garbage. */
export function parseConfigJson(text: string): Config {
  let raw: unknown = JSON.parse(text)
  if (raw && typeof raw === 'object' && 'config' in raw) raw = (raw as { config: unknown }).config
  if (!raw || typeof raw !== 'object') throw new Error('ожидался объект конфига')
  const src = raw as Record<string, unknown>

  const result: Config = structuredClone(DEFAULT_CONFIG)
  for (const key of Object.keys(DEFAULT_CONFIG) as (keyof Config)[]) {
    if (isNum(DEFAULT_CONFIG[key]) && isNum(src[key])) (result as unknown as Record<string, number>)[key] = src[key]
  }

  if (Array.isArray(src.thresholds)) {
    const th = src.thresholds.filter(
      (t): t is Threshold => !!t && typeof t === 'object' && isNum((t as Threshold).from) && isNum((t as Threshold).cost),
    )
    if (th.length !== src.thresholds.length || th.length === 0) throw new Error('некорректные пороги')
    result.thresholds = th.map((t) => ({ from: t.from, cost: t.cost }))
  }

  if (Array.isArray(src.skills)) {
    const target = (v: unknown): SkillId | null => (typeof v === 'string' && skillIds.has(v) ? (v as SkillId) : null)
    result.skills = result.skills.map((def): SkillDef => {
      const s = (src.skills as unknown[]).find(
        (x): x is Partial<SkillDef> => !!x && typeof x === 'object' && (x as SkillDef).id === def.id,
      )
      if (!s) return def
      const stats = Array.isArray(s.baseStats) && s.baseStats.every((x) => statIds.has(x)) ? s.baseStats : def.baseStats
      const bt = Array.isArray(s.bleedTargets) ? s.bleedTargets : def.bleedTargets
      return {
        ...def,
        name: typeof s.name === 'string' && s.name ? s.name : def.name,
        baseStats: [stats[0] as StatId, stats[1] as StatId],
        baseMult: isNum(s.baseMult) ? s.baseMult : def.baseMult,
        bleedTargets: [target(bt[0]), target(bt[1])],
        bleedCoef: isNum(s.bleedCoef) ? s.bleedCoef : null,
      }
    })
  }
  return result
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
