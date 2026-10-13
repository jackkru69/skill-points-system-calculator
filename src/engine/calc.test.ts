import { describe, expect, it } from 'vitest'
import {
  baseValue,
  bleedGraph,
  computeBuild,
  computeHistory,
  costAt,
  directSP,
  spEarned,
  spPerLevel,
  spToNextPoint,
  spToValue,
  statUsage,
} from './calc'
import { DEFAULT_BUILD, DEFAULT_CONFIG } from './defaults'
import type { Build, Config, SkillDef, SkillId, Stats } from './types'
import { validateBuild } from './validate'

const cfg = DEFAULT_CONFIG

/** Stats of the control example from the ТЗ / client spreadsheet. */
const TZ_STATS: Stats = { ST: 10, PE: 5, EN: 10, CH: 2, IN: 2, AG: 10, LK: 1 }
const TZ_BUILD: Build = { ...DEFAULT_BUILD, stats: TZ_STATS }

const withAlloc = (alloc: Partial<Record<SkillId, number>>, patch: Partial<Build> = {}): Build => ({
  ...TZ_BUILD,
  levels: [{ alloc }],
  ...patch,
})

const withSkills = (config: Config, patch: Partial<Record<SkillId, Partial<SkillDef>>>): Config => ({
  ...config,
  skills: config.skills.map((s) => (patch[s.id] ? { ...s, ...patch[s.id] } : s)),
})

/** Links/semantics of the pre-v2 default config (outgoing, coef of the source). */
const LEGACY_OUTGOING: Config = withSkills(
  { ...cfg, bleedMode: 'outgoing' },
  { smallGuns: { bleedLinks: ['mediumGuns', null] }, firstAid: { bleedLinks: ['doctor', null] } },
)

describe('умолчания', () => {
  it('все статы = 5 (5 свободных очков при пуле 40), макс. уровень 15, режим блида — входящий', () => {
    expect(DEFAULT_BUILD.stats).toEqual({ ST: 5, PE: 5, EN: 5, CH: 5, IN: 5, AG: 5, LK: 5 })
    expect(cfg.statPool - Object.values(DEFAULT_BUILD.stats).reduce((a, b) => a + b, 0)).toBe(5)
    expect(cfg.maxLevel).toBe(15)
    expect(cfg.bleedMode).toBe('incoming')
  })

  it('связи по умолчанию: соседи, концы — один сосед дважды, Торговля без блида', () => {
    const links = Object.fromEntries(cfg.skills.map((s) => [s.id, s.bleedLinks]))
    expect(links.smallGuns).toEqual(['mediumGuns', 'mediumGuns'])
    expect(links.mediumGuns).toEqual(['smallGuns', 'bigGuns'])
    expect(links.doctor).toEqual(['science', 'firstAid'])
    expect(links.firstAid).toEqual(['doctor', 'doctor'])
    expect(links.barter).toEqual([null, null])
  })
})

describe('базы (контрольный пример ТЗ)', () => {
  it('совпадают с ТЗ', () => {
    const expected: Record<SkillId, number> = {
      smallGuns: 50,
      mediumGuns: 50,
      bigGuns: 50,
      throwing: 100,
      melee: 100,
      unarmed: 100,
      sneak: 20,
      steal: 10,
      lockpick: 50,
      traps: 5,
      repair: 10,
      craft: 2,
      science: 5,
      doctor: 5,
      firstAid: 20,
      barter: 8,
    }
    for (const s of cfg.skills) {
      expect(baseValue(s, TZ_STATS), s.id).toBe(expected[s.id])
    }
  })
})

