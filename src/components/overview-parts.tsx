import * as React from 'react'
import { ArrowDownWideNarrow, ArrowUpDown, ArrowUpNarrowWide, Check, ChevronsUpDown } from 'lucide-react'

import type { Person } from '@/data/mockData'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger } from '@/components/ui/select'
import { cn, formatFCFA } from '@/lib/utils'

// Pièces communes aux vues d'ensemble Employés et Personnes :
// - PersonPicker : choix d'une personne avec recherche (modèle shadcn « Combobox ») ;
// - DaysCard : liste « nom + montant + barre des jours », tri, total, « Voir plus ».
// Listes longues : au-delà de 7 lignes, on montre les 5 premières et un bouton « Voir plus ».

const SHOW_FIRST = 5
const LONG_LIST = 7

export const countLabel = (n: number, unit: [string, string] = ['employé', 'employés']) => `${n} ${n > 1 ? unit[1] : unit[0]}`

export function PersonPicker({
  people,
  value,
  onChange,
  allLabel,
  searchPlaceholder,
  emptyText,
}: {
  people: Person[]
  value: string
  onChange: (id: string) => void
  allLabel: string
  searchPlaceholder: string
  emptyText: string
}) {
  const [open, setOpen] = React.useState(false)
  const current = people.find(e => e.id === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className="truncate">{current ? current.name : allLabel}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem value={allLabel} onSelect={() => { onChange('tous'); setOpen(false) }}>
                {allLabel}
                <Check className={cn('ml-auto', value === 'tous' ? 'opacity-100' : 'opacity-0')} />
              </CommandItem>
              {people.map(e => (
                <CommandItem key={e.id} value={e.name} onSelect={() => { onChange(e.id); setOpen(false) }}>
                  <span className="truncate">{e.name}</span>
                  <Check className={cn('ml-auto', value === e.id ? 'opacity-100' : 'opacity-0')} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export type DayRow = { id: string; name: string; days: number; amount: number }

// Liste en barres : nom + montant sur une ligne, barre des jours en dessous.
type SortKey = 'days-desc' | 'days-asc' | 'amount-desc' | 'amount-asc'

export function DaysCard({
  title,
  rows: rawRows,
  tone,
  amountLabel,
  empty,
  totalLabel,
  showCount,
  unit = ['employé', 'employés'],
}: {
  title: string
  rows: DayRow[]
  tone: 'credit' | 'debt'
  amountLabel: string
  empty: string
  totalLabel?: string
  showCount?: boolean
  unit?: [string, string]
}) {
  const [expanded, setExpanded] = React.useState(false)
  const [sort, setSort] = React.useState<SortKey>('days-desc')
  const [field, dir] = sort.split('-') as ['days' | 'amount', 'asc' | 'desc']
  const rows = [...rawRows].sort((a, b) => (dir === 'asc' ? a[field] - b[field] : b[field] - a[field]))
  const long = rows.length > LONG_LIST
  const shown = long && !expanded ? rows.slice(0, SHOW_FIRST) : rows
  const max = Math.max(1, ...rows.map(r => r.days))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">{title}</CardTitle>
        {totalLabel && rows.length > 0 && (
          <div className="flex flex-col gap-1 pt-2">
            <span className="text-xs text-muted-foreground">{totalLabel}</span>
            <span className={cn('text-lg font-semibold tabular-nums', tone === 'credit' ? 'text-credit' : 'text-debt')}>
              {formatFCFA(rawRows.reduce((a, r) => a + r.amount, 0))}
            </span>
            {showCount && <span className="text-xs text-muted-foreground">{countLabel(rawRows.length, unit)}</span>}
          </div>
        )}
        {rows.length > 1 && (
          <CardAction>
            <Select value={sort} onValueChange={v => setSort(v as SortKey)}>
              <SelectTrigger size="sm" aria-label="Trier">
                <ArrowUpDown className="size-3.5" />
                <span>Trier</span>
              </SelectTrigger>
              <SelectContent position="popper" align="end">
                <SelectGroup>
                  <SelectLabel>Jours</SelectLabel>
                  <SelectItem value="days-asc"><ArrowUpNarrowWide /> Croissant</SelectItem>
                  <SelectItem value="days-desc"><ArrowDownWideNarrow /> Décroissant</SelectItem>
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Montant</SelectLabel>
                  <SelectItem value="amount-asc"><ArrowUpNarrowWide /> Croissant</SelectItem>
                  <SelectItem value="amount-desc"><ArrowDownWideNarrow /> Décroissant</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
        {shown.map(r => (
          <div key={r.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate">{r.name}</span>
              <span className={cn('shrink-0 font-medium tabular-nums', tone === 'credit' ? 'text-credit' : 'text-debt')} title={amountLabel}>
                {formatFCFA(r.amount)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-[width] duration-700', tone === 'credit' ? 'bg-credit' : 'bg-debt')}
                  style={{ width: `${Math.max(4, (r.days / max) * 100)}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{r.days} j</span>
            </div>
          </div>
        ))}
        {long && (
          <Button variant="ghost" size="sm" className="self-center text-muted-foreground" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Voir moins' : `Voir plus (${rows.length - SHOW_FIRST})`}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

