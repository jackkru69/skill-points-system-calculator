import { memo, useMemo, useState, type MouseEvent } from 'react'
import {
  STATS,
  spToNextPoint,
  spToValue,
  type Config,
  type SkillDef,
  type SkillId,
  type SkillResult,
  type StatId,
} from '../../engine'
import { useAppStore, useBuildResult } from '../../store'
import { Button, Tooltip, cn, displayValue, fmt, roundUp2 } from '../ui'

type Relation = 'self' | 'target' | 'source' | 'both' | null

const EPS = 1e-9
const STAT_SHORT = Object.fromEntries(STATS.map((s) => [s.id, s.short])) as Record<StatId, string>

function formula(skill: SkillDef): string {
  const parts = [STAT_SHORT[skill.baseStats[0]], STAT_SHORT[skill.baseStats[1]]]
  if (skill.baseMult !== 1) parts.push(fmt(skill.baseMult))
  return parts.join('×')
}

function spForPoints(r: SkillResult, points: number, available: number, config: Config): number {
  const current = displayValue(r.value)
  let acc = 0
  for (let i = 0; i < points; i++) {
    const need = spToNextPoint(r.start, r.totalSP + acc, r.tagged, config)
    if (!Number.isFinite(need)) break
    let next = roundUp2(acc + need)
    const stepTarget = Math.min(current + i + 1, config.skillMax)
    for (let guard = 0; guard < 5; guard++) {
      const { value } = spToValue(r.start, r.totalSP + next, r.tagged, config)
      if (displayValue(value) >= stepTarget) break
      next = Math.round((next + 0.01) * 100) / 100
    }
    if (next > available + EPS) break
    acc = next
  }
  return acc
}

