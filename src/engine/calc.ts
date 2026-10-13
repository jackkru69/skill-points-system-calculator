import { SKILL_IDS, STAT_IDS } from './defaults'
import type {
  BleedContribution,
  BleedEdge,
  BleedNode,
  Build,
  BuildResult,
  Config,
  LevelSnapshot,
  SkillDef,
  SkillId,
  SkillResult,
  StatId,
  Stats,
  Threshold,
} from './types'

const EPS = 1e-9

/** Round to 1e-9 to strip floating-point noise. */
export function round9(x: number): number {
  if (!Number.isFinite(x)) return x
  return Math.round(x * 1e9) / 1e9
}

function sortedThresholds(config: Config): Threshold[] {
  return [...config.thresholds].sort((a, b) => a.from - b.from)
}

export function baseValue(skill: SkillDef, stats: Stats): number {
  const [a, b] = skill.baseStats
  return (stats[a] ?? 0) * (stats[b] ?? 0) * skill.baseMult
}

function costAtSorted(value: number, sorted: Threshold[], baseCost: number): number {
  let cost = baseCost
  for (const t of sorted) {
    if (t.from <= value + EPS) cost = t.cost
    else break
  }
  return cost
}

/** Base SP cost of one skill point at `value` (without tag multiplier). */
export function costAt(value: number, config: Config): number {
  return costAtSorted(value, sortedThresholds(config), config.baseCost)
}

function nextBoundary(value: number, sorted: Threshold[], cap: number): number {
  for (const t of sorted) {
    if (t.from > value + EPS) return Math.min(t.from, cap)
  }
  return cap
}

/** Effective SP-per-point multiplier: a tagged skill gets `tagPointsMultiplier` points per SP-worth of cost. */
function tagMult(tagged: boolean, config: Config): number {
  return tagged && config.tagPointsMultiplier > 0 ? 1 / config.tagPointsMultiplier : 1
}

export function spToValue(
  start: number,
  totalSP: number,
  tagged: boolean,
  config: Config,
): { value: number; overflowSP: number } {
  const cap = config.skillMax
  const sorted = sortedThresholds(config)
  const mult = tagMult(tagged, config)
  let v = start
  let sp = Math.max(0, totalSP)

  if (v >= cap) return { value: round9(Math.min(v, cap)), overflowSP: round9(sp) }

  while (sp > EPS && v < cap - EPS) {
    const cost = costAtSorted(v, sorted, config.baseCost) * mult
    const boundary = nextBoundary(v, sorted, cap)
    if (cost <= 0) {
      v = boundary
      continue
    }
    const needed = (boundary - v) * cost
    if (sp >= needed - EPS) {
      sp -= needed
      v = boundary
    } else {
      v += sp / cost
      sp = 0
    }
  }

  if (v >= cap - EPS) v = cap
  return { value: round9(v), overflowSP: round9(Math.max(0, sp)) }
}

/** SP needed to raise the skill value from `from` to `to` (to <= cap). */
function spBetween(from: number, to: number, tagged: boolean, config: Config): number {
  const sorted = sortedThresholds(config)
  const mult = tagMult(tagged, config)
  let v = from
  let sp = 0
  while (v < to - EPS) {
    const cost = costAtSorted(v, sorted, config.baseCost) * mult
    const boundary = Math.min(nextBoundary(v, sorted, config.skillMax), to)
    sp += (boundary - v) * Math.max(0, cost)
    v = boundary
  }
  return sp
}

/** SP still needed for floor(value) to grow by 1 (Infinity at cap). */
export function spToNextPoint(
  start: number,
  totalSP: number,
  tagged: boolean,
  config: Config,
): number {
  const { value } = spToValue(start, totalSP, tagged, config)
  if (value >= config.skillMax) return Infinity
  const target = Math.min(Math.floor(value + EPS) + 1, config.skillMax)
  return round9(spBetween(value, target, tagged, config))
}

export function spPerLevel(stats: Stats, skilled: boolean, config: Config): number {
  return (stats.IN ?? 0) * config.spPerIntCoef + (skilled ? config.skilledBonusSP : 0)
}

export function spEarned(build: Build, config: Config): number {
  const levelUps = Math.max(0, build.levels.length - 1)
  return round9(config.startingSP + levelUps * spPerLevel(build.stats, build.skilled, config))
}

function emptySkillRecord(): Record<SkillId, number> {
  return Object.fromEntries(SKILL_IDS.map((id) => [id, 0])) as Record<SkillId, number>
}

export function directSP(build: Build): Record<SkillId, number> {
  const out = emptySkillRecord()
  for (const level of build.levels) {
    for (const [id, amount] of Object.entries(level.alloc) as [SkillId, number | undefined][]) {
      if (typeof amount === 'number' && Number.isFinite(amount)) {
        out[id] = (out[id] ?? 0) + amount
      }
    }
  }
  for (const id of Object.keys(out) as SkillId[]) out[id] = round9(out[id])
  return out
}

