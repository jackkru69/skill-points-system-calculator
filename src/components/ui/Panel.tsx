import type { ReactNode } from 'react'
import { cn } from './cn'

export interface PanelProps {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function Panel({ title, actions, children, className }: PanelProps) {
  return (
    <section className={cn('rounded-lg border border-zinc-800 bg-zinc-900/60', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
          <h2 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  )
}
