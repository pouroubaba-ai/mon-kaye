import * as React from 'react'
import { Check, Columns3 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

// Tableau simple avec un bouton « Colonnes » pour afficher ou cacher des colonnes.
// Peu de colonnes par défaut (téléphone) ; toucher une ligne ouvre son détail.

export type Column<T> = {
  key: string
  label: string
  render: (row: T) => React.ReactNode
  align?: 'left' | 'right'
  // Affichée au départ ; « fixed » : toujours affichée (ne peut pas être cachée)
  defaultOn?: boolean
  fixed?: boolean
}

export function ColumnTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  rowClassName,
  empty = 'Rien pour l’instant.',
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  rowClassName?: (row: T) => string | undefined
  empty?: string
}) {
  const [on, setOn] = React.useState<Set<string>>(() => new Set(columns.filter(c => c.fixed || c.defaultOn).map(c => c.key)))
  const shown = columns.filter(c => c.fixed || on.has(c.key))
  const toggle = (key: string) =>
    setOn(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground">
              <Columns3 className="size-3.5" /> Colonnes
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52 p-1">
            {columns
              .filter(c => !c.fixed)
              .map(c => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => toggle(c.key)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <Check className={cn('size-4', on.has(c.key) ? 'opacity-100' : 'opacity-0')} />
                  {c.label}
                </button>
              ))}
          </PopoverContent>
        </Popover>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                {shown.map(c => (
                  <th key={c.key} className={cn('px-2 py-2 font-medium whitespace-nowrap first:pl-3 last:pr-3', c.align === 'right' ? 'text-right' : 'text-left')}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(r => (
                <tr
                  key={rowKey(r)}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onRowClick(r)) : undefined}
                  className={cn(onRowClick && 'cursor-pointer hover:bg-muted/40 focus-visible:bg-muted/60 focus-visible:outline-none', rowClassName?.(r))}
                >
                  {shown.map(c => (
                    <td key={c.key} className={cn('px-2 py-2.5 whitespace-nowrap tabular-nums first:pl-3 last:pr-3', c.align === 'right' ? 'text-right' : 'text-left')}>
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
