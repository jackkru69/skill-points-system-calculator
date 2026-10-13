import { useRef, useState } from 'react'
import { useAppStore } from '../../store'
import { downloadJson, parseConfigJson } from './configUtils'
import { SmallButton } from './fields'

export function ConfigActions() {
  const resetConfig = useAppStore((s) => s.resetConfig)
  const loadConfig = useAppStore((s) => s.loadConfig)
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const exportConfig = () => {
    downloadJson('sp-calc-config.json', useAppStore.getState().config)
  }

  const importFile = async (file: File) => {
    try {
      loadConfig(parseConfigJson(await file.text()))
      setMessage({ ok: true, text: `Конфиг загружен: ${file.name}` })
    } catch (e) {
      setMessage({ ok: false, text: `Ошибка импорта: ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  const reset = () => {
    if (confirm('Сбросить весь конфиг баланса к значениям по умолчанию?')) {
      resetConfig()
      setMessage({ ok: true, text: 'Конфиг сброшен к умолчанию' })
    }
  }

  return (
    <div className="border-b border-zinc-800 px-3 py-2">
      <div className="flex flex-wrap gap-1.5">
        <SmallButton onClick={exportConfig} title="Скачать конфиг баланса в JSON">
          Экспорт JSON
        </SmallButton>
        <SmallButton onClick={() => fileRef.current?.click()} title="Загрузить конфиг баланса из JSON">
          Импорт JSON
        </SmallButton>
        <span className="ml-auto">
          <SmallButton variant="danger" onClick={reset}>
            Сбросить к умолчанию
          </SmallButton>
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importFile(f)
            e.target.value = ''
          }}
        />
      </div>
      {message && (
        <div
          className={`mt-1.5 flex items-center justify-between text-[11px] ${message.ok ? 'text-emerald-400' : 'text-red-400'}`}
        >
          <span>{message.text}</span>
          <button type="button" className="text-zinc-500 hover:text-zinc-300" onClick={() => setMessage(null)}>
            ×
          </button>
        </div>
      )}
    </div>
  )
}