export function SkillsTable() {
  const config = useAppStore((s) => s.config)
  const result = useBuildResult()
  const [hovered, setHovered] = useState<SkillId | null>(null)

  const names = useMemo(
    () => Object.fromEntries(config.skills.map((s) => [s.id, s.name])) as Record<SkillId, string>,
    [config.skills],
  )

  const relations = useMemo(() => {
    const map = new Map<SkillId, Relation>()
    if (!hovered) return map
    const src = config.skills.find((s) => s.id === hovered)
    const targets = new Set(src?.bleedTargets.filter((t): t is SkillId => t !== null))
    for (const s of config.skills) {
      if (s.id === hovered) {
        map.set(s.id, 'self')
        continue
      }
      const isTarget = targets.has(s.id)
      const isSource = s.bleedTargets.includes(hovered)
      map.set(s.id, isTarget && isSource ? 'both' : isTarget ? 'target' : isSource ? 'source' : null)
    }
    return map
  }, [hovered, config.skills])

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
        <h2 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">Навыки</h2>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-sky-400" /> блидит в
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-emerald-400" /> получает от
          </span>
          <span>Shift — ×5</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-sm tabular-nums">
          <thead className="sticky top-0 z-10 bg-zinc-900 text-[11px] tracking-wide text-zinc-500 uppercase">
            <tr className="border-b border-zinc-800">
              <th className="w-8 px-2 py-1.5 text-center font-medium" title="Тэг">★</th>
              <th className="px-2 py-1.5 text-left font-medium">Навык</th>
              <th className="px-2 py-1.5 text-left font-medium">Формула</th>
              <th className="px-2 py-1.5 text-right font-medium">База</th>
              <th className="px-2 py-1.5 text-right font-medium" title="Вложено напрямую (в скобках — на текущем уровне)">
                Direct SP
              </th>
              <th className="px-2 py-1.5 text-right font-medium">Bleed SP</th>
              <th className="px-2 py-1.5 text-right font-medium">Total SP</th>
              <th className="w-44 px-2 py-1.5 text-left font-medium">Значение</th>
              <th className="px-2 py-1.5 text-right font-medium" title="СП за следующий пункт">
                СП/пункт
              </th>
              <th className="px-2 py-1.5 text-center font-medium">Действия</th>
            </tr>
          </thead>
          <tbody onMouseLeave={() => setHovered(null)}>
            {config.skills.map((skill) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                r={result.skills[skill.id]}
                names={names}
                config={config}
                spAvailable={result.spAvailable}
                relation={relations.get(skill.id) ?? null}
                onHover={setHovered}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface SkillRowProps {
  skill: SkillDef
  r: SkillResult
  names: Record<SkillId, string>
  config: Config
  spAvailable: number
  relation: Relation
  onHover: (id: SkillId) => void
}

const SkillRow = memo(function SkillRow({
  skill,
  r,
  names,
  config,
  spAvailable,
  relation,
  onHover,
}: SkillRowProps) {
  const toggleTag = useAppStore((s) => s.toggleTag)
  const addSP = useAppStore((s) => s.addSP)

  if (!r) return null

  const coef = skill.bleedCoef ?? config.bleedCoefDefault
  const targets = skill.bleedTargets.filter((t): t is SkillId => t !== null)
  const atCap = r.value >= config.skillMax - EPS
  const canAdd = spAvailable > EPS
  const canRemove = r.currentLevelSP > EPS
  const shown = displayValue(r.value)
  const nextNeed = r.spToNextPoint
  const canPercent = Number.isFinite(nextNeed) && nextNeed <= spAvailable + EPS

  const mult = (e: MouseEvent) => (e.shiftKey ? 5 : 1)
  const add = (amount: number) => (e: MouseEvent) => addSP(skill.id, amount * mult(e))
  const addPercent = (e: MouseEvent) => {
    const sp = spForPoints(r, mult(e), spAvailable, config)
    if (sp > 0) addSP(skill.id, sp)
  }

  return (
    <tr
      onMouseEnter={() => onHover(skill.id)}
      className={cn(
        'border-b border-zinc-800/70 transition-colors',
        r.tagged && 'bg-amber-500/[0.06]',
        relation === 'self' && 'bg-zinc-800/70',
        relation === 'target' && 'bg-sky-500/15',
        relation === 'source' && 'bg-emerald-500/15',
        relation === 'both' && 'bg-gradient-to-r from-sky-500/15 to-emerald-500/15',
      )}
    >
      <td className="relative px-2 py-1 text-center">
        <span
          className={cn(
            'absolute inset-y-0 left-0 w-0.5',
            r.tagged && 'bg-amber-500',
            relation === 'target' && 'bg-sky-400',
            relation === 'source' && 'bg-emerald-400',
            relation === 'both' && 'bg-gradient-to-b from-sky-400 to-emerald-400',
          )}
        />
        <button
          type="button"
          onClick={() => toggleTag(skill.id)}
          title={r.tagged ? 'Снять тэг' : 'Тэгнуть'}
          className={cn(
            'text-base leading-none transition-colors',
            r.tagged ? 'text-amber-400 hover:text-amber-300' : 'text-zinc-700 hover:text-amber-500/70',
          )}
        >
          {r.tagged ? '★' : '☆'}
        </button>
      </td>
      <td className="px-2 py-1">
        <Tooltip
          content={
            targets.length ? (
              <span>
                Блидит в: {targets.map((t) => names[t] ?? t).join(', ')}
                <span className="text-zinc-400"> (коэф. {fmt(coef)})</span>
              </span>
            ) : (
              'Никуда не блидит'
            )
          }
        >
          <span className={cn('font-medium whitespace-nowrap', r.tagged ? 'text-amber-200' : 'text-zinc-200')}>
            {skill.name}
          </span>
        </Tooltip>
        {relation && relation !== 'self' && (
          <span
            className={cn(
              'ml-1.5 rounded px-1 text-[10px]',
              relation === 'target' && 'bg-sky-500/20 text-sky-300',
              relation === 'source' && 'bg-emerald-500/20 text-emerald-300',
              relation === 'both' && 'bg-zinc-700 text-zinc-200',
            )}
          >
            {relation === 'target' ? '← блид' : relation === 'source' ? 'блид →' : '⇄'}
          </span>
        )}
      </td>
      <td className="px-2 py-1 text-xs whitespace-nowrap text-zinc-500">{formula(skill)}</td>
      <td className="px-2 py-1 text-right whitespace-nowrap text-zinc-400">
        {fmt(r.base)}
        {r.tagged && <span className="ml-1 text-xs text-amber-400">+{fmt(r.start - r.base)}</span>}
      </td>
      <td className="px-2 py-1 text-right whitespace-nowrap">
        <span className={r.directSP > 0 ? 'text-zinc-200' : 'text-zinc-600'}>{fmt(r.directSP)}</span>
        {r.currentLevelSP > 0 && (
          <span className="ml-1 text-xs text-emerald-400" title="На текущем уровне">
            (+{fmt(r.currentLevelSP)})
          </span>
        )}
      </td>
      <td className="px-2 py-1 text-right whitespace-nowrap">
        {r.bleedSP > 0 ? (
          <Tooltip
            content={
              <div className="space-y-0.5">
                <div className="mb-1 font-medium text-zinc-300">Bleed в «{skill.name}»</div>
                {r.bleedFrom.map((b, i) => (
                  <div key={`${b.from}-${i}`} className="flex justify-between gap-4 tabular-nums">
                    <span className="text-zinc-400">{names[b.from] ?? b.from}</span>
                    <span className="text-emerald-300">+{fmt(b.amount)}</span>
                  </div>
                ))}
                <div className="mt-1 flex justify-between gap-4 border-t border-zinc-700 pt-1 font-medium tabular-nums">
                  <span>Итого</span>
                  <span>{fmt(r.bleedSP)}</span>
                </div>
              </div>
            }
          >
            <span className="cursor-help border-b border-dotted border-emerald-500/50 text-emerald-300">
              {fmt(r.bleedSP)}
            </span>
          </Tooltip>
        ) : (
          <span className="text-zinc-600">0</span>
        )}
      </td>
      <td className="px-2 py-1 text-right whitespace-nowrap">
        <span className={r.totalSP > 0 ? 'font-medium text-zinc-100' : 'text-zinc-600'}>{fmt(r.totalSP)}</span>
        {r.overflowSP > EPS && (
          <span className="ml-1 text-xs text-amber-400" title="СП сверх капа (пропадают)">
            ↑{fmt(r.overflowSP)}
          </span>
        )}
      </td>
      <td className="px-2 py-1">
        <div className="flex items-baseline gap-1" title={`Точно: ${fmt(r.value, 4)}%`}>
          <span
            className={cn(
              'text-lg leading-tight font-semibold',
              atCap ? 'text-emerald-300' : r.tagged ? 'text-amber-200' : 'text-zinc-100',
            )}
          >
            {shown}
          </span>
          <span className="text-xs text-zinc-500">%</span>
        </div>
        <ValueBar r={r} config={config} />
      </td>
      <td className="px-2 py-1 text-right whitespace-nowrap">
        {atCap ? (
          <span className="text-xs text-emerald-400">кап</span>
        ) : (
          <span className={cn(r.costPerPoint > config.baseCost * (r.tagged ? config.tagCostMultiplier : 1) ? 'text-amber-300' : 'text-zinc-300')}>
            {fmt(r.costPerPoint)}
          </span>
        )}
      </td>
      <td className="px-2 py-1">
        <div className="flex items-center justify-center gap-0.5">
          <Button size="xs" variant="danger" className="w-8" disabled={!canRemove} onClick={add(-1)} title="−1 СП (Shift: −5)">
            −1
          </Button>
          <Button size="xs" variant="danger" className="w-9" disabled={!canRemove} onClick={add(-10)} title="−10 СП (Shift: −50)">
            −10
          </Button>
          <span className="mx-1 h-4 w-px bg-zinc-700" />
          <Button size="xs" variant="success" className="w-8" disabled={!canAdd} onClick={add(1)} title="+1 СП (Shift: +5)">
            +1
          </Button>
          <Button size="xs" variant="success" className="w-9" disabled={!canAdd} onClick={add(10)} title="+10 СП (Shift: +50)">
            +10
          </Button>
          <span className="mx-1 h-4 w-px bg-zinc-700" />
          <Button
            size="xs"
            className="w-10"
            disabled={!canPercent}
            onClick={addPercent}
            title={
              atCap
                ? 'Навык на капе'
                : `+1%: нужно ${fmt(roundUp2(nextNeed))} СП до ${shown + 1}% (Shift: +5%)${canPercent ? '' : ' — недостаточно СП'}`
            }
          >
            +1%
          </Button>
        </div>
      </td>
    </tr>
  )
})

function ValueBar({ r, config }: { r: SkillResult; config: Config }) {
  const max = Math.max(1, config.skillMax)
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`
  const startW = Math.min(r.start, r.value)
  const atCap = r.value >= max - EPS

  return (
    <div className="relative mt-0.5 h-1.5 w-40 overflow-hidden rounded-sm bg-zinc-800">
      <div className="absolute inset-y-0 left-0 bg-zinc-600" style={{ width: pct(startW) }} />
      <div
        className={cn('absolute inset-y-0', atCap ? 'bg-emerald-400' : r.tagged ? 'bg-amber-400' : 'bg-sky-400')}
        style={{ left: pct(startW), width: `calc(${pct(r.value)} - ${pct(startW)})` }}
      />
      {config.thresholds.map((t, i) => (
        <div
          key={i}
          className="absolute inset-y-0 w-px bg-zinc-950/80"
          style={{ left: pct(t.from) }}
          title={`с ${t.from}: ${fmt(t.cost)} СП/пункт`}
        />
      ))}
    </div>
  )
}
