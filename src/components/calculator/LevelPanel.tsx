import { useAppStore, useBuildResult } from '../../store'
import { Button, Panel, cn, fmt } from '../ui'

export function LevelPanel() {
  const config = useAppStore((s) => s.config)
  const stats = useAppStore((s) => s.build.stats)
  const skilled = useAppStore((s) => s.build.skilled)
  const levelUp = useAppStore((s) => s.levelUp)
  const levelUpTo = useAppStore((s) => s.levelUpTo)
  const undoLevel = useAppStore((s) => s.undoLevel)
  const resetLeveling = useAppStore((s) => s.resetLeveling)
  const resetBuild = useAppStore((s) => s.resetBuild)
  const result = useBuildResult()

  const { level, spPerLevel, spEarned, spSpent, spAvailable } = result
  const atMax = level >= config.maxLevel
  const breakdown = `ИНТ ${stats.IN} × ${config.spPerIntCoef}${skilled ? ` + ${config.skilledBonusSP} (Скиллед)` : ''}`

  return (
    <Panel title="Прокачка">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-zinc-500">Уровень</span>
          <span className="text-2xl font-semibold tabular-nums text-zinc-100">{level}</span>
          <span className="text-xs text-zinc-600 tabular-nums">/ {config.maxLevel}</span>
        </div>
        <div className="text-right" title={breakdown}>
          <div className="text-xs text-zinc-500">СП за уровень</div>
          <div className="text-sm font-medium tabular-nums text-zinc-200">{fmt(spPerLevel)}</div>
        </div>
      </div>

      <div className="mt-1 h-1 rounded bg-zinc-800">
        <div
          className="h-full rounded bg-amber-500/70"
          style={{ width: `${Math.min(100, (level / Math.max(1, config.maxLevel)) * 100)}%` }}
        />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Заработано" value={fmt(spEarned)} />
        <Stat label="Потрачено" value={fmt(spSpent)} />
        <Stat
          label="Доступно"
          value={fmt(spAvailable)}
          className={
            spAvailable < -1e-9
              ? 'text-red-300'
              : spAvailable > 1e-9
                ? 'text-emerald-300'
                : 'text-zinc-400'
          }
        />
      </dl>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <Button variant="primary" size="md" className="col-span-3" disabled={atMax} onClick={levelUp}>
          Level Up → {Math.min(level + 1, config.maxLevel)}
        </Button>
        <Button disabled={atMax} onClick={() => levelUpTo(Math.min(level + 5, config.maxLevel))}>
          +5 ур.
        </Button>
        <Button disabled={atMax} onClick={() => levelUpTo(config.maxLevel)}>
          до макс.
        </Button>
        <Button disabled={level <= 1} onClick={undoLevel} title="Удалить последний уровень и вернуть его СП">
          Отменить ур.
        </Button>
        <Button
          variant="danger"
          className="col-span-2"
          onClick={() => {
            if (window.confirm('Сбросить всю прокачку до 1 уровня?')) resetLeveling()
          }}
        >
          Сброс прокачки
        </Button>
        <Button
          variant="danger"
          title="Вернуть статы, тэги, трейт и прокачку к значениям по умолчанию"
          onClick={() => {
            if (window.confirm('Сбросить весь билд к значениям по умолчанию?')) resetBuild()
          }}
        >
          Сброс билда
        </Button>
      </div>
    </Panel>
  )
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/50 px-1 py-1.5">
      <dt className="text-[10px] tracking-wide text-zinc-500 uppercase">{label}</dt>
      <dd className={cn('text-sm font-semibold tabular-nums text-zinc-200', className)}>{value}</dd>
    </div>
  )
}
