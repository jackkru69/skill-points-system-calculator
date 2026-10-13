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
  SkillProgress,
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

/** SP cost of one step started at `value` (the tag never changes it). */
export function costAt(value: number, config: Config): number {
  return costAtSorted(value, sortedThresholds(config), config.baseCost)
}

function stepGainOf(tagged: boolean, config: Config): number {
  return tagged && config.tagPointsMultiplier > 0 ? config.tagPointsMultiplier : 1
}

/**
 * Discrete Fallout-style leveling: each step costs `costAt(value at step start)` SP (tag never changes the cost)
 * and raises the skill by `stepGain` (tagged: `tagPointsMultiplier`, else 1). SP short of a full step give
 * proportional partial progress. A full step that crosses the cap still costs the full step.
 */
export function skillProgress(
  start: number,
  totalSP: number,
  tagged: boolean,
  config: Config,
): SkillProgress {
  const cap = config.skillMax
  const sorted = sortedThresholds(config)
  const gain = stepGainOf(tagged, config)
  let v = start
  let sp = Math.max(0, totalSP)
  let lastFullStepSP = 0
  let progressSP = 0
  let stepStart = v

  while (v < cap - EPS && sp > EPS) {
    const cost = costAtSorted(v, sorted, config.baseCost)
    stepStart = v
    if (cost <= 0 || sp >= cost - EPS) {
      const paid = Math.max(0, cost)
      sp = Math.max(0, sp - paid)
      v = Math.min(cap, v + gain)
      lastFullStepSP = paid
      stepStart = v
    } else {
      progressSP = sp
      v = Math.min(cap, v + (sp / cost) * gain)
      sp = 0
    }
  }

  const atCap = v >= cap - EPS
  if (atCap) v = cap
  const stepCost = costAtSorted(atCap ? cap : stepStart, sorted, config.baseCost)
  const overflowSP = round9(sp)
  return {
    value: round9(v),
    overflowSP,
    stepCost,
    stepGain: gain,
    stepProgressSP: round9(progressSP),
    spToNextStep: atCap ? Infinity : round9(Math.max(0, stepCost - progressSP)),
    lastStepSP: round9(overflowSP > EPS ? overflowSP : progressSP > EPS ? progressSP : lastFullStepSP),
  }
}

export function spToValue(
  start: number,
  totalSP: number,
  tagged: boolean,
  config: Config,
): { value: number; overflowSP: number } {
  const { value, overflowSP } = skillProgress(start, totalSP, tagged, config)
  return { value, overflowSP }
}

/**
 * SP delta for `n` step-button presses. n > 0: complete next steps while `available` SP suffice
 * (a step that does not fit is skipped entirely). n < 0: refund the most recent steps (partial progress /
 * overflow first), never more than `refundLimit` in total.
 */
export function stepsDeltaSP(
  start: number,
  totalSP: number,
  tagged: boolean,
  config: Config,
  n: number,
  limit: number,
): { sp: number; steps: number } {
  const count = Math.trunc(Math.abs(n))
  let total = Math.max(0, totalSP)
  let left = Math.max(0, limit)
  let steps = 0
  for (let i = 0; i < count; i++) {
    const p = skillProgress(start, total, tagged, config)
    if (n > 0) {
      const need = p.spToNextStep
      if (!Number.isFinite(need) || need <= EPS || need > left + EPS) break
      total = round9(total + need)
      left = Math.max(0, left - need)
    } else {
      const take = Math.min(p.lastStepSP, left)
      if (take <= EPS) break
      total = round9(total - take)
      left = Math.max(0, left - take)
      if (take < p.lastStepSP - EPS) {
        steps++
        break
      }
    }
    steps++
  }
  return { sp: round9(total - Math.max(0, totalSP)), steps }
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
    const { value, overflowSP, stepCost, stepGain, stepProgressSP, spToNextStep, lastStepSP } =
      skillProgress(start, totalSP, tagged, config)
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
      stepCost,
      stepGain,
      stepProgressSP,
      spToNextStep,
      lastStepSP,
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
