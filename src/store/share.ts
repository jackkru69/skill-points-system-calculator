import { DEFAULT_BUILD, DEFAULT_CONFIG, SKILL_IDS, STAT_IDS } from '../engine/defaults'
import type { BleedMode, Build, Config, LevelRecord, SkillDef, SkillId, Threshold } from '../engine/types'

export interface SharedState {
  build: Build
  config: Config
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isSkillId = (v: unknown): v is SkillId =>
  typeof v === 'string' && (SKILL_IDS as string[]).includes(v)
const isBleedMode = (v: unknown): v is BleedMode => v === 'incoming' || v === 'outgoing'

/** Pre-v2 configs stored outgoing links as `bleedTargets` and had no `bleedMode`. */
function isLegacyBleed(raw: Record<string, unknown>): boolean {
  if (isBleedMode(raw.bleedMode)) return false
  return Array.isArray(raw.skills) && raw.skills.some((s) => isObj(s) && Array.isArray(s.bleedTargets))
}

function sanitizeSkill(def: SkillDef, raw: unknown, legacy: boolean): SkillDef {
  if (!isObj(raw)) return def
  const stats = Array.isArray(raw.baseStats) ? raw.baseStats : []
  const statOk = (v: unknown) => typeof v === 'string' && (STAT_IDS as string[]).includes(v)
  const rawLinks = legacy ? raw.bleedTargets : raw.bleedLinks
  const bleed = Array.isArray(rawLinks) ? rawLinks : []
  const target = (v: unknown, fallback: SkillId | null) =>
    v === null ? null : isSkillId(v) ? v : fallback
  return {
    id: def.id,
    name: typeof raw.name === 'string' ? raw.name : def.name,
    baseStats: [
      statOk(stats[0]) ? stats[0] : def.baseStats[0],
      statOk(stats[1]) ? stats[1] : def.baseStats[1],
    ] as SkillDef['baseStats'],
    baseMult: isNum(raw.baseMult) ? raw.baseMult : def.baseMult,
    bleedLinks: [
      target(bleed[0], def.bleedLinks[0]),
      target(bleed[1], def.bleedLinks[1]),
    ],
    bleedCoef: raw.bleedCoef === null ? null : isNum(raw.bleedCoef) ? raw.bleedCoef : def.bleedCoef,
  }
}

/** Fill missing/invalid fields of an untrusted config with defaults. */
export function sanitizeConfig(raw: unknown): Config {
  const out: Config = structuredClone(DEFAULT_CONFIG)
  if (!isObj(raw)) return out
  for (const key of Object.keys(DEFAULT_CONFIG) as (keyof Config)[]) {
    if (typeof DEFAULT_CONFIG[key] !== 'number') continue
    const v = raw[key]
    if (isNum(v)) (out[key] as number) = v
  }
  const legacy = isLegacyBleed(raw)
  out.bleedMode = legacy ? 'outgoing' : isBleedMode(raw.bleedMode) ? raw.bleedMode : DEFAULT_CONFIG.bleedMode
  const rawSkills = Array.isArray(raw.skills) ? raw.skills : []
  out.skills = DEFAULT_CONFIG.skills.map((def) =>
    sanitizeSkill(
      def,
      rawSkills.find((s) => isObj(s) && s.id === def.id),
      legacy,
    ),
  )
  const rawTh = Array.isArray(raw.thresholds) ? raw.thresholds : []
  const th: Threshold[] = rawTh
    .filter((t): t is { from: number; cost: number } => isObj(t) && isNum(t.from) && isNum(t.cost))
    .map((t) => ({ from: t.from, cost: t.cost }))
  out.thresholds = th.length > 0 ? th : DEFAULT_CONFIG.thresholds.map((t) => ({ ...t }))
  return out
}

/** Fill missing/invalid fields of an untrusted build with defaults. */
export function sanitizeBuild(raw: unknown): Build {
  if (!isObj(raw)) return structuredClone(DEFAULT_BUILD)
  const rawStats = isObj(raw.stats) ? raw.stats : {}
  const stats = { ...DEFAULT_BUILD.stats }
  for (const id of STAT_IDS) {
    const v = rawStats[id]
    if (isNum(v)) stats[id] = v
  }
  const tags = Array.isArray(raw.tags)
    ? [...new Set(raw.tags.filter(isSkillId))]
    : [...DEFAULT_BUILD.tags]
  const levels: LevelRecord[] = (Array.isArray(raw.levels) ? raw.levels : []).map((l) => {
    const alloc: LevelRecord['alloc'] = {}
    if (isObj(l) && isObj(l.alloc)) {
      for (const [k, v] of Object.entries(l.alloc)) {
        if (isSkillId(k) && isNum(v) && v > 0) alloc[k] = v
      }
    }
    return { alloc }
  })
  return {
    stats,
    tags,
    skilled: raw.skilled === true,
    levels: levels.length > 0 ? levels : [{ alloc: {} }],
  }
}

function utf8ToBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToUtf8(str: string): string {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeState(state: SharedState): string {
  return utf8ToBase64Url(JSON.stringify({ v: 1, build: state.build, config: state.config }))
}

/** Returns null if the string can't be decoded. */
export function decodeState(str: string): SharedState | null {
  try {
    const data: unknown = JSON.parse(base64UrlToUtf8(str.trim()))
    if (!isObj(data) || (!isObj(data.build) && !isObj(data.config))) return null
    return { build: sanitizeBuild(data.build), config: sanitizeConfig(data.config) }
  } catch {
    return null
  }
}

const HASH_PREFIX = '#s='

export function makeShareUrl(state: SharedState): string {
  const { origin, pathname, search } = window.location
  return `${origin}${pathname}${search}${HASH_PREFIX}${encodeState(state)}`
}

/** Reads `#s=...` from location.hash. Returns null if absent/invalid. */
export function loadFromHash(): SharedState | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash
  if (!hash.startsWith(HASH_PREFIX)) return null
  return decodeState(hash.slice(HASH_PREFIX.length))
}

export function clearHash(): void {
  if (typeof window === 'undefined') return
  const { pathname, search } = window.location
  window.history.replaceState(null, '', pathname + search)
}
