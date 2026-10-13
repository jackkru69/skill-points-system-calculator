import { DEFAULT_CONFIG, STATS } from '../../engine'
import type { BleedMode, SkillDef, SkillId, StatId } from '../../engine'
import { useAppStore } from '../../store'
import { changedRing, NumberField, Section, SelectField, type SelectOption } from './fields'

const NONE = '—'
type TargetValue = SkillId | typeof NONE

const statOptions: SelectOption<StatId>[] = STATS.map((s) => ({ value: s.id, label: s.short }))

export function SkillsConfigTable() {
  const skills = useAppStore((s) => s.config.skills)
  const bleedCoefDefault = useAppStore((s) => s.config.bleedCoefDefault)
  const bleedMode = useAppStore((s) => s.config.bleedMode)
  const updateConfig = useAppStore((s) => s.updateConfig)
  const updateSkill = useAppStore((s) => s.updateSkill)
  const incoming = bleedMode === 'incoming'
  const linkLabel = incoming ? 'Получает из' : 'Блидит в'

  const targetOptions: SelectOption<TargetValue>[] = [
    { value: NONE, label: NONE },
    ...skills.map((s) => ({ value: s.id, label: s.name })),
  ]

  const setStat = (skill: SkillDef, slot: 0 | 1, stat: StatId) => {
    const baseStats: [StatId, StatId] = [...skill.baseStats]
    baseStats[slot] = stat
    updateSkill(skill.id, { baseStats })
  }

  const setLink = (skill: SkillDef, slot: 0 | 1, link: TargetValue) => {
    const bleedLinks: [SkillId | null, SkillId | null] = [...skill.bleedLinks]
    bleedLinks[slot] = link === NONE ? null : link
    updateSkill(skill.id, { bleedLinks })
  }

  return (
    <Section title="Скиллы" right={<BleedModeToggle value={bleedMode} onChange={(m) => updateConfig({ bleedMode: m })} />}>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full border-separate border-spacing-x-1 border-spacing-y-0.5 text-xs">
          <thead>
            <tr className="text-[10px] text-zinc-500">
              <th className="text-left font-normal">Навык</th>
              <th className="text-left font-normal" colSpan={2}>
                Статы
              </th>
              <th className="text-left font-normal" title="Множитель базы">
                ×
              </th>
              <th className="text-left font-normal">{linkLabel} #1</th>
              <th className="text-left font-normal">{linkLabel} #2</th>
              <th
                className="text-left font-normal"
                title={
                  incoming
                    ? 'Коэф. входящего блида: доля Direct SP источников, которую получает этот скилл (пусто = глобальный)'
                    : 'Коэф. исходящего блида: доля Direct SP этого скилла, уходящая в каждую цель (пусто = глобальный)'
                }
              >
                Коэф.
              </th>
            </tr>
          </thead>
          <tbody>
            {skills.map((skill) => {
              const def = DEFAULT_CONFIG.skills.find((d) => d.id === skill.id)
              const selfBleed = skill.bleedLinks.includes(skill.id)
              return (
                <tr key={skill.id}>
                  <td className="max-w-24 truncate text-zinc-200" title={skill.id}>
                    {skill.name}
                  </td>
                  {([0, 1] as const).map((slot) => (
                    <td key={slot}>
                      <SelectField
                        ariaLabel={`${skill.name}: стат ${slot + 1}`}
                        value={skill.baseStats[slot]}
                        options={statOptions}
                        onChange={(v) => setStat(skill, slot, v)}
                        changed={!!def && def.baseStats[slot] !== skill.baseStats[slot]}
                        className="w-13"
                      />
                    </td>
                  ))}
                  <td>
                    <NumberField
                      ariaLabel={`${skill.name}: множитель`}
                      value={skill.baseMult}
                      onCommit={(v) => v !== null && updateSkill(skill.id, { baseMult: v })}
                      min={0}
                      step={0.5}
                      changed={!!def && def.baseMult !== skill.baseMult}
                      defaultValue={def?.baseMult}
                      className="w-10"
                    />
                  </td>
                  {([0, 1] as const).map((slot) => (
                    <td key={slot}>
                      <SelectField<TargetValue>
                        ariaLabel={`${skill.name}: ${linkLabel.toLowerCase()} #${slot + 1}`}
                        value={skill.bleedLinks[slot] ?? NONE}
                        options={targetOptions}
                        onChange={(v) => setLink(skill, slot, v)}
                        changed={!!def && def.bleedLinks[slot] !== skill.bleedLinks[slot]}
                        className={`w-24 ${skill.bleedLinks[slot] === skill.id ? 'text-red-400' : ''}`}
                        title={selfBleed ? 'Скилл блидит сам в себя' : undefined}
                      />
                    </td>
                  ))}
                  <td>
                    <NumberField
                      ariaLabel={`${skill.name}: коэф. блида`}
                      value={skill.bleedCoef}
                      onCommit={(v) => updateSkill(skill.id, { bleedCoef: v })}
                      nullable
                      min={0}
                      step={0.05}
                      placeholder={String(bleedCoefDefault)}
                      changed={!!def && def.bleedCoef !== skill.bleedCoef}
                      defaultValue={def?.bleedCoef}
                      className="w-12 placeholder:text-zinc-600"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-[10px] text-zinc-500">
        {incoming
          ? `Режим «входящий»: скилл получает коэф. × Direct SP каждого источника; коэф. — получателя. «—» = слот не используется; один источник дважды = двойной блид. Пустой коэф. = глобальный (${bleedCoefDefault}).`
          : `Режим «исходящий»: Direct SP скилла × коэф. уходит в каждую цель; коэф. — источника. «—» = слот не используется; одинаковые цели = двойной блид. Пустой коэф. = глобальный (${bleedCoefDefault}).`}
      </p>
    </Section>
  )
}

const MODES: { value: BleedMode; label: string; title: string }[] = [
  { value: 'incoming', label: 'Входящий', title: 'Связи = из каких скиллов получает; коэф. у получателя' },
  { value: 'outgoing', label: 'Исходящий', title: 'Связи = в какие скиллы блидит; коэф. у источника' },
]

function BleedModeToggle({ value, onChange }: { value: BleedMode; onChange: (mode: BleedMode) => void }) {
  const changed = value !== DEFAULT_CONFIG.bleedMode
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
      <span>Блид:</span>
      <div
        role="radiogroup"
        aria-label="Режим блида"
        className={`flex overflow-hidden rounded border border-zinc-700 ${changed ? changedRing : ''}`}
      >
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={value === m.value}
            title={m.title}
            onClick={() => onChange(m.value)}
            className={`h-5 px-1.5 text-[10px] transition-colors ${
              value === m.value ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  )
}
