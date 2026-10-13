import { memo, useMemo, useState, type MouseEvent } from 'react'
import {
  STATS,
  bleedGraph,
  costAt,
  spForPoints,
  type BleedLink,
  type BleedNode,
  type Config,
  type SkillDef,
  type SkillId,
  type SkillResult,
  type StatId,
} from '../../engine'
import { useAppStore, useBuildResult } from '../../store'
import { Button, Tooltip, cn, displayValue, fmt, plural } from '../ui'

type Relation = 'self' | 'target' | 'source' | 'both' | null

const EPS = 1e-9

// Opaque equivalent of the panel background (zinc-900/60 over zinc-950) so sticky cells hide scrolled content.
const STICKY_CELL = 'sticky z-[1] bg-[color-mix(in_oklab,var(--color-zinc-900)_60%,var(--color-zinc-950))]'

// Row tints are background-images so they can be layered over the opaque sticky-cell color.
const ROW_TINT: Record<NonNullable<Relation> | 'tagged', string> = {
  self: 'from-zinc-800/70 to-zinc-800/70',
  target: 'from-sky-500/15 to-sky-500/15',
  source: 'from-emerald-500/15 to-emerald-500/15',
  both: 'from-sky-500/15 to-emerald-500/15',
  tagged: 'from-amber-500/[0.06] to-amber-500/[0.06]',
}
const STAT_SHORT = Object.fromEntries(STATS.map((s) => [s.id, s.short])) as Record<StatId, string>

function formula(skill: SkillDef): string {
  const parts = [STAT_SHORT[skill.baseStats[0]], STAT_SHORT[skill.baseStats[1]]]
  if (skill.baseMult !== 1) parts.push(fmt(skill.baseMult))
  return parts.join('×')
}