describe('блид — таблица клиента (входящий режим)', () => {
  it('Средние X → Мелкие получают 0.5X', () => {
    const r = computeBuild(withAlloc({ mediumGuns: 40 }), cfg)
    expect(r.skills.smallGuns.bleedSP).toBe(20)
    expect(r.skills.smallGuns.totalSP).toBe(20)
    expect(r.skills.smallGuns.bleedFrom).toEqual([{ from: 'mediumGuns', amount: 20 }])
    expect(r.skills.bigGuns.bleedSP).toBe(10)
  })

  it('Средние = own + 0.25·Мелкие + 0.25·Большие', () => {
    const r = computeBuild(withAlloc({ smallGuns: 12, mediumGuns: 7, bigGuns: 20 }), cfg)
    expect(r.skills.mediumGuns.totalSP).toBe(7 + 3 + 5)
    expect(r.skills.mediumGuns.bleedFrom).toEqual([
      { from: 'smallGuns', amount: 3 },
      { from: 'bigGuns', amount: 5 },
    ])
    expect(r.skills.smallGuns.totalSP).toBe(12 + 3.5)
  })

  it('Доктор D → Санитар 0.5D; Торговля не получает ничего', () => {
    const all = Object.fromEntries(cfg.skills.map((s) => [s.id, 10])) as Record<SkillId, number>
    const r = computeBuild(withAlloc({ ...all, doctor: 30 }), cfg)
    expect(r.skills.firstAid.totalSP).toBe(10 + 15)
    expect(r.skills.barter.bleedSP).toBe(0)
    expect(r.skills.barter.totalSP).toBe(10)
    expect(r.skills.barter.bleedFrom).toEqual([])
    // Торговля никуда не блидит
    expect(r.skills.craft.bleedFrom.map((b) => b.from)).toEqual(['repair', 'science'])
  })

  it('пример ТЗ: 10 в большие / 25 в средние → 16.25 / 27.5', () => {
    const r = computeBuild(withAlloc({ bigGuns: 10, mediumGuns: 25 }), cfg)
    expect(r.skills.bigGuns.totalSP).toBe(16.25)
    expect(r.skills.mediumGuns.totalSP).toBe(27.5)
  })

  it('10 в мелкие / 25 в средние: средние 27.5, мелкие 10 + 0.5·25 = 22.5', () => {
    const r = computeBuild(withAlloc({ smallGuns: 10, mediumGuns: 25 }), cfg)
    expect(r.skills.mediumGuns.totalSP).toBe(27.5)
    expect(r.skills.smallGuns.totalSP).toBe(22.5)
    expect(r.skills.bigGuns.bleedSP).toBe(6.25)
  })

  it('96 в рукопашку → холодное 24, скрытность 24', () => {
    const r = computeBuild(withAlloc({ unarmed: 96 }), cfg)
    expect(r.skills.melee.bleedSP).toBe(24)
    expect(r.skills.sneak.bleedSP).toBe(24)
    expect(r.skills.unarmed.value).toBe(148)
    expect(r.skills.melee.value).toBe(112)
    expect(r.skills.sneak.value).toBe(44)
    expect(r.spSpent).toBe(96)
  })

  it('коэф. принадлежит получателю', () => {
    const config = withSkills(cfg, { melee: { bleedCoef: 0.5 } })
    const r = computeBuild(withAlloc({ unarmed: 96 }), config)
    expect(r.skills.melee.bleedSP).toBe(48)
    expect(r.skills.sneak.bleedSP).toBe(24)
  })

  it('без каскада и двойной блид при одинаковых источниках', () => {
    const config = withSkills(cfg, { craft: { bleedLinks: ['barter', 'barter'], bleedCoef: 0.5 } })
    const r = computeBuild(withAlloc({ barter: 10 }), config)
    expect(r.skills.craft.bleedSP).toBe(10)
    expect(r.skills.craft.bleedFrom).toEqual([{ from: 'barter', amount: 10 }])
    expect(r.skills.repair.bleedSP).toBe(0)
    expect(r.skills.science.bleedSP).toBe(0)
  })
})

describe('блид — исходящий режим', () => {
  it('10 в мелкие / 25 в средние → 16.25 / 27.5 Total SP (связи и семантика ТЗ v1)', () => {
    const r = computeBuild(withAlloc({ smallGuns: 10, mediumGuns: 25 }), LEGACY_OUTGOING)
    expect(r.skills.smallGuns.totalSP).toBe(16.25)
    expect(r.skills.mediumGuns.totalSP).toBe(27.5)
    expect(r.skills.bigGuns.bleedSP).toBe(6.25)
    expect(r.skills.smallGuns.bleedFrom).toEqual([{ from: 'mediumGuns', amount: 6.25 }])
  })

  it('96 в рукопашку → 24/24; коэф. принадлежит источнику', () => {
    const r = computeBuild(withAlloc({ unarmed: 96 }), LEGACY_OUTGOING)
    expect(r.skills.melee.bleedSP).toBe(24)
    expect(r.skills.sneak.bleedSP).toBe(24)
    const config = withSkills(LEGACY_OUTGOING, { unarmed: { bleedCoef: 0.5 } })
    expect(computeBuild(withAlloc({ unarmed: 96 }), config).skills.melee.bleedSP).toBe(48)
  })

  it('двойной блид при одинаковых целях', () => {
    const config = withSkills(LEGACY_OUTGOING, { barter: { bleedLinks: ['craft', 'craft'], bleedCoef: 0.5 } })
    const r = computeBuild(withAlloc({ barter: 10 }), config)
    expect(r.skills.craft.bleedSP).toBe(10)
    expect(r.skills.craft.bleedFrom).toEqual([{ from: 'barter', amount: 10 }])
  })
})

