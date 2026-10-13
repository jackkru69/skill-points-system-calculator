import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { Build, Config } from '../engine'
import { getShareUrl, useAppStore } from '../store'
import { Button } from './ui'

type Flash = { text: string; tone: 'ok' | 'error' } | null

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isBuild(v: unknown): v is Build {
  return isObject(v) && isObject(v.stats) && Array.isArray(v.tags) && Array.isArray(v.levels)
}

function isConfig(v: unknown): v is Config {
  return isObject(v) && Array.isArray(v.skills) && Array.isArray(v.thresholds)
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function Header() {
  const configOpen = useAppStore((s) => s.configOpen)
  const setConfigOpen = useAppStore((s) => s.setConfigOpen)
  const loadBuild = useAppStore((s) => s.loadBuild)
  const loadConfig = useAppStore((s) => s.loadConfig)
  const fileRef = useRef<HTMLInputElement>(null)
  const [flash, setFlash] = useState<Flash>(null)

  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 2500)
    return () => window.clearTimeout(t)
  }, [flash])

  const share = async () => {
    const url = getShareUrl()
    try {
      await navigator.clipboard.writeText(url)
      setFlash({ text: 'Ссылка скопирована', tone: 'ok' })
    } catch {
      window.prompt('Скопируйте ссылку:', url)
    }
  }

  const exportJson = () => {
    const { build, config } = useAppStore.getState()
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    download(`sp-build-${stamp}.json`, JSON.stringify({ build, config }, null, 2))
  }

  const importJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const data: unknown = JSON.parse(await file.text())
      if (!isObject(data)) throw new Error()
      const hasConfig = isConfig(data.config)
      const hasBuild = isBuild(data.build)
      if (!hasConfig && !hasBuild) throw new Error()
      if (hasConfig) loadConfig(data.config as Config)
      if (hasBuild) loadBuild(data.build as Build)
      setFlash({
        text: hasConfig && hasBuild ? 'Билд и конфиг загружены' : hasBuild ? 'Билд загружен' : 'Конфиг загружен',
        tone: 'ok',
      })
    } catch {
      setFlash({ text: 'Не удалось прочитать JSON', tone: 'error' })
    }
  }

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-950/90 px-4 py-2 backdrop-blur">
      <h1 className="mr-auto flex items-center gap-2 text-sm font-semibold text-zinc-100">
        <span className="rounded bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-zinc-950">СП</span>
        Калькулятор скиллпойнтов
      </h1>

      {flash && (
        <span
          role="status"
          className={flash.tone === 'ok' ? 'text-xs text-emerald-300' : 'text-xs text-red-300'}
        >
          {flash.text}
        </span>
      )}

      <Button onClick={share} title="Скопировать ссылку с текущим билдом и конфигом">
        Поделиться
      </Button>
      <Button onClick={exportJson} title="Скачать билд и конфиг в JSON">
        Экспорт JSON
      </Button>
      <Button onClick={() => fileRef.current?.click()} title="Загрузить билд и/или конфиг из JSON">
        Импорт JSON
      </Button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importJson} />
      <Button
        variant={configOpen ? 'primary' : 'default'}
        onClick={() => setConfigOpen(!configOpen)}
        aria-pressed={configOpen}
      >
        ⚙ Конфиг баланса
      </Button>
    </header>
  )
}
