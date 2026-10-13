import { useMemo } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { computeBuild, computeHistory, round9 } from '../engine/calc'
import { DEFAULT_BUILD, DEFAULT_CONFIG } from '../engine/defaults'
import type {
  Build,
  BuildResult,
  Config,
  Issue,
  LevelSnapshot,
  SkillDef,
  SkillId,
  StatId,
  Threshold,
} from '../engine/types'
import { validateBuild } from '../engine/validate'
import { clearHash, loadFromHash, makeShareUrl, sanitizeBuild, sanitizeConfig } from './share'

export interface AppState {
  config: Config
  build: Build
  configOpen: boolean

  setStat: (id: StatId, value: number) => void
  toggleTag: (skillId: SkillId) => void
  setSkilled: (skilled: boolean) => void
  addSP: (skillId: SkillId, amount: number) => void
  setCurrentAlloc: (skillId: SkillId, value: number) => void
  levelUp: () => void
  levelUpTo: (n: number) => void
  undoLevel: () => void
  resetLeveling: () => void
  resetBuild: () => void
  loadBuild: (build: Build) => void

  updateConfig: (patch: Partial<Config>) => void
  updateSkill: (id: SkillId, patch: Partial<SkillDef>) => void
  setThreshold: (index: number, patch: Partial<Threshold>) => void
  resetConfig: () => void
  loadConfig: (config: Config) => void
  setConfigOpen: (open: boolean) => void
}

const freshBuild = (): Build => structuredClone(DEFAULT_BUILD)
const freshConfig = (): Config => structuredClone(DEFAULT_CONFIG)

/** Returns a build with the current level's alloc for `skillId` set to `value` (>= 0). */
function withCurrentAlloc(build: Build, skillId: SkillId, value: number): Build {
  const levels = build.levels.slice()
  const idx = levels.length - 1
  const alloc = { ...levels[idx].alloc }
  const v = round9(value)
  if (v > 0) alloc[skillId] = v
  else delete alloc[skillId]
  levels[idx] = { alloc }
  return { ...build, levels }
}

function currentAlloc(build: Build, skillId: SkillId): number {
  return build.levels[build.levels.length - 1]?.alloc[skillId] ?? 0
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      config: freshConfig(),
      build: freshBuild(),
      configOpen: false,

      setStat: (id, value) =>
        set((s) => {
          const v = Math.round(Math.min(s.config.statMax, Math.max(s.config.statMin, value)))
          if (!Number.isFinite(v)) return s
          return { build: { ...s.build, stats: { ...s.build.stats, [id]: v } } }
        }),

      toggleTag: (skillId) =>
        set((s) => {
          const tags = s.build.tags.includes(skillId)
            ? s.build.tags.filter((t) => t !== skillId)
            : [...s.build.tags, skillId]
          return { build: { ...s.build, tags } }
        }),

      setSkilled: (skilled) => set((s) => ({ build: { ...s.build, skilled } })),

      addSP: (skillId, amount) => {
        if (!Number.isFinite(amount) || amount === 0) return
        const { build, config } = get()
        const cur = currentAlloc(build, skillId)
        let next: number
        if (amount < 0) {
          next = Math.max(0, cur + amount)
        } else {
          const available = Math.max(0, computeBuild(build, config).spAvailable)
          next = cur + Math.min(amount, available)
        }
        if (round9(next) === round9(cur)) return
        set({ build: withCurrentAlloc(build, skillId, next) })
      },

      setCurrentAlloc: (skillId, value) => {
        if (!Number.isFinite(value)) return
        const { build, config } = get()
        const cur = currentAlloc(build, skillId)
        const available = Math.max(0, computeBuild(build, config).spAvailable)
        const next = Math.min(Math.max(0, value), Math.max(cur, cur + available))
        if (round9(next) === round9(cur)) return
        set({ build: withCurrentAlloc(build, skillId, next) })
      },

      levelUp: () =>
        set((s) =>
          s.build.levels.length >= s.config.maxLevel
            ? s
            : { build: { ...s.build, levels: [...s.build.levels, { alloc: {} }] } },
        ),

      levelUpTo: (n) =>
        set((s) => {
          const target = Math.min(Math.floor(n), s.config.maxLevel)
          const len = s.build.levels.length
          if (!(target > len)) return s
          const added = Array.from({ length: target - len }, () => ({ alloc: {} }))
          return { build: { ...s.build, levels: [...s.build.levels, ...added] } }
        }),

      undoLevel: () =>
        set((s) =>
          s.build.levels.length <= 1
            ? s
            : { build: { ...s.build, levels: s.build.levels.slice(0, -1) } },
        ),

      resetLeveling: () => set((s) => ({ build: { ...s.build, levels: [{ alloc: {} }] } })),

      resetBuild: () => set({ build: freshBuild() }),

      loadBuild: (build) => set({ build: sanitizeBuild(build) }),

      updateConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),

      updateSkill: (id, patch) =>
        set((s) => ({
          config: {
            ...s.config,
            skills: s.config.skills.map((sk) => (sk.id === id ? { ...sk, ...patch, id } : sk)),
          },
        })),

      setThreshold: (index, patch) =>
        set((s) => {
          if (index < 0 || index >= s.config.thresholds.length) return s
          const thresholds = s.config.thresholds.map((t, i) => (i === index ? { ...t, ...patch } : t))
          return { config: { ...s.config, thresholds } }
        }),

      resetConfig: () => set({ config: freshConfig() }),

      loadConfig: (config) => set({ config: sanitizeConfig(config) }),

      setConfigOpen: (configOpen) => set({ configOpen }),
    }),
    {
      name: 'sp-calc-v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ config: s.config, build: s.build }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Pick<AppState, 'config' | 'build'>>
        return {
          ...current,
          config: p.config ? sanitizeConfig(p.config) : current.config,
          build: p.build ? sanitizeBuild(p.build) : current.build,
        }
      },
    },
  ),
)

function applyHash(): void {
  const shared = loadFromHash()
  if (!shared) return
  useAppStore.setState({ build: shared.build, config: shared.config })
  clearHash()
}

if (typeof window !== 'undefined') {
  applyHash()
  window.addEventListener('hashchange', applyHash)
}

/** Full share link for the current build + config. */
export function getShareUrl(): string {
  const { build, config } = useAppStore.getState()
  return makeShareUrl({ build, config })
}

export function useBuildResult(): BuildResult {
  const build = useAppStore((s) => s.build)
  const config = useAppStore((s) => s.config)
  return useMemo(() => computeBuild(build, config), [build, config])
}

export function useIssues(): Issue[] {
  const build = useAppStore((s) => s.build)
  const config = useAppStore((s) => s.config)
  const result = useBuildResult()
  return useMemo(() => validateBuild(build, config, result), [build, config, result])
}

export function useHistory(): LevelSnapshot[] {
  const build = useAppStore((s) => s.build)
  const config = useAppStore((s) => s.config)
  return useMemo(() => computeHistory(build, config), [build, config])
}
