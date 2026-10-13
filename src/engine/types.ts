export type StatId = 'ST' | 'PE' | 'EN' | 'CH' | 'IN' | 'AG' | 'LK'

export type SkillId =
  | 'smallGuns'
  | 'mediumGuns'
  | 'bigGuns'
  | 'throwing'
  | 'melee'
  | 'unarmed'
  | 'sneak'
  | 'steal'
  | 'lockpick'
  | 'traps'
  | 'repair'
  | 'craft'
  | 'science'
  | 'doctor'
  | 'firstAid'
  | 'barter'

export type Stats = Record<StatId, number>

export interface StatDef {
  id: StatId
  name: string
  short: string
}

/**
 * How `SkillDef.bleedLinks` / `SkillDef.bleedCoef` are interpreted:
 * - 'incoming': links = skills this skill receives bleed from; coef belongs to this (receiving) skill.
 * - 'outgoing': links = skills this skill bleeds into; coef belongs to this (source) skill.
 */
export type BleedMode = 'incoming' | 'outgoing'

export interface SkillDef {
  id: SkillId
  name: string
  baseStats: [StatId, StatId]
  baseMult: number
  /** sources ('incoming') or targets ('outgoing'); null = slot unused; the same skill twice = double bleed */
  bleedLinks: [SkillId | null, SkillId | null]
  /** null = use config.bleedCoefDefault */
  bleedCoef: number | null
}

export interface Threshold {
  /** skill value from which this cost applies */
  from: number
  /** SP per one skill point */
  cost: number
}

export interface Config {
  statMin: number
  statMax: number
  statPool: number
  skills: SkillDef[]
  bleedMode: BleedMode
  bleedCoefDefault: number
  tagBonus: number
  /** skill points a tagged skill gets per 1 SP of base cost (2 = ×2 points) */
  tagPointsMultiplier: number
  tagsNormal: number
  tagsSkilled: number
  skilledBonusSP: number
  spPerIntCoef: number
  startingSP: number
  maxLevel: number
  skillMax: number
  baseCost: number
  /** exactly 5, ascending by `from` */
  thresholds: Threshold[]
}

export interface LevelRecord {
  /** direct SP put into skills on this level */
  alloc: Partial<Record<SkillId, number>>
}

export interface Build {
  stats: Stats
  tags: SkillId[]
  skilled: boolean
  /** levels[0] = level 1; current level = levels.length */
  levels: LevelRecord[]
}

export interface BleedContribution {
  from: SkillId
  amount: number
}

/** One link-slot occurrence: `from` bleeds `coef` × Direct SP into `to`. */
export interface BleedEdge {
  from: SkillId
  to: SkillId
  coef: number
}

/** Aggregated link (duplicate slots summed into coef). */
export interface BleedLink {
  skill: SkillId
  coef: number
}

export interface BleedNode {
  /** skills this one bleeds into */
  outgoing: BleedLink[]
  /** skills this one receives bleed from */
  incoming: BleedLink[]
}

export interface SkillResult {
  id: SkillId
  base: number
  tagged: boolean
  start: number
  directSP: number
  /** direct SP put on the current level */
  currentLevelSP: number
  bleedSP: number
  bleedFrom: BleedContribution[]
  totalSP: number
  /** exact (fractional), capped at skillMax */
  value: number
  overflowSP: number
  /** effective SP per next point (tag multiplier applied) */
  costPerPoint: number
  spToNextPoint: number
}

export interface BuildResult {
  level: number
  skills: Record<SkillId, SkillResult>
  spPerLevel: number
  spEarned: number
  spSpent: number
  spAvailable: number
  statPointsUsed: number
  tagsAllowed: number
}

export interface LevelSnapshot {
  level: number
  values: Record<SkillId, number>
  spAvailable: number
}

export interface Issue {
  level: 'error' | 'warning'
  message: string
}
