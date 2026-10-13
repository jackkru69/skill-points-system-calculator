import { useEffect } from 'react'
import { Header } from './components/Header'
import { HistoryTable } from './components/calculator/HistoryTable'
import { IssuesBanner } from './components/calculator/IssuesBanner'
import { LevelPanel } from './components/calculator/LevelPanel'
import { SkillsTable } from './components/calculator/SkillsTable'
import { StatsPanel } from './components/calculator/StatsPanel'
import { TraitsPanel } from './components/calculator/TraitsPanel'
import ConfigPanel from './components/config/ConfigPanel'
import { useAppStore } from './store'

export default function App() {
  const configOpen = useAppStore((s) => s.configOpen)
  const setConfigOpen = useAppStore((s) => s.setConfigOpen)

  useEffect(() => {
    if (!configOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && window.matchMedia('(max-width: 1279px)').matches) setConfigOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [configOpen, setConfigOpen])

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <Header />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="shrink-0 space-y-3 border-zinc-800 p-3 lg:w-80 lg:overflow-y-auto lg:border-r">
          <StatsPanel />
          <TraitsPanel />
          <LevelPanel />
        </aside>

        <main className="min-w-0 flex-1 space-y-3 p-3 lg:overflow-y-auto">
          <IssuesBanner />
          <SkillsTable />
          <HistoryTable />
        </main>

        {configOpen && (
          <div className="fixed inset-0 z-40 xl:static xl:inset-auto xl:z-auto xl:flex xl:shrink-0">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-[1px] xl:hidden"
              onClick={() => setConfigOpen(false)}
              aria-hidden
            />
            <aside className="absolute inset-y-0 right-0 w-[min(480px,100vw)] overflow-y-auto border-l border-zinc-800 bg-zinc-950 shadow-2xl shadow-black xl:static xl:w-[480px] xl:shadow-none">
              <ConfigPanel />
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
