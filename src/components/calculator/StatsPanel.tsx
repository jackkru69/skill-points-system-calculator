import { useMemo } from 'react'
import { STATS, statUsage } from '../../engine'
import { useAppStore, useBuildResult } from '../../store'
import { Button, NumberInput, Panel, cn } from '../ui'

export function StatsPanel() {
  const stats = useAppStore((s) => s.build.stats)
  const config = useAppStore((s) => s.config)
  const setStat = useAppStore((s) => s.setStat)
  const result = useBuildResult()
  const usage = useMemo(() => statUsage(config), [config])

  const remaining = config.statPool - result.statPointsUsed

  return (
    <Panel
      title="Статы"
      actions={
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-xs tabular-nums',
            remaining < 0
              ? 'bg-red-500/15 text-red-300'
              : remaining > 0
                ? 'bg-amber-500/10 text-amber-300'
                : 'text-zinc-400',
          )}
          title={`Пул: ${config.statPool}, распределено: ${result.statPointsUsed}`}
        >
          Осталось: {remaining}
        </span>
      }
    >
      <ul className="space-y-1">
        {STATS.map((stat) => {
          const value = stats[stat.id]
          const outOfRange = value < config.statMin || value > config.statMax
          const fill = Math.min(1, Math.max(0, value / config.statMax))
          return (
            <li key={stat.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="w-9 text-xs font-semibold text-amber-400/90">{stat.short}</span>
                  <span className="truncate text-sm text-zinc-300">{stat.name}</span>
                  <span
                    className="ml-auto text-[10px] text-zinc-600 tabular-nums"
                    title="В скольких базах навыков участвует стат"
                  >
                    ×{usage[stat.id]}
                  </span>
                </div>
                <div className="mt-0.5 h-0.5 rounded bg-zinc-800">
                  <div
                    className={cn('h-full rounded', outOfRange ? 'bg-red-500' : 'bg-zinc-500')}
                    style={{ width: `${fill * 100}%` }}
                  />
                </div>
              </div>
              <Button
                size="xs"
                className="w-6"
                disabled={value <= config.statMin}
                onClick={() => setStat(stat.id, value - 1)}
                aria-label={`Уменьшить ${stat.name}`}
              >
                −
              </Button>
              <NumberInput
                value={value}
                onChange={(v) => setStat(stat.id, v)}
                min={config.statMin}
                max={config.statMax}
                integer
                aria-label={stat.name}
                className={cn('w-10 text-center', outOfRange && 'border-red-500 text-red-300')}
              />
              <Button
                size="xs"
                className="w-6"
                disabled={value >= config.statMax}
                onClick={() => setStat(stat.id, value + 1)}
                aria-label={`Увеличить ${stat.name}`}
              >
                +
              </Button>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
