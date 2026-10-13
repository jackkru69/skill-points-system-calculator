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

describe('addSteps', () => {
  beforeEach(() => {
    useAppStore.setState({ config: structuredClone(DEFAULT_CONFIG), build: structuredClone(TZ_BUILD) })
  })

  it('тэг на 45: +1 шаг → 47, доступно −1 СП', () => {
    // sneak base AG5×CH5 = 25; тэг +20 → 45
    useAppStore.setState({ build: { ...TZ_BUILD, stats: { ...TZ_BUILD.stats, AG: 5, CH: 5 } } })
    state().toggleTag('sneak')
    const before = result()
    expect(before.skills.sneak.value).toBe(45)
    state().addSteps('sneak', 1)
    const after = result()
    expect(after.skills.sneak.value).toBe(47)
    expect(after.spAvailable).toBe(before.spAvailable - 1)
  })

  it('без тэга на 120: +1 шаг → +1, доступно −2 СП', () => {
    useAppStore.setState({
      build: { ...TZ_BUILD, levels: [{ alloc: { melee: 40 } }, { alloc: {} }] },
      config: { ...DEFAULT_CONFIG, startingSP: 50 },
    })
    const before = result()
    expect(before.skills.melee.value).toBe(120)
    state().addSteps('melee', 1)
    const after = result()
    expect(after.skills.melee.value).toBe(121)
    expect(after.spAvailable).toBe(before.spAvailable - 2)
  })

  it('−1 возвращает ровно цену последнего шага', () => {
    state().toggleTag('melee')
    // melee 100 + 20 = 120 → шаг 2 СП, +2
    state().addSteps('melee', 3)
    expect(result().skills.melee.value).toBe(126)
    expect(result().spAvailable).toBe(2)
    state().addSteps('melee', -1)
    expect(result().skills.melee.value).toBe(124)
    expect(result().spAvailable).toBe(4)
    state().addSteps('melee', -10)
    expect(result().skills.melee.value).toBe(120)
    expect(result().spAvailable).toBe(8)
    expect(state().build.levels[1].alloc.melee).toBeUndefined()
  })

  it('+N ограничено доступными СП; шаг, на который не хватает, не делается', () => {
    state().addSteps('sneak', 50)
    expect(state().build.levels[1].alloc.sneak).toBe(8)
    expect(result().spAvailable).toBe(0)
    // melee at 100: step = 2 SP; 9 SP free → 4 steps, 1 SP left
    useAppStore.setState({ build: structuredClone(TZ_BUILD), config: { ...DEFAULT_CONFIG, startingSP: 1 } })
    state().addSteps('melee', 5)
    expect(state().build.levels[1].alloc.melee).toBe(8)
    expect(result().spAvailable).toBe(1)
    state().addSteps('melee', 1)
    expect(state().build.levels[1].alloc.melee).toBe(8)
  })

  it('−N возвращает только из текущего уровня', () => {
    useAppStore.setState({
      build: { ...TZ_BUILD, levels: [{ alloc: { sneak: 5 } }, { alloc: { sneak: 2 } }] },
    })
    state().addSteps('sneak', -10)
    expect(state().build.levels[1].alloc.sneak).toBeUndefined()
    expect(state().build.levels[0].alloc.sneak).toBe(5)
    expect(result().skills.sneak.value).toBe(25)
  })

  it('частичный прогресс от блида: +1 докупает остаток шага (дробные СП)', () => {
    // 2 СП в Средние → Большие получают 0.5 bleed → 50.5
    useAppStore.setState({ build: { ...TZ_BUILD, levels: [{ alloc: { mediumGuns: 2 } }, { alloc: {} }] } })
    expect(result().skills.bigGuns.value).toBe(50.5)
    expect(result().skills.bigGuns.spToNextStep).toBe(0.5)
    state().addSteps('bigGuns', 1)
    expect(state().build.levels[1].alloc.bigGuns).toBe(0.5)
    expect(result().skills.bigGuns.value).toBe(51)
    state().addSteps('bigGuns', 1)
    expect(result().skills.bigGuns.value).toBe(52)
    state().addSteps('bigGuns', -1)
    expect(state().build.levels[1].alloc.bigGuns).toBe(0.5)
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