export function SkillsTable() {
  const config = useAppStore((s) => s.config)
  const levelUp = useAppStore((s) => s.levelUp)
  const result = useBuildResult()
  const [hovered, setHovered] = useState<SkillId | null>(null)
  const { level, spAvailable, spEarned, spPerLevel } = result
  const showLevelHint = spAvailable <= EPS && level < config.maxLevel

  const names = useMemo(
    () => Object.fromEntries(config.skills.map((s) => [s.id, s.name])) as Record<SkillId, string>,
    [config.skills],
  )

  const graph = useMemo(() => bleedGraph(config), [config])

  const relations = useMemo(() => {
    const map = new Map<SkillId, Relation>()
    if (!hovered) return map
    const node = graph[hovered]
    const targets = new Set(node?.outgoing.map((l) => l.skill))
    const sources = new Set(node?.incoming.map((l) => l.skill))
    for (const s of config.skills) {
      if (s.id === hovered) {
        map.set(s.id, 'self')
        continue
      }
      const isTarget = targets.has(s.id)
      const isSource = sources.has(s.id)
      map.set(s.id, isTarget && isSource ? 'both' : isTarget ? 'target' : isSource ? 'source' : null)
    }
    return map
  }, [hovered, graph, config.skills])

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">Навыки</h2>
          <span
            className={cn(
              'text-xs tabular-nums',
              spAvailable < -EPS ? 'text-red-300' : spAvailable > EPS ? 'text-emerald-300' : 'text-zinc-500',
            )}
          >
            доступно {fmt(spAvailable)} СП
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-sky-400" /> блидит в
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-emerald-400" /> получает от
          </span>
          <span>±N — пункты навыка, Shift — ×5</span>
        </div>
      </div>
      {showLevelHint && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-zinc-800 bg-sky-500/5 px-3 py-2 text-xs text-sky-200">
          <span className="min-w-0 flex-1">
            {level === 1 && spEarned <= EPS
              ? `На 1 уровне свободных СП нет. Нажмите «Level Up», чтобы получить ${fmt(spPerLevel)} СП и вложить их в навыки.`
              : `Все СП распределены. «Level Up» даст ещё ${fmt(spPerLevel)} СП.`}
          </span>
          <Button variant="primary" onClick={levelUp}>
            Level Up → {level + 1}
          </Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-sm tabular-nums">
          <thead className="sticky top-0 z-10 bg-zinc-900 text-[11px] tracking-wide text-zinc-500 uppercase">
            <tr className="border-b border-zinc-800">
              <th className="sticky left-0 w-8 bg-zinc-900 px-2 py-1.5 text-center font-medium" title="Тэг">★</th>
              <th className="sticky left-8 bg-zinc-900 px-2 py-1.5 text-left font-medium shadow-[1px_0_0_var(--color-zinc-800)]">
                Навык
              </th>
              <th className="px-2 py-1.5 text-left font-medium">Формула</th>
              <th className="px-2 py-1.5 text-right font-medium">База</th>
              <th className="px-2 py-1.5 text-right font-medium" title="Вложено напрямую (в скобках — на текущем уровне)">
                Direct SP
              </th>
              <th className="px-2 py-1.5 text-right font-medium">Bleed SP</th>
              <th className="px-2 py-1.5 text-right font-medium">Total SP</th>
              <th className="w-44 px-2 py-1.5 text-left font-medium">Значение</th>
              <th
                className="px-2 py-1.5 text-right font-medium"
                title="Цена следующего пункта навыка в СП (тэг — в 2 раза дешевле)"
              >
                Цена, СП/пункт
              </th>
              <th className="px-2 py-1.5 text-center font-medium" title="Кнопки меняют значение навыка на N пунктов">
                Пункты навыка
              </th>
            </tr>
          </thead>
          <tbody onMouseLeave={() => setHovered(null)}>
            {config.skills.map((skill) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                r={result.skills[skill.id]}
                names={names}
                node={graph[skill.id]}
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
  node: BleedNode | undefined
  config: Config
  spAvailable: number
  relation: Relation
  onHover: (id: SkillId) => void
}

const SkillRow = memo(function SkillRow({
  skill,
  r,
  names,
  node,
  config,
  spAvailable,
  relation,
  onHover,
}: SkillRowProps) {
  const toggleTag = useAppStore((s) => s.toggleTag)
  const addPoints = useAppStore((s) => s.addPoints)

  if (!r) return null

  const outgoing = node?.outgoing ?? []
  const incoming = node?.incoming ?? []
  const atCap = r.value >= config.skillMax - EPS
  const canAdd = spAvailable > EPS && !atCap
  const canRemove = r.currentLevelSP > EPS
  const shown = displayValue(r.value)

  const tint = cn('bg-linear-to-r', relation ? ROW_TINT[relation] : r.tagged && ROW_TINT.tagged)

  const mult = (e: MouseEvent) => (e.shiftKey ? 5 : 1)
  const change = (points: number) => (e: MouseEvent) => addPoints(skill.id, points * mult(e))
  const spFor = (points: number) => spForPoints(r.start, r.totalSP, r.tagged, config, points)

  const addTitle = (points: number) => {
    if (atCap) return 'Навык на капе'
    const need = spFor(points)
    const target = Math.min(shown + points, config.skillMax)
    const base = `+${points} ${pointsWord(points)}: ${fmt(need)} СП → ${target}% (Shift: +${points * 5})`
    if (need <= spAvailable + EPS) return base
    if (spAvailable <= EPS) return `${base} — нет свободных СП`
    return `${base} — не хватает СП, вложится сколько хватит (доступно ${fmt(spAvailable)})`
  }
  const removeTitle = (points: number) => {
    if (!canRemove) return 'На текущем уровне в навык ничего не вложено'
    const refund = Math.min(-spFor(-points), r.currentLevelSP)
    return `−${points} ${pointsWord(points)}: вернёт ${fmt(refund)} СП (только из текущего уровня; Shift: −${points * 5})`
  }

  return (
    <tr onMouseEnter={() => onHover(skill.id)} className={cn('border-b border-zinc-800/70', tint)}>
      <td className={cn('left-0 px-2 py-1 text-center', STICKY_CELL, tint)}>
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
      <td className={cn('left-8 px-2 py-1 shadow-[1px_0_0_var(--color-zinc-800)]', STICKY_CELL, tint)}>
        <Tooltip
          content={
            <div className="space-y-0.5">
              <div>
                <span className="text-sky-300">Блидит в: </span>
                {formatLinks(outgoing, names)}
              </div>
              <div>
                <span className="text-emerald-300">Получает из: </span>
                {formatLinks(incoming, names)}
              </div>
            </div>
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
          <span
            title={`Следующий пункт: ${fmt(r.costPerPoint)} СП (база ${fmt(costAt(r.value, config))}${r.tagged ? ` × тэг ${fmt(config.tagCostMultiplier)}` : ''})`}
          >
            <span
              className={cn(
                r.costPerPoint > config.baseCost * (r.tagged ? config.tagCostMultiplier : 1)
                  ? 'text-amber-300'
                  : r.tagged
                    ? 'text-amber-200'
                    : 'text-zinc-300',
              )}
            >
              {fmt(r.costPerPoint)}
            </span>
            <span className="ml-0.5 text-[10px] text-zinc-500">СП</span>
            {r.tagged && <span className="ml-1 text-[10px] text-amber-400/80">★×{fmt(config.tagCostMultiplier)}</span>}
          </span>
        )}
      </td>
      <td className="px-2 py-1">
        <div className="flex items-center justify-center gap-0.5">
          <Button size="xs" variant="danger" className="w-9" disabled={!canRemove} onClick={change(-10)} title={removeTitle(10)}>
            −10
          </Button>
          <Button size="xs" variant="danger" className="w-8" disabled={!canRemove} onClick={change(-1)} title={removeTitle(1)}>
            −1
          </Button>
          <span className="mx-1 h-4 w-px bg-zinc-700" />
          <Button size="xs" variant="success" className="w-8" disabled={!canAdd} onClick={change(1)} title={addTitle(1)}>
            +1
          </Button>
          <Button size="xs" variant="success" className="w-9" disabled={!canAdd} onClick={change(10)} title={addTitle(10)}>
            +10
          </Button>
        </div>
      </td>
    </tr>
  )
})

function pointsWord(n: number): string {
  return plural(n, 'пункт', 'пункта', 'пунктов')
}

function formatLinks(links: BleedLink[], names: Record<SkillId, string>) {
  if (links.length === 0) return <span className="text-zinc-500">—</span>
  return links.map((l, i) => (
    <span key={l.skill}>
      {i > 0 && ', '}
      {names[l.skill] ?? l.skill}
      <span className="text-zinc-400 tabular-nums"> ×{fmt(l.coef)}</span>
    </span>
  ))
}

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
