import { useAppStore } from '../../store'
import { Analytics } from './Analytics'
import { ConfigActions } from './ConfigActions'
import { countChanged } from './configUtils'
import { changedRing } from './fields'
import { GeneralSettings } from './GeneralSettings'
import { SkillsConfigTable } from './SkillsConfigTable'
import { ThresholdsEditor } from './ThresholdsEditor'

export default function ConfigPanel() {
  const setConfigOpen = useAppStore((s) => s.setConfigOpen)
  const changed = useAppStore((s) => countChanged(s.config))

  return (
    <aside className="flex h-full min-h-0 flex-col bg-zinc-950 text-zinc-100">
      <header className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <h2 className="text-sm font-semibold text-amber-400">Конфиг баланса</h2>
        {changed > 0 ? (
          <span
            className={`rounded px-1.5 text-[10px] text-amber-300 ${changedRing}`}
            title="Поля, отличающиеся от умолчания, подсвечены"
          >
            изменено: {changed}
          </span>
        ) : (
          <span className="text-[10px] text-zinc-500">по умолчанию</span>
        )}
        <button
          type="button"
          aria-label="Закрыть конфиг"
          title="Закрыть"
          onClick={() => setConfigOpen(false)}
          className="ml-auto flex h-6 w-6 items-center justify-center rounded text-lg leading-none text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          ×
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ConfigActions />
        <GeneralSettings />
        <ThresholdsEditor />
        <SkillsConfigTable />
        <Analytics />
      </div>
    </aside>
  )
}

export { ConfigPanel }
