import { useAppStore, useBuildResult } from '../../store'
import { Checkbox, Panel, cn, plural } from '../ui'

export function TraitsPanel() {
  const skilled = useAppStore((s) => s.build.skilled)
  const tags = useAppStore((s) => s.build.tags)
  const config = useAppStore((s) => s.config)
  const setSkilled = useAppStore((s) => s.setSkilled)
  const result = useBuildResult()

  const allowed = result.tagsAllowed
  const count = tags.length

  return (
    <Panel
      title="Трейты и тэги"
      actions={
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-xs tabular-nums',
            count > allowed
              ? 'bg-red-500/15 text-red-300'
              : count < allowed
                ? 'bg-amber-500/10 text-amber-300'
                : 'bg-emerald-500/10 text-emerald-300',
          )}
          title="Отмечено тэгов / разрешено"
        >
          ★ {count}/{allowed}
        </span>
      }
    >
      <Checkbox
        checked={skilled}
        onChange={setSkilled}
        className="items-start"
        label={
          <span className="text-sm">
            <span className="font-medium text-zinc-100">Скиллед</span>
            <span className="mt-0.5 block text-xs leading-snug text-zinc-400">
              Позволяет тэгнуть только {config.tagsSkilled}{' '}
              {plural(config.tagsSkilled, 'навык', 'навыка', 'навыков')} вместо{' '}
              {config.tagsNormal}, но даёт {config.skilledBonusSP} дополнительных СП на каждый
              уровень
            </span>
          </span>
        }
      />
      <p className="mt-2 text-xs leading-snug text-zinc-500">
        Тэг: +{config.tagBonus} к навыку; каждый шаг прокачки стоит столько же СП, но даёт +
        {config.tagPointsMultiplier} вместо +1. Клик по ★ в таблице.
      </p>
    </Panel>
  )
}
