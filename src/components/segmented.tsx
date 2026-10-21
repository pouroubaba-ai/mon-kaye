import * as React from 'react'

import { cn } from '@/lib/utils'

// Interrupteur à plusieurs positions : une pastille glisse sous le choix actif,
// on voit tout de suite où l'on est (Crédits / Versements / Retours…).
// Chaque choix prend la place de son texte ; la pastille prend la taille du choix actif.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])
  const [thumb, setThumb] = React.useState<{ x: number; w: number } | null>(null)
  const i = Math.max(0, options.findIndex(o => o.value === value))
  const key = options.map(o => `${o.label}${o.count ?? ''}`).join('|')
  React.useLayoutEffect(() => {
    const el = refs.current[i]
    if (el) setThumb({ x: el.offsetLeft, w: el.offsetWidth })
  }, [i, key])
  return (
    <div role="tablist" className={cn('relative inline-flex w-fit max-w-full self-start rounded-full bg-muted p-1', className)}>
      {/* La pastille qui glisse */}
      {thumb && (
        <span
          aria-hidden
          className="absolute top-1 bottom-1 left-0 rounded-full bg-background shadow-sm ring-1 ring-foreground/10 transition-[transform,width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: thumb.w, transform: `translateX(${thumb.x}px)` }}
        />
      )}
      {options.map((o, k) => (
        <button
          key={o.value}
          ref={el => {
            refs.current[k] = el
          }}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative z-10 flex h-8 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors',
            o.value === value ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}
