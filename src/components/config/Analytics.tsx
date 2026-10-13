import { useMemo } from 'react'
import { STATS, statUsage } from '../../engine'
import type { SkillId, StatId } from '../../engine'
import { useAppStore } from '../../store'
import { Section } from './fields'

function fmtNum(n: number) {
  return String(Math.round(n * 100) / 100)
}

export function Analytics() {
  const config = useAppStore((s) => s.config)

  const usage = useMemo(() => statUsage(config), [config])

  const occurrences = useMemo(() => {
    const occ = Object.fromEntries(STATS.map((s) => [s.id, 0])) as Record<StatId, number>
    for (const sk of config.skills) for (const st of sk.baseStats) occ[st] += 1
    return occ
  }, [config.skills])

  const { incoming, outgoing } = useMemo(() => {
    const inc = new Map<SkillId, { from: SkillId; coef: number }[]>()
    const out = new Map<SkillId, number>()
    for (const src of config.skills) {
      const coef = src.bleedCoef ?? config.bleedCoefDefault
      for (const t of src.bleedTargets) {
        if (!t) continue
        out.set(src.id, (out.get(src.id) ?? 0) + coef)
        const list = inc.get(t) ?? []
        const existing = list.find((e) => e.from === src.id)
        if (existing) existing.coef += coef
        else list.push({ from: src.id, coef })
        inc.set(t, list)
      }
    }
    return { incoming: inc, outgoing: out }
  }, [config.skills, config.bleedCoefDefault])

  const names = useMemo(
    () => Object.fromEntries(config.skills.map((s) => [s.id, s.name])) as Record<SkillId, string>,
    [config.skills],
  )
  const maxUsage = Math.max(...STATS.map((s) => usage[s.id] ?? 0), 1)

  return (
    <Section title="Аналитика">
      <div className="mb-1 text-[10px] text-zinc-500">Использование статов в базах скиллов</div>
      <div className="mb-3 grid grid-cols-7 gap-1">
        {STATS.map((s) => {
          const u = usage[s.id] ?? 0
          const occ = occurrences[s.id]
          return (
            <div
              key={s.id}
              className={`rounded border px-1 py-1 text-center ${
                u === 0 ? 'border-zinc-800 bg-zinc-900/40 text-zinc-500' : 'border-zinc-700 bg-zinc-900'
              }`}
              title={`${s.name}: в ${u} базах${occ !== u ? `, вхождений ${occ}` : ''}`}
            >
              <div className="text-[10px] text-zinc-400">{s.short}</div>
              <div className="text-sm font-semibold tabular-nums text-zinc-100">
                {u}
                {occ !== u && <span className="ml-0.5 text-[10px] font-normal text-zinc-500">({occ})</span>}
              </div>
              <div className="mt-0.5 h-1 rounded bg-zinc-800">
                <div className="h-1 rounded bg-amber-500/70" style={{ width: `${(u / maxUsage) * 100}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mb-1 text-[10px] text-zinc-500">Входящий блид (источник × коэф.) и исходящий суммарный коэф.</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] text-zinc-500">
            <th className="text-left font-normal">Навык</th>
            <th className="text-left font-normal">Получает от</th>
            <th className="text-right font-normal" title="Сумма Σcoef по всем вхождениям">
              Σ вход
            </th>
            <th className="text-right font-normal" title="Сколько от каждого Direct SP утекает в другие скиллы">
              Σ выход
            </th>
          </tr>
        </thead>
        <tbody>
          {config.skills.map((sk) => {
            const inc = incoming.get(sk.id) ?? []
            const sumIn = inc.reduce((a, e) => a + e.coef, 0)
            const sumOut = outgoing.get(sk.id) ?? 0
            return (
              <tr key={sk.id} className="border-t border-zinc-800/60 align-top">
                <td className="py-0.5 pr-2 whitespace-nowrap text-zinc-200">{sk.name}</td>
                <td className="py-0.5 text-zinc-400">
                  {inc.length === 0 ? (
                    <span className="text-zinc-600">—</span>
                  ) : (
                    inc.map((e, i) => (
                      <span key={e.from} className={e.from === sk.id ? 'text-red-400' : undefined}>
                        {i > 0 && ', '}
                        {names[e.from] ?? e.from}
                        <span className="text-zinc-500 tabular-nums"> ×{fmtNum(e.coef)}</span>
                      </span>
                    ))
                  )}
                </td>
                <td className="py-0.5 pl-2 text-right tabular-nums text-zinc-300">{sumIn ? fmtNum(sumIn) : ''}</td>
                <td className="py-0.5 pl-2 text-right tabular-nums text-zinc-300">{sumOut ? fmtNum(sumOut) : ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Section>
  )
}
