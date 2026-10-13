import { describe, expect, it } from 'vitest'
import { DEFAULT_BUILD, DEFAULT_CONFIG } from '../engine/defaults'
import { decodeState, encodeState, sanitizeConfig } from './share'

describe('share', () => {
  it('round-trip с кириллицей, base64url', () => {
    const config = {
      ...DEFAULT_CONFIG,
      skills: DEFAULT_CONFIG.skills.map((s) => (s.id === 'barter' ? { ...s, name: 'Торговля ✓' } : s)),
    }
    const build = { ...DEFAULT_BUILD, tags: ['unarmed' as const], levels: [{ alloc: {} }, { alloc: { unarmed: 8.5 } }] }
    const str = encodeState({ build, config })
    expect(str).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeState(str)).toEqual({ build, config })
  })

  it('мусор → null', () => {
    expect(decodeState('%%%')).toBeNull()
    expect(decodeState('aGVsbG8')).toBeNull()
  })

  it('новые поля: bleedMode/bleedLinks сохраняются, пропуски — из умолчаний', () => {
    const config = {
      ...DEFAULT_CONFIG,
      bleedMode: 'outgoing' as const,
      skills: DEFAULT_CONFIG.skills.map((s) =>
        s.id === 'barter' ? { ...s, bleedLinks: ['craft', 'craft'] as ['craft', 'craft'] } : s,
      ),
    }
    expect(sanitizeConfig(JSON.parse(JSON.stringify(config)))).toEqual(config)
    expect(sanitizeConfig({ maxLevel: 20 })).toEqual({ ...DEFAULT_CONFIG, maxLevel: 20 })
    expect(sanitizeConfig({ bleedMode: 'weird' }).bleedMode).toBe('incoming')
  })

  it('старый формат (bleedTargets без bleedMode) → исходящий режим с теми же связями', () => {
    const legacy = {
      maxLevel: 99,
      skills: [
        { id: 'smallGuns', bleedTargets: ['mediumGuns', null], bleedCoef: null },
        { id: 'firstAid', bleedTargets: ['doctor', null], bleedCoef: 0.3 },
      ],
    }
    const c = sanitizeConfig(legacy)
    expect(c.bleedMode).toBe('outgoing')
    expect(c.maxLevel).toBe(99)
    expect(c.skills.find((s) => s.id === 'smallGuns')?.bleedLinks).toEqual(['mediumGuns', null])
    expect(c.skills.find((s) => s.id === 'firstAid')).toMatchObject({ bleedLinks: ['doctor', null], bleedCoef: 0.3 })
  })

  it('миграция tagCostMultiplier → tagPointsMultiplier = 1/x', () => {
    expect(sanitizeConfig({ tagCostMultiplier: 0.5 }).tagPointsMultiplier).toBe(2)
    expect(sanitizeConfig({ tagCostMultiplier: 0.25 }).tagPointsMultiplier).toBe(4)
    expect(sanitizeConfig({ tagCostMultiplier: 0 }).tagPointsMultiplier).toBe(2)
    expect(sanitizeConfig({ tagCostMultiplier: 0.5, tagPointsMultiplier: 3 }).tagPointsMultiplier).toBe(3)
    expect('tagCostMultiplier' in sanitizeConfig({ tagCostMultiplier: 0.5 })).toBe(false)
  })
})
