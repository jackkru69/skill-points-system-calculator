import { describe, expect, it } from 'vitest'
import { DEFAULT_BUILD, DEFAULT_CONFIG } from '../engine/defaults'
import { decodeState, encodeState } from './share'

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
})