describe('bleedGraph', () => {
  it('входящий режим: источники/цели и сумма коэф. для дублей', () => {
    const g = bleedGraph(cfg)
    expect(g.smallGuns.incoming).toEqual([{ skill: 'mediumGuns', coef: 0.5 }])
    expect(g.smallGuns.outgoing).toEqual([{ skill: 'mediumGuns', coef: 0.25 }])
    expect(g.mediumGuns.outgoing).toEqual([
      { skill: 'smallGuns', coef: 0.5 },
      { skill: 'bigGuns', coef: 0.25 },
    ])
    expect(g.doctor.outgoing).toEqual([
      { skill: 'science', coef: 0.25 },
      { skill: 'firstAid', coef: 0.5 },
    ])
    expect(g.barter).toEqual({ incoming: [], outgoing: [] })
  })

  it('исходящий режим: связи = цели', () => {
    const g = bleedGraph(LEGACY_OUTGOING)
    expect(g.smallGuns.outgoing).toEqual([{ skill: 'mediumGuns', coef: 0.25 }])
    expect(g.smallGuns.incoming).toEqual([{ skill: 'mediumGuns', coef: 0.25 }])
    expect(g.firstAid.incoming).toEqual([{ skill: 'doctor', coef: 0.25 }])
  })
})

describe('прямые СП', () => {
  it('directSP суммирует уровни', () => {
    const b: Build = { ...TZ_BUILD, levels: [{ alloc: { melee: 3 } }, { alloc: { melee: 4.5 } }] }
    expect(directSP(b).melee).toBe(7.5)
    expect(computeBuild(b, cfg).skills.melee.currentLevelSP).toBe(4.5)
  })
})

describe('пороги', () => {
  it('costAt', () => {
    expect(costAt(0, cfg)).toBe(1)
    expect(costAt(99.99, cfg)).toBe(1)
    expect(costAt(100, cfg)).toBe(2)
    expect(costAt(274, cfg)).toBe(5)
    expect(costAt(300, cfg)).toBe(6)
  })

  it('непрерывно через границу: 95 + 15 СП → 105', () => {
    expect(spToValue(95, 15, false, cfg)).toEqual({ value: 105, overflowSP: 0 })
  })

  it('дробные значения', () => {
    expect(spToValue(100, 1, false, cfg).value).toBe(100.5)
    expect(spToValue(0, 200, false, cfg).value).toBe(150)
  })

  it('неотсортированные пороги сортируются', () => {
    const config: Config = { ...cfg, thresholds: [...cfg.thresholds].reverse() }
    expect(spToValue(95, 15, false, config).value).toBe(105)
    expect(costAt(160, config)).toBe(3)
  })

  it('spToNextPoint', () => {
    expect(spToNextPoint(95, 0, false, cfg)).toBe(1)
    expect(spToNextPoint(100, 0, false, cfg)).toBe(2)
    expect(spToNextPoint(100, 1, false, cfg)).toBe(1)
    expect(spToNextPoint(99.5, 0, false, cfg)).toBe(0.5)
    expect(spToNextPoint(100, 0, true, cfg)).toBe(1)
    expect(spToNextPoint(300, 0, false, cfg)).toBe(Infinity)
  })
})

