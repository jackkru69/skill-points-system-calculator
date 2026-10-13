import { describe, expect, it } from 'vitest'
import {
  baseValue,
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
import type { Build, Config, SkillId } from './types'
import { validateBuild } from './validate'

const cfg = DEFAULT_CONFIG

const withAlloc = (alloc: Partial<Record<SkillId, number>>, patch: Partial<Build> = {}): Build => ({
  ...DEFAULT_BUILD,
  levels: [{ alloc }],
  ...patch,
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
      expect(baseValue(s, DEFAULT_BUILD.stats), s.id).toBe(expected[s.id])
    }
  })
})

describe('блид', () => {
  it('10 в мелкие / 25 в средние → 16.25 / 27.5 Total SP', () => {
    const r = computeBuild(withAlloc({ smallGuns: 10, mediumGuns: 25 }), cfg)
    expect(r.skills.smallGuns.totalSP).toBe(16.25)
    expect(r.skills.mediumGuns.totalSP).toBe(27.5)
    expect(r.skills.bigGuns.bleedSP).toBe(6.25)
    expect(r.skills.smallGuns.bleedFrom).toEqual([{ from: 'mediumGuns', amount: 6.25 }])
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

  it('без каскада и двойной блид при одинаковых целях', () => {
    const config: Config = {
      ...cfg,
      skills: cfg.skills.map((s) =>
        s.id === 'barter' ? { ...s, bleedTargets: ['craft', 'craft'], bleedCoef: 0.5 } : s,
      ),
    }
    const r = computeBuild(withAlloc({ barter: 10 }), config)
    expect(r.skills.craft.bleedSP).toBe(10)
    expect(r.skills.craft.bleedFrom).toEqual([{ from: 'barter', amount: 10 }])
    expect(r.skills.repair.bleedSP).toBe(0)
  })

  it('directSP суммирует уровни', () => {
    const b: Build = { ...DEFAULT_BUILD, levels: [{ alloc: { melee: 3 } }, { alloc: { melee: 4.5 } }] }
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
  it('полцены', () => {
    expect(spToValue(100, 10, true, cfg).value).toBe(110)
    // 5 pts × 0.5 = 2.5 SP, then 12.5 SP at 1 per point
    expect(spToValue(95, 15, true, cfg).value).toBe(112.5)
  })

  it('+бонус к старту и полцены в computeBuild', () => {
    const r = computeBuild(withAlloc({ unarmed: 10 }, { tags: ['unarmed'] }), cfg)
    expect(r.skills.unarmed.start).toBe(120)
    expect(r.skills.unarmed.value).toBe(130)
    expect(r.skills.unarmed.costPerPoint).toBe(1)
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
    const b: Build = { ...DEFAULT_BUILD, skilled: true, tags: ['unarmed', 'melee', 'throwing'] }
    const issues = validateBuild(b, cfg)
    expect(issues).toContainEqual({
      level: 'error',
      message: 'Билд не соответствует: с трейтом «Скиллед» можно тэгнуть только 1 навык (выбрано 3)',
    })
  })

  it('меньше тэгов → warning; перерасход СП → error; статы', () => {
    const b: Build = {
      ...DEFAULT_BUILD,
      stats: { ...DEFAULT_BUILD.stats, ST: 11 },
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
    expect(spPerLevel(DEFAULT_BUILD.stats, false, cfg)).toBe(8)
    expect(spPerLevel(DEFAULT_BUILD.stats, true, cfg)).toBe(32)
  })

  it('spEarned: уровень 1 = startingSP, далее + за уровень', () => {
    expect(spEarned(DEFAULT_BUILD, cfg)).toBe(0)
    const b: Build = { ...DEFAULT_BUILD, levels: [{ alloc: {} }, { alloc: {} }, { alloc: {} }] }
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
      ...DEFAULT_BUILD,
      levels: [{ alloc: {} }, { alloc: { unarmed: 8 } }, { alloc: { unarmed: 8 } }],
    }
    const h = computeHistory(b, cfg)
    expect(h.map((s) => s.values.unarmed)).toEqual([100, 104, 108])
    expect(h.map((s) => s.spAvailable)).toEqual([0, 0, 0])
  })
})
