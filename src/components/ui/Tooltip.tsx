import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from './cn'

export interface TooltipProps {
  content: ReactNode
  children: ReactNode
  className?: string
  disabled?: boolean
}

interface Position {
  left: number
  top: number
}

export function Tooltip({ content, children, className, disabled }: TooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Position | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !tipRef.current) return
    const a = anchorRef.current.getBoundingClientRect()
    const t = tipRef.current.getBoundingClientRect()
    const margin = 6
    const above = a.top - t.height - margin
    const top = above < 4 ? a.bottom + margin : above
    const left = Math.min(
      window.innerWidth - t.width - 4,
      Math.max(4, a.left + a.width / 2 - t.width / 2),
    )
    setPos({ left, top })
  }, [open])

  const show = !disabled && open

  return (
    <span
      ref={anchorRef}
      className={cn('inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        setOpen(false)
        setPos(null)
      }}
    >
      {children}
      {show &&
        createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
            className="pointer-events-none fixed z-[100] max-w-xs rounded-md border border-zinc-700 bg-zinc-900/95 px-2.5 py-1.5 text-xs text-zinc-200 shadow-xl shadow-black/50 backdrop-blur"
          >
            {content}
          </div>,
          document.body,
        )}
    </span>
  )
}
