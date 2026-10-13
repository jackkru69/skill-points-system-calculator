import { beforeEach, describe, expect, it } from 'vitest'
import { computeBuild } from '../engine/calc'
import { DEFAULT_BUILD, DEFAULT_CONFIG } from '../engine/defaults'
import type { Build } from '../engine/types'
import { useAppStore } from './useAppStore'

const TZ_BUILD: Build = {
  ...DEFAULT_BUILD,
  stats: { ST: 10, PE: 5, EN: 10, CH: 2, IN: 2, AG: 10, LK: 1 },
  levels: [{ alloc: {} }, { alloc: {} }],
}

const state = () => useAppStore.getState()
const result = () => computeBuild(state().build, state().config)

describe('addPoints', () => {
  beforeEach(() => {
    useAppStore.setState({ config: structuredClone(DEFAULT_CONFIG), build: structuredClone(TZ_BUILD) })
  })

  it('тэг: +1 пункт → значение +1, доступно −0.5 СП', () => {
    state().toggleTag('sneak')
    const before = result()
    state().addPoints('sneak', 1)
    const after = result()
    expect(after.skills.sneak.value).toBe(before.skills.sneak.value + 1)
    expect(after.spAvailable).toBe(before.spAvailable - 0.5)
  })

  it('без тэга +1 пункт стоит 1 СП; +10 → +10 пунктов', () => {
    state().addPoints('sneak', 1)
    expect(result().skills.sneak.value).toBe(21)
    expect(result().spAvailable).toBe(7)
    state().addPoints('sneak', -1)
    expect(result().skills.sneak.value).toBe(20)
    expect(result().spAvailable).toBe(8)
  })

  it('не хватает на +N → покупает сколько хватает целых пунктов; затем остаток', () => {
    // 8 СП, тэг → до 100 стоит 0.5/пункт: 16 пунктов
    state().toggleTag('sneak')
    state().addPoints('sneak', 50)
    expect(result().skills.sneak.value).toBe(56)
    expect(result().spAvailable).toBe(0)
    // Untagged skill over the 100 threshold costs 2/pt: 8 SP → +4 points, then a 1-SP remainder makes half a point
    useAppStore.setState({ build: structuredClone(TZ_BUILD) })
    state().addPoints('melee', 10)
    expect(result().skills.melee.value).toBe(104)
    expect(result().spAvailable).toBe(0)
    // 1 SP left, next point costs 2 → the remainder goes in as half a point
    useAppStore.setState({ config: { ...DEFAULT_CONFIG, startingSP: 1 } })
    state().addPoints('melee', 1)
    expect(result().skills.melee.value).toBe(104.5)
    expect(result().spAvailable).toBe(0)
  })

  it('−N возвращает только из текущего уровня', () => {
    useAppStore.setState({
      build: { ...TZ_BUILD, levels: [{ alloc: { sneak: 5 } }, { alloc: { sneak: 2 } }] },
    })
    state().addPoints('sneak', -10)
    expect(state().build.levels[1].alloc.sneak).toBeUndefined()
    expect(state().build.levels[0].alloc.sneak).toBe(5)
    expect(result().skills.sneak.value).toBe(25)
  })

  it('само-блид учитывается: +1 пункт поднимает значение ровно на 1', () => {
    useAppStore.setState({
      config: {
        ...DEFAULT_CONFIG,
        skills: DEFAULT_CONFIG.skills.map((s) => (s.id === 'barter' ? { ...s, bleedLinks: ['barter', null] } : s)),
      },
    })
    state().addPoints('barter', 4)
    expect(result().skills.barter.value).toBe(12)
    expect(result().spAvailable).toBe(4.8)
  })
})

describe('resetBuild', () => {
  it('статы по умолчанию — все 5', () => {
    state().resetBuild()
    expect(state().build.stats).toEqual({ ST: 5, PE: 5, EN: 5, CH: 5, IN: 5, AG: 5, LK: 5 })
  })
})