function bleedCoefOf(skill: SkillDef, config: Config): number {
  return skill.bleedCoef ?? config.bleedCoefDefault
}

/**
 * All bleed link occurrences (a skill listed twice yields two edges), resolved per `config.bleedMode`:
 * 'incoming' — links are sources of the skill, coef is the receiving skill's;
 * 'outgoing' — links are targets of the skill, coef is the source skill's.
 */
export function bleedEdges(config: Config): BleedEdge[] {
  const known = new Set(config.skills.map((s) => s.id))
  const edges: BleedEdge[] = []
  for (const s of config.skills) {
    const coef = bleedCoefOf(s, config)
    for (const link of s.bleedLinks) {
      if (!link || !known.has(link)) continue
      edges.push(
        config.bleedMode === 'outgoing'
          ? { from: s.id, to: link, coef }
          : { from: link, to: s.id, coef },
      )
    }
  }
  return edges
}

function addLink(list: { skill: SkillId; coef: number }[], skill: SkillId, coef: number) {
  const existing = list.find((l) => l.skill === skill)
  if (existing) existing.coef = round9(existing.coef + coef)
  else list.push({ skill, coef })
}

/** For each skill: whom it bleeds into and whom it receives from (duplicate links summed). */
export function bleedGraph(config: Config): Record<SkillId, BleedNode> {
  const graph = {} as Record<SkillId, BleedNode>
  for (const s of config.skills) graph[s.id] = { outgoing: [], incoming: [] }
  for (const e of bleedEdges(config)) {
    addLink(graph[e.from].outgoing, e.to, e.coef)
    addLink(graph[e.to].incoming, e.from, e.coef)
  }
  return graph
}

export function computeBuild(build: Build, config: Config): BuildResult {
  const direct = directSP(build)
  const current = build.levels[build.levels.length - 1]?.alloc ?? {}

  const bleed = emptySkillRecord()
  const bleedFrom = {} as Record<SkillId, BleedContribution[]>
  for (const s of config.skills) bleedFrom[s.id] = []

  for (const e of bleedEdges(config)) {
    const amount = (direct[e.from] ?? 0) * e.coef
    if (amount === 0) continue
    bleed[e.to] = (bleed[e.to] ?? 0) + amount
    const list = (bleedFrom[e.to] ??= [])
    const existing = list.find((c) => c.from === e.from)
    if (existing) existing.amount = round9(existing.amount + amount)
    else list.push({ from: e.from, amount: round9(amount) })
  }

  const skills = {} as Record<SkillId, SkillResult>
  let spSpent = 0
  for (const s of config.skills) {
    const tagged = build.tags.includes(s.id)
    const base = baseValue(s, build.stats)
    const start = base + (tagged ? config.tagBonus : 0)
    const d = direct[s.id] ?? 0
    const b = round9(bleed[s.id] ?? 0)
    const totalSP = round9(d + b)
    const { value, overflowSP } = spToValue(start, totalSP, tagged, config)
    spSpent += d
    skills[s.id] = {
      id: s.id,
      base,
      tagged,
      start,
      directSP: d,
      currentLevelSP: round9(current[s.id] ?? 0),
      bleedSP: b,
      bleedFrom: bleedFrom[s.id] ?? [],
      totalSP,
      value,
      overflowSP,
      costPerPoint: round9(costAt(value, config) * tagMult(tagged, config)),
      spToNextPoint: spToNextPoint(start, totalSP, tagged, config),
    }
  }

  const earned = spEarned(build, config)
  spSpent = round9(spSpent)
  return {
    level: build.levels.length,
    skills,
    spPerLevel: spPerLevel(build.stats, build.skilled, config),
    spEarned: earned,
    spSpent,
    spAvailable: round9(earned - spSpent),
    statPointsUsed: STAT_IDS.reduce((sum, id) => sum + (build.stats[id] ?? 0), 0),
    tagsAllowed: build.skilled ? config.tagsSkilled : config.tagsNormal,
  }
}

/** Cumulative snapshot after each level. */
export function computeHistory(build: Build, config: Config): LevelSnapshot[] {
  const out: LevelSnapshot[] = []
  for (let i = 1; i <= build.levels.length; i++) {
    const r = computeBuild({ ...build, levels: build.levels.slice(0, i) }, config)
    const values = {} as Record<SkillId, number>
    for (const s of config.skills) values[s.id] = r.skills[s.id].value
    out.push({ level: i, values, spAvailable: r.spAvailable })
  }
  return out
}

/** In how many skill bases each stat participates (counted once per skill). */
export function statUsage(config: Config): Record<StatId, number> {
  const out = Object.fromEntries(STAT_IDS.map((id) => [id, 0])) as Record<StatId, number>
  for (const s of config.skills) {
    for (const id of new Set(s.baseStats)) out[id] = (out[id] ?? 0) + 1
  }
  return out
}