describe('тэг', () => {
  it('×2 пункта за СП', () => {
    expect(spToValue(100, 10, true, cfg).value).toBe(110)
    // 5 pts × 0.5 = 2.5 SP, then 12.5 SP at 1 per point
    expect(spToValue(95, 15, true, cfg).value).toBe(112.5)
  })

  it('+бонус к старту и ×2 в computeBuild', () => {
    const r = computeBuild(withAlloc({ unarmed: 10 }, { tags: ['unarmed'] }), cfg)
    expect(r.skills.unarmed.start).toBe(120)
    expect(r.skills.unarmed.value).toBe(130)
    expect(r.skills.unarmed.costPerPoint).toBe(1)
  })

  it('тэг ×2 пункта за СП: 1 СП до 100 → +2, на пороге цены 2 → +1', () => {
    const r = computeBuild(withAlloc({}, { tags: ['sneak'] }), cfg)
    const s = r.skills.sneak
    expect(s.start).toBe(40)
    expect(s.costPerPoint).toBe(0.5)
    expect(computeBuild(withAlloc({ sneak: 1 }, { tags: ['sneak'] }), cfg).skills.sneak.value).toBe(42)
    expect(spToValue(100, 1, true, cfg).value).toBe(101)
    expect(spToValue(100, 1, false, cfg).value).toBe(100.5)
    expect(spToValue(150, 3, true, cfg).value).toBe(152)
  })

  it('tagPointsMultiplier настраивается', () => {
    const config: Config = { ...cfg, tagPointsMultiplier: 3 }
    expect(spToValue(40, 1, true, config).value).toBe(43)
    expect(spToValue(40, 1, true, { ...cfg, tagPointsMultiplier: 0 }).value).toBe(41)
  })

  it('тэг источника не влияет на блид', () => {
    const r = computeBuild(withAlloc({ unarmed: 96 }, { tags: ['unarmed'] }), cfg)
    expect(r.skills.melee.bleedSP).toBe(24)
  })
})

describe('кап', () => {
  it('ограничение и overflowSP', () => {
    // 100*1 + 50*2 + 50*3 + 50*4 + 25*5 + 25*6 = 825
    expect(spToValue(0, 825, false, cfg)).toEqual({ value: 300, overflowSP: 0 })
    expect(spToValue(0, 900, false, cfg)).toEqual({ value: 300, overflowSP: 75 })
  })

  it('warning при переполнении', () => {
    const b = withAlloc({ throwing: 2000 })
    const issues = validateBuild(b, cfg)
    expect(issues.some((i) => i.level === 'warning' && i.message.includes('сверх капа'))).toBe(true)
  })
})

describe('валидация', () => {
  it('Скиллед + 3 тэга → error', () => {
    const b: Build = { ...TZ_BUILD, skilled: true, tags: ['unarmed', 'melee', 'throwing'] }
    const issues = validateBuild(b, cfg)
    expect(issues).toContainEqual({
      level: 'error',
      message: 'Билд не соответствует: с трейтом «Скиллед» можно тэгнуть только 1 навык (выбрано 3)',
    })
  })

  it('меньше тэгов → warning; перерасход СП → error; статы', () => {
    const b: Build = {
      ...TZ_BUILD,
      stats: { ...TZ_STATS, ST: 11 },
      levels: [{ alloc: { melee: 5 } }],
    }
    const issues = validateBuild(b, cfg)
    const errors = issues.filter((i) => i.level === 'error').map((i) => i.message)
    expect(errors.some((m) => m.includes('Потрачено СП больше'))).toBe(true)
    expect(errors.some((m) => m.includes('превышает пул'))).toBe(true)
    expect(errors.some((m) => m.includes('вне диапазона'))).toBe(true)
    expect(issues.some((i) => i.level === 'warning' && i.message.includes('тэгов'))).toBe(true)
  })
})

describe('СП за уровень', () => {
  it('4*IN (+24)', () => {
    expect(spPerLevel(TZ_STATS, false, cfg)).toBe(8)
    expect(spPerLevel(TZ_STATS, true, cfg)).toBe(32)
    expect(spPerLevel(DEFAULT_BUILD.stats, false, cfg)).toBe(20)
  })

  it('spEarned: уровень 1 = startingSP, далее + за уровень', () => {
    expect(spEarned(TZ_BUILD, cfg)).toBe(0)
    const b: Build = { ...TZ_BUILD, levels: [{ alloc: {} }, { alloc: {} }, { alloc: {} }] }
    expect(spEarned(b, cfg)).toBe(16)
    const r = computeBuild({ ...b, skilled: true }, cfg)
    expect(r.spEarned).toBe(64)
    expect(r.spAvailable).toBe(64)
    expect(r.level).toBe(3)
  })
})

describe('прочее', () => {
  it('statUsage', () => {
    expect(statUsage(cfg)).toEqual({ ST: 5, PE: 7, EN: 1, CH: 4, IN: 0, AG: 8, LK: 6 })
  })

  it('computeHistory — кумулятивно', () => {
    const b: Build = {
      ...TZ_BUILD,
      levels: [{ alloc: {} }, { alloc: { unarmed: 8 } }, { alloc: { unarmed: 8 } }],
    }
    const h = computeHistory(b, cfg)
    expect(h.map((s) => s.values.unarmed)).toEqual([100, 104, 108])
    expect(h.map((s) => s.spAvailable)).toEqual([0, 0, 0])
  })
})
