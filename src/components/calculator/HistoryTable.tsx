import { useState } from 'react'
import { useAppStore, useBuildResult, useHistory } from '../../store'
import { cn, displayValue, fmt } from '../ui'

export function HistoryTable() {
  const [open, setOpen] = useState(false)
  const skills = useAppStore((s) => s.config.skills)
  const history = useHistory()
  const result = useBuildResult()

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-zinc-800/40"
        aria-expanded={open}
      >
        <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
          История прокачки
          <span className="ml-2 font-normal tracking-normal text-zinc-600 normal-case tabular-nums">
            {history.length} ур.
          </span>
        </span>
        <span className={cn('text-zinc-500 transition-transform', open && 'rotate-180')}>▾</span>
      </button>

      {open && (
        <div className="max-h-[420px] overflow-auto border-t border-zinc-800">
          <table className="w-full border-collapse text-xs tabular-nums">
            <thead className="sticky top-0 z-10 bg-zinc-900">
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="sticky left-0 z-10 bg-zinc-900 px-2 py-1 text-left align-bottom font-medium">Ур.</th>
                {skills.map((s) => (
                  <th key={s.id} className="px-1 py-1 align-bottom font-medium" title={s.name}>
                    <span className="mx-auto block max-h-24 rotate-180 whitespace-nowrap [writing-mode:vertical-rl]">
                      {s.name}
                    </span>
                  </th>
                ))}
                <th className="px-2 py-1 text-right align-bottom font-medium">Своб. СП</th>
              </tr>
            </thead>
            <tbody>
              {history.map((snap, i) => {
                const prev = i > 0 ? history[i - 1] : null
                return (
                  <tr key={snap.level} className="border-b border-zinc-800/60 hover:bg-zinc-800/40">
                    <td className="sticky left-0 bg-zinc-900 px-2 py-0.5 font-medium text-zinc-300">{snap.level}</td>
                    {skills.map((s) => {
                      const v = displayValue(snap.values[s.id] ?? 0)
                      const before = prev
                        ? displayValue(prev.values[s.id] ?? 0)
                        : displayValue(result.skills[s.id]?.start ?? v)
                      const delta = v - before
                      return (
                        <td
                          key={s.id}
                          title={delta !== 0 ? `${s.name}: ${before} → ${v} (${delta > 0 ? '+' : ''}${delta})` : s.name}
                          className={cn(
                            'px-1 py-0.5 text-center',
                            delta > 0 && 'bg-emerald-500/15 font-semibold text-emerald-300',
                            delta < 0 && 'bg-red-500/15 text-red-300',
                            delta === 0 && 'text-zinc-500',
                          )}
                        >
                          {v}
                        </td>
                      )
                    })}
                    <td
                      className={cn(
                        'px-2 py-0.5 text-right',
                        snap.spAvailable < -1e-9 ? 'text-red-300' : snap.spAvailable > 1e-9 ? 'text-zinc-300' : 'text-zinc-600',
                      )}
                    >
                      {fmt(snap.spAvailable)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
