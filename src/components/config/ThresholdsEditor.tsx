import { useState } from 'react'
import { DEFAULT_CONFIG } from '../../engine'
import type { Threshold } from '../../engine'
import { useAppStore } from '../../store'
import { NumberField, Section, SmallButton } from './fields'

function round6(n: number) {
  return Math.round(n * 1e6) / 1e6
}

function thresholdIssues(thresholds: Threshold[], skillMax: number): string[] {
  const out: string[] = []
  for (let i = 1; i < thresholds.length; i++) {
    if (thresholds[i].from <= thresholds[i - 1].from) {
      out.push(`Порог #${i + 1} (${thresholds[i].from}) должен быть больше порога #${i} (${thresholds[i - 1].from})`)
    }
  }
  thresholds.forEach((t, i) => {
    if (t.from > skillMax) out.push(`Порог #${i + 1} (${t.from}) выше капа скилла (${skillMax}) — не сработает`)
  })
  return out
}

export function ThresholdsEditor() {
  const thresholds = useAppStore((s) => s.config.thresholds)
  const baseCost = useAppStore((s) => s.config.baseCost)
  const skillMax = useAppStore((s) => s.config.skillMax)
  const setThreshold = useAppStore((s) => s.setThreshold)
  const [step, setStep] = useState(1)

  const issues = thresholdIssues(thresholds, skillMax)
  const preview = thresholds.map((_, i) => round6(baseCost + step * (i + 1)))

  const applyStep = () => {
    preview.forEach((cost, i) => {
      if (thresholds[i].cost !== cost) setThreshold(i, { cost })
    })
  }

  return (
    <Section title="Пороги удорожания">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] text-zinc-500">
            <th className="w-8 text-left font-normal">#</th>
            <th className="text-left font-normal">С значения (from)</th>
            <th className="text-left font-normal">СП за шаг (cost)</th>
          </tr>
        </thead>
        <tbody>
          <tr className="text-zinc-500">
            <td>0</td>
            <td className="py-0.5">&lt; {thresholds[0]?.from ?? '—'}</td>
            <td className="py-0.5 tabular-nums">{baseCost} (базовая)</td>
          </tr>
          {thresholds.map((t, i) => {
            const def = DEFAULT_CONFIG.thresholds[i] as Threshold | undefined
            const badOrder = i > 0 && t.from <= thresholds[i - 1].from
            return (
              <tr key={i}>
                <td className={badOrder ? 'text-red-400' : 'text-zinc-400'}>{i + 1}</td>
                <td className="py-0.5">
                  <NumberField
                    ariaLabel={`Порог ${i + 1}: from`}
                    value={t.from}
                    onCommit={(v) => v !== null && setThreshold(i, { from: v })}
                    min={0}
                    changed={t.from !== def?.from}
                    defaultValue={def?.from}
                    className={`w-20 ${badOrder ? 'border-red-500!' : ''}`}
                  />
                </td>
                <td className="py-0.5">
                  <NumberField
                    ariaLabel={`Порог ${i + 1}: cost`}
                    value={t.cost}
                    onCommit={(v) => v !== null && setThreshold(i, { cost: v })}
                    min={0}
                    step={0.5}
                    changed={t.cost !== def?.cost}
                    defaultValue={def?.cost}
                    className="w-20"
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {issues.length > 0 && (
        <ul className="mt-2 space-y-0.5 rounded border border-red-800/60 bg-red-950/40 px-2 py-1 text-[11px] text-red-300">
          {issues.map((m) => (
            <li key={m}>⚠ {m}</li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1.5 text-xs">
        <span className="text-zinc-300" title="cost_i = базовая цена + шаг × i">
          Шаг удорожания
        </span>
        <NumberField value={step} onCommit={(v) => v !== null && setStep(v)} min={0} step={0.5} className="w-14" />
        <span className="text-[10px] text-zinc-500 tabular-nums">→ {preview.join(' / ')}</span>
        <span className="ml-auto">
          <SmallButton variant="accent" onClick={applyStep}>
            Применить
          </SmallButton>
        </span>
      </div>
    </Section>
  )
}
