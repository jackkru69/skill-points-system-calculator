import { DEFAULT_CONFIG, STATS } from '../../engine'
import type { SkillDef, SkillId, StatId } from '../../engine'
import { useAppStore } from '../../store'
import { NumberField, Section, SelectField, type SelectOption } from './fields'

const NONE = '—'
type TargetValue = SkillId | typeof NONE

const statOptions: SelectOption<StatId>[] = STATS.map((s) => ({ value: s.id, label: s.short }))

export function SkillsConfigTable() {
  const skills = useAppStore((s) => s.config.skills)
  const bleedCoefDefault = useAppStore((s) => s.config.bleedCoefDefault)
  const updateSkill = useAppStore((s) => s.updateSkill)

  const targetOptions: SelectOption<TargetValue>[] = [
    { value: NONE, label: NONE },
    ...skills.map((s) => ({ value: s.id, label: s.name })),
  ]

  const setStat = (skill: SkillDef, slot: 0 | 1, stat: StatId) => {
    const baseStats: [StatId, StatId] = [...skill.baseStats]
    baseStats[slot] = stat
    updateSkill(skill.id, { baseStats })
  }

  const setTarget = (skill: SkillDef, slot: 0 | 1, target: TargetValue) => {
    const bleedTargets: [SkillId | null, SkillId | null] = [...skill.bleedTargets]
    bleedTargets[slot] = target === NONE ? null : target
    updateSkill(skill.id, { bleedTargets })
  }

  return (
    <Section title="Скиллы">
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
              <th className="text-left font-normal">Блидит #1</th>
              <th className="text-left font-normal">Блидит #2</th>
              <th className="text-left font-normal" title="Коэффициент блида (пусто = глобальный)">
                Коэф.
              </th>
            </tr>
          </thead>
          <tbody>
            {skills.map((skill) => {
              const def = DEFAULT_CONFIG.skills.find((d) => d.id === skill.id)
              const selfBleed = skill.bleedTargets.includes(skill.id)
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
                        ariaLabel={`${skill.name}: блидит в #${slot + 1}`}
                        value={skill.bleedTargets[slot] ?? NONE}
                        options={targetOptions}
                        onChange={(v) => setTarget(skill, slot, v)}
                        changed={!!def && def.bleedTargets[slot] !== skill.bleedTargets[slot]}
                        className={`w-24 ${skill.bleedTargets[slot] === skill.id ? 'text-red-400' : ''}`}
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
        «—» = слот не используется; одинаковые цели = двойной блид. Пустой коэф. = глобальный ({bleedCoefDefault}).
      </p>
    </Section>
  )
}
