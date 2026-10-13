import type { Build, Config, SkillDef, SkillId, StatDef, StatId } from './types'

export const STATS: StatDef[] = [
  { id: 'ST', name: 'Сила', short: 'СЛ' },
  { id: 'PE', name: 'Восприятие', short: 'ВС' },
  { id: 'EN', name: 'Выносливость', short: 'ВН' },
  { id: 'CH', name: 'Харизма', short: 'ХАР' },
  { id: 'IN', name: 'Интеллект', short: 'ИНТ' },
  { id: 'AG', name: 'Ловкость', short: 'ЛВ' },
  { id: 'LK', name: 'Удача', short: 'УД' },
]

export const STAT_IDS: StatId[] = STATS.map((s) => s.id)

export const SKILL_IDS: SkillId[] = [
  'smallGuns',
  'mediumGuns',
  'bigGuns',
  'throwing',
  'melee',
  'unarmed',
  'sneak',
  'steal',
  'lockpick',
  'traps',
  'repair',
  'craft',
  'science',
  'doctor',
  'firstAid',
  'barter',
]

const skill = (
  id: SkillId,
  name: string,
  a: StatId,
  b: StatId,
  bleed: [SkillId | null, SkillId | null],
  baseMult = 1,
): SkillDef => ({ id, name, baseStats: [a, b], baseMult, bleedLinks: bleed, bleedCoef: null })

/** Default links are 'incoming' (sources): previous and next neighbour, endpoints get their single neighbour twice. */

export const DEFAULT_SKILLS: SkillDef[] = [
  skill('smallGuns', 'Мелкие пушки', 'PE', 'AG', ['mediumGuns', 'mediumGuns']),
  skill('mediumGuns', 'Средние пушки', 'PE', 'AG', ['smallGuns', 'bigGuns']),
  skill('bigGuns', 'Большие пушки', 'PE', 'ST', ['mediumGuns', 'throwing']),
  skill('throwing', 'Метательное', 'ST', 'AG', ['bigGuns', 'melee']),
  skill('melee', 'Холодное', 'ST', 'AG', ['throwing', 'unarmed']),
  skill('unarmed', 'Рукопашка', 'ST', 'EN', ['melee', 'sneak']),
  skill('sneak', 'Скрытность', 'AG', 'CH', ['unarmed', 'steal']),
  skill('steal', 'Воровство', 'AG', 'LK', ['sneak', 'lockpick']),
  skill('lockpick', 'Взлом', 'PE', 'AG', ['steal', 'traps']),
  skill('traps', 'Ловушки', 'PE', 'LK', ['lockpick', 'repair']),
  skill('repair', 'Ремонт', 'AG', 'LK', ['traps', 'craft']),
  skill('craft', 'Крафт', 'CH', 'LK', ['repair', 'science']),
  skill('science', 'Наука', 'PE', 'LK', ['craft', 'doctor']),
  skill('doctor', 'Доктор', 'PE', 'LK', ['science', 'firstAid']),
  skill('firstAid', 'Санитар', 'ST', 'CH', ['doctor', 'doctor']),
  skill('barter', 'Торговля', 'CH', 'CH', [null, null], 2),
]

export const DEFAULT_CONFIG: Config = {
  statMin: 1,
  statMax: 10,
  statPool: 40,
  skills: DEFAULT_SKILLS,
  bleedMode: 'incoming',
  bleedCoefDefault: 0.25,
  tagBonus: 20,
  tagCostMultiplier: 0.5,
  tagsNormal: 3,
  tagsSkilled: 1,
  skilledBonusSP: 24,
  spPerIntCoef: 4,
  startingSP: 0,
  maxLevel: 15,
  skillMax: 300,
  baseCost: 1,
  thresholds: [
    { from: 100, cost: 2 },
    { from: 150, cost: 3 },
    { from: 200, cost: 4 },
    { from: 250, cost: 5 },
    { from: 275, cost: 6 },
  ],
}

export const DEFAULT_BUILD: Build = {
  stats: { ST: 5, PE: 5, EN: 5, CH: 5, IN: 5, AG: 5, LK: 5 },
  tags: [],
  skilled: false,
  levels: [{ alloc: {} }],
}
