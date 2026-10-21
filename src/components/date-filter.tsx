import * as React from 'react'
import { CalendarDays, Check, ChevronDown, X } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ALL_TIME, isFiltered, rangeLabel, toIso, type DateRange, type RangeKey } from '@/lib/date-range'

// Pastille de filtre : « 📅 Ce mois ▾ ✕ ». On touche pour choisir, la croix enlève le filtre.
export function FilterPill({
  label,
  active,
  onClear,
  children,
  open,
  onOpenChange,
  align = 'start',
}: {
  label: string
  active: boolean
  onClear: () => void
  children: React.ReactNode // le contenu de la liste de choix
  open: boolean
  onOpenChange: (o: boolean) => void
  align?: 'start' | 'end'
}) {
  return (
    <div
      className={cn(
        'inline-flex h-9 w-fit max-w-full items-center rounded-full border text-sm transition-colors',
        active ? 'border-primary/40 bg-primary/10 text-foreground' : 'bg-card text-muted-foreground'
      )}
    >
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button type="button" className="flex h-full min-w-0 items-center gap-1.5 pr-2 pl-3">
            <CalendarDays className="size-4 shrink-0" />
            <span className={cn('truncate', active && 'font-medium')}>{label}</span>
            {!active && <ChevronDown className="size-4 shrink-0 opacity-60" />}
          </button>
        </PopoverTrigger>
        <PopoverContent align={align} className="w-[min(18rem,calc(100vw-2rem))] p-1.5">
          {children}
        </PopoverContent>
      </Popover>
      {active && (
        <button type="button" aria-label="Enlever le filtre" onClick={onClear} className="flex h-full items-center pr-2.5 pl-0.5">
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

// Une ligne de choix dans la liste
export function FilterOption({ label, hint, selected, onClick }: { label: string; hint?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted', selected && 'bg-muted font-medium')}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="shrink-0 text-xs text-muted-foreground">{hint}</span>}
      {selected && <Check className="size-4 shrink-0" />}
    </button>
  )
}

const PRESETS: RangeKey[] = ['tout', 'jour', '7j', 'mois', 'mois_prec']

// Filtre par date (fiche d'une personne, fiche de compte, tableau de bord : partenaires)
export function DateFilter({ value, onChange, align }: { value: DateRange; onChange: (r: DateRange) => void; align?: 'start' | 'end' }) {
  const [open, setOpen] = React.useState(false)
  const today = toIso(new Date())
  const [from, setFrom] = React.useState(value.from ?? '')
  const [to, setTo] = React.useState(value.to ?? today)
  React.useEffect(() => {
    if (open) {
      setFrom(value.from ?? '')
      setTo(value.to ?? today)
    }
  }, [open])
  const pick = (r: DateRange) => {
    onChange(r)
    setOpen(false)
  }
  return (
    <FilterPill label={rangeLabel(value)} active={isFiltered(value)} onClear={() => onChange(ALL_TIME)} open={open} onOpenChange={setOpen} align={align}>
      <div className="flex flex-col">
        {PRESETS.map(k => (
          <FilterOption key={k} label={rangeLabel({ key: k })} selected={value.key === k} onClick={() => pick({ key: k })} />
        ))}
        {/* Du … au … */}
        <div className="mt-1 flex flex-col gap-2 border-t px-2.5 pt-2.5 pb-1.5">
          <span className={cn('text-sm', value.key === 'perso' && 'font-medium')}>Choisir les dates</span>
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
            <span>Du</span>
            <Input type="date" value={from} max={to || today} onChange={e => setFrom(e.target.value)} className="h-9" />
            <span>Au</span>
            <Input type="date" value={to} min={from || undefined} max={today} onChange={e => setTo(e.target.value)} className="h-9" />
          </div>
          <Button size="sm" className="mt-1" disabled={!from && !to} onClick={() => pick({ key: 'perso', from: from || undefined, to: to || undefined })}>
            Appliquer
          </Button>
        </div>
      </div>
    </FilterPill>
  )
}
