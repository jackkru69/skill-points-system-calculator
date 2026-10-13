import { DEFAULT_CONFIG } from '../../engine'
import type { Config } from '../../engine'
import { useAppStore } from '../../store'
import { NumberField, Section } from './fields'

type NumericKey = {
  [K in keyof Config]: Config[K] extends number ? K : never
}[keyof Config]

interface FieldDef {
  key: NumericKey
  label: string
  hint?: string
  integer?: boolean
  min?: number
  max?: number
  step?: number
}

const GROUPS: { title: string; fields: FieldDef[] }[] = [
  {
    title: 'Статы',
    fields: [
      { key: 'statPool', label: 'Пул статов', integer: true, min: 0 },
      { key: 'statMin', label: 'Мин. стата', integer: true, min: 0 },
      { key: 'statMax', label: 'Макс. стата', integer: true, min: 1 },
    ],
  },
  {
    title: 'Тэги и Скиллед',
    fields: [
      { key: 'tagBonus', label: 'Тэг-бонус', hint: 'флэт к старту', min: 0 },
      { key: 'tagPointsMultiplier', label: 'Тэг: пунктов за 1 СП (×)', min: 0, step: 0.5 },
      { key: 'tagsNormal', label: 'Тэгов (обычно)', integer: true, min: 0 },
      { key: 'tagsSkilled', label: 'Тэгов (Скиллед)', integer: true, min: 0 },
      { key: 'skilledBonusSP', label: 'Бонус СП Скилледа', hint: 'за уровень', min: 0 },
    ],
  },
  {
    title: 'Уровни и СП',
    fields: [
      { key: 'spPerIntCoef', label: 'k (СП = ИНТ×k)', min: 0 },
      { key: 'startingSP', label: 'Стартовые СП', hint: 'на 1 уровне', min: 0 },
      { key: 'maxLevel', label: 'Макс. уровень', integer: true, min: 1 },
    ],
  },
  {
    title: 'Скиллы',
    fields: [
      { key: 'skillMax', label: 'Кап скилла', min: 1 },
      { key: 'baseCost', label: 'Базовая цена', hint: 'СП/пункт до 1-го порога', min: 0, step: 0.5 },
      { key: 'bleedCoefDefault', label: 'Коэф. блида', hint: 'глобальный', min: 0, step: 0.05 },
    ],
  },
]

export function GeneralSettings() {
  const config = useAppStore((s) => s.config)
  const updateConfig = useAppStore((s) => s.updateConfig)

  return (
    <Section title="Общие">
      <div className="space-y-2">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="mb-1 text-[10px] text-zinc-500">{g.title}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {g.fields.map((f) => {
                const value = config[f.key]
                const def = DEFAULT_CONFIG[f.key]
                return (
                  <label key={f.key} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-zinc-300" title={f.hint ?? f.label}>
                      {f.label}
                      {f.hint && <span className="ml-1 text-[10px] text-zinc-500">{f.hint}</span>}
                    </span>
                    <NumberField
                      ariaLabel={f.label}
                      value={value}
                      onCommit={(v) => v !== null && updateConfig({ [f.key]: v } as Partial<Config>)}
                      integer={f.integer}
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      changed={value !== def}
                      defaultValue={def}
                      className="w-16 shrink-0"
                    />
                  </label>
                )
              })}
            </div>
          </div>
        ))}
        {config.statMin > config.statMax && (
          <p className="text-[11px] text-red-400">⚠ Мин. стата больше макс.</p>
        )}
      </div>
    </Section>
  )
}
