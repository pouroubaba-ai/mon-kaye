import * as React from 'react'
import { CalendarDays, Check, ChevronDown, X } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ALL_TIME, isFiltered, rangeBounds, rangeLabel, toIso, type DateRange, type RangeKey } from '@/lib/date-range'

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
        <PopoverContent align={align} className="max-h-(--radix-popover-content-available-height) w-[min(19rem,calc(100vw-2rem))] overflow-y-auto p-1.5">
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

const PRESETS: RangeKey[] = ['tout', 'jour', '7j', 'mois', 'annee']

// Filtre par date (fiche d'une personne, fiche de compte, tableau de bord : partenaires)
// Choix rapides, ou « Choisir les dates » : un champ Du et un champ Au ; toucher un champ ouvre une fenêtre avec le calendrier.
export function DateFilter({ value, onChange, align }: { value: DateRange; onChange: (r: DateRange) => void; align?: 'start' | 'end' }) {
  const [open, setOpen] = React.useState(false)
  const today = new Date(new Date().toDateString())
  const [from, setFrom] = React.useState<Date | undefined>()
  const [to, setTo] = React.useState<Date | undefined>()
  const [editing, setEditing] = React.useState<'from' | 'to' | null>(null) // champ dont le calendrier est ouvert
  React.useEffect(() => {
    if (!open) return
    const b = value.key === 'perso' ? rangeBounds(value) : { start: null, end: null }
    setFrom(b.start ?? undefined)
    setTo(b.end ?? (value.key === 'perso' ? undefined : today))
    setEditing(null)
  }, [open])
  const pick = (r: DateRange) => {
    onChange(r)
    setOpen(false)
  }
  // Un champ date qui ouvre le calendrier
  const field = (key: 'from' | 'to', label: string, d: Date | undefined) => (
    <>
      <span>{label}</span>
      <button
        type="button"
        onClick={() => setEditing(key)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-lg border bg-transparent px-2.5 text-left text-sm dark:bg-input/30',
          editing === key && 'border-ring ring-3 ring-ring/50'
        )}
      >
        <span className={d ? 'text-foreground' : 'text-muted-foreground'}>{d ? d.toLocaleDateString('fr-FR') : 'jj/mm/aaaa'}</span>
        <CalendarDays className="size-4 text-muted-foreground" />
      </button>
    </>
  )
  return (
    <FilterPill label={rangeLabel(value)} active={isFiltered(value)} onClear={() => onChange(ALL_TIME)} open={open} onOpenChange={o => (o || editing === null) && setOpen(o)} align={align}>
      <div className="flex flex-col">
        {PRESETS.map(k => (
          <FilterOption key={k} label={rangeLabel({ key: k })} selected={value.key === k} onClick={() => pick({ key: k })} />
        ))}
        <div className="mt-1 flex flex-col gap-2 border-t px-2.5 pt-2.5 pb-1.5">
          <span className={cn('text-sm', value.key === 'perso' && 'font-medium')}>Choisir les dates</span>
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
            {field('from', 'Du', from)}
            {field('to', 'Au', to)}
          </div>
          <Button size="sm" className="mt-1" disabled={!from && !to} onClick={() => pick({ key: 'perso', from: from ? toIso(from) : undefined, to: to ? toIso(to) : undefined })}>
            Appliquer
          </Button>
        </div>
      </div>
      {/* Toucher un champ ouvre une fenêtre au centre de l'écran (même sur téléphone) avec le calendrier ;
          choisir un jour remplit le champ et la referme */}
      <Dialog open={editing !== null} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[22rem] gap-3 p-4">
          <DialogHeader className="text-left">
            <DialogTitle>{editing === 'to' ? 'Date de fin' : 'Date de début'}</DialogTitle>
            <DialogDescription className="sr-only">Choisir un jour</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={editing === 'to' ? to : from}
              onSelect={(d: Date | undefined) => {
                if (!d) return
                if (editing === 'from') {
                  setFrom(d)
                  if (to && d > to) setTo(d)
                } else {
                  setTo(d)
                  if (from && d < from) setFrom(d)
                }
                setEditing(null)
              }}
              defaultMonth={(editing === 'to' ? to : from) ?? today}
              disabled={{ after: today }}
              endMonth={today}
              className="p-0 [--cell-size:2.5rem]"
            />
          </div>
        </DialogContent>
      </Dialog>
    </FilterPill>
  )
}
