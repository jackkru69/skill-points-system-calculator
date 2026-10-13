import { useIssues } from '../../store'
import { cn } from '../ui'

export function IssuesBanner() {
  const issues = useIssues()

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-300">
        <span aria-hidden>✓</span> Билд корректен
      </div>
    )
  }

  const sorted = [...issues].sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1))

  return (
    <ul className="space-y-1" role="status">
      {sorted.map((issue, i) => (
        <li
          key={`${issue.level}-${i}`}
          className={cn(
            'flex items-start gap-2 rounded-md border px-3 py-1.5 text-xs leading-snug',
            issue.level === 'error'
              ? 'border-red-500/30 bg-red-500/10 text-red-200'
              : 'border-amber-500/25 bg-amber-500/5 text-amber-200',
          )}
        >
          <span aria-hidden className="font-bold">
            {issue.level === 'error' ? '✕' : '!'}
          </span>
          <span>{issue.message}</span>
        </li>
      ))}
    </ul>
  )
}
