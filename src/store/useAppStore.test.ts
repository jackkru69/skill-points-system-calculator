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

describe('addSP', () => {
  beforeEach(() => {
    useAppStore.setState({ config: structuredClone(DEFAULT_CONFIG), build: structuredClone(TZ_BUILD) })
  })

  it('тэг: +1 СП → значение +2, доступно −1 СП', () => {
    state().toggleTag('sneak')
    const before = result()
    state().addSP('sneak', 1)
    const after = result()
    expect(after.skills.sneak.value).toBe(before.skills.sneak.value + 2)
    expect(after.spAvailable).toBe(before.spAvailable - 1)
  })

  it('без тэга +1 СП → +1; −1 возвращает', () => {
    state().addSP('sneak', 1)
    expect(result().skills.sneak.value).toBe(21)
    expect(result().spAvailable).toBe(7)
    state().addSP('sneak', -1)
    expect(result().skills.sneak.value).toBe(20)
    expect(result().spAvailable).toBe(8)
  })

  it('+N ограничено целыми доступными СП; дробные суммы отбрасываются', () => {
    state().addSP('sneak', 50)
    expect(state().build.levels[1].alloc.sneak).toBe(8)
    expect(result().spAvailable).toBe(0)
    useAppStore.setState({ build: structuredClone(TZ_BUILD), config: { ...DEFAULT_CONFIG, startingSP: 0.5 } })
    state().addSP('sneak', 10)
    expect(state().build.levels[1].alloc.sneak).toBe(8)
    state().addSP('sneak', 1)
    expect(state().build.levels[1].alloc.sneak).toBe(8)
    state().addSP('melee', 0.7)
    expect(state().build.levels[1].alloc.melee).toBeUndefined()
  })

  it('тэг на пороге цены 2: 1 СП → +1', () => {
    state().toggleTag('melee')
    // melee start = 100 + 20 = 120 → cost 2, tag ×2
    state().addSP('melee', 1)
    expect(result().skills.melee.value).toBe(121)
  })

  it('−N возвращает только из текущего уровня', () => {
    useAppStore.setState({
      build: { ...TZ_BUILD, levels: [{ alloc: { sneak: 5 } }, { alloc: { sneak: 2 } }] },
    })
    state().addSP('sneak', -10)
    expect(state().build.levels[1].alloc.sneak).toBeUndefined()
    expect(state().build.levels[0].alloc.sneak).toBe(5)
    expect(result().skills.sneak.value).toBe(25)
  })

  it('setCurrentAlloc округляет до целого', () => {
    state().setCurrentAlloc('sneak', 2.6)
    expect(state().build.levels[1].alloc.sneak).toBe(3)
  })
})

describe('resetBuild', () => {
  it('статы по умолчанию — все 5', () => {
    state().resetBuild()
    expect(state().build.stats).toEqual({ ST: 5, PE: 5, EN: 5, CH: 5, IN: 5, AG: 5, LK: 5 })
  })
})
