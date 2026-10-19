import * as React from 'react'
import { ArrowDownWideNarrow, ArrowUpDown, ArrowUpNarrowWide, Check, ChevronsUpDown, Eye, List, PieChart as PieIcon, X } from 'lucide-react'
import { Label, Pie, PieChart } from 'recharts'

import type { Person } from '@/data/mockData'
import { useStore } from '@/data/store'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger } from '@/components/ui/select'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn, formatFCFA } from '@/lib/utils'

// Pièces communes aux vues d'ensemble Employés et Personnes :
// - PersonPicker : choix d'une personne avec recherche (modèle shadcn « Combobox ») ;
// - DaysCard : liste « nom + montant + barre des jours », tri, total, « Voir plus ».
// Listes longues : au-delà de 5 lignes, on montre les 5 premières, un bouton « Tout voir »,
// puis « Retour » pour revenir aux 5 premières.
// Chaque carte bascule entre « Liste » et « Graphique » (anneau : répartition du montant par rôle).

const SHOW_FIRST = 5

export const countLabel = (n: number, unit: [string, string] = ['employé', 'employés']) => `${n} ${n > 1 ? unit[1] : unit[0]}`

// Recherche exacte : le texte tapé doit se trouver dans le nom, ou les chiffres tapés dans le numéro
// (espaces ignorés). Évite qu'un numéro tapé fasse apparaître d'autres numéros « qui y ressemblent ».
const plain = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
function matchPerson(value: string, search: string, keywords?: string[]) {
  const q = plain(search.trim())
  if (!q) return 1
  if (plain(value.split('\u200b')[0]).includes(q)) return 1
  let digits = q.replace(/\D/g, '')
  if (digits.startsWith('242') && digits.length > 9) digits = digits.slice(3) // indicatif tapé : ignoré
  if (digits.length > 0 && digits.length === q.replace(/[\s+]/g, '').length) {
    return (keywords ?? []).some(k => k.replace(/\D/g, '').includes(digits)) ? 1 : 0
  }
  return 0
}

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
      <div className="relative">
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className={cn('w-full justify-between font-normal', current && 'pr-16')}>
            <span className="truncate">{current ? current.name : allLabel}</span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        {/* Une personne choisie : petite croix pour revenir à « Tous » */}
        {current && (
          <button
            type="button"
            aria-label="Effacer"
            onClick={() => onChange('tous')}
            className="absolute top-1/2 right-8 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command filter={matchPerson}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem value={allLabel} onSelect={() => { onChange('tous'); setOpen(false) }}>
                {allLabel}
                <Check className={cn('ml-auto', value === 'tous' ? 'opacity-100' : 'opacity-0')} />
              </CommandItem>
              {people.map(e => (
                // Recherche par nom ou par numéro (avec ou sans espaces).
                <CommandItem
                  key={e.id}
                  value={`${e.name}\u200b${e.id}`}
                  keywords={[e.phone || '', (e.phone || '').replace(/\D/g, '')]}
                  onSelect={() => { onChange(e.id); setOpen(false) }}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{e.name}</span>
                    {e.phone && <span className="truncate text-xs text-muted-foreground">{e.phone}</span>}
                  </div>
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

export type DayRow = { id: string; name: string; days: number; amount: number; role?: string }

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
  const { setSelectedPersonId } = useStore()
  const [expanded, setExpanded] = React.useState(false)
  const [sort, setSort] = React.useState<SortKey>('days-desc')
  const [field, dir] = sort.split('-') as ['days' | 'amount', 'asc' | 'desc']
  const rows = [...rawRows].sort((a, b) => (dir === 'asc' ? a[field] - b[field] : b[field] - a[field]))
  const [mode, setMode] = React.useState<'liste' | 'graphique'>('liste')
  const long = rows.length > SHOW_FIRST
  const shown = long && !expanded ? rows.slice(0, SHOW_FIRST) : rows
  const max = Math.max(1, ...rows.map(r => r.days))
  return (
    <Card>
      {/* 1. Titre + bascule Liste / Graphique */}
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">{title}</CardTitle>
        {rows.length > 0 && (
          <CardAction>
            <Tabs value={mode} onValueChange={v => setMode(v as 'liste' | 'graphique')}>
              <TabsList>
                <TabsTrigger value="liste" aria-label="Liste">
                  <List />
                </TabsTrigger>
                <TabsTrigger value="graphique" aria-label="Graphique">
                  <PieIcon />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* 2. Le total, en grand */}
        {totalLabel && rows.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{totalLabel}</span>
            <span className={cn('text-2xl font-semibold tabular-nums', tone === 'credit' ? 'text-credit' : 'text-debt')}>
              {formatFCFA(rawRows.reduce((a, r) => a + r.amount, 0))}
            </span>
          </div>
        )}

        {/* 3. Barre fine : nombre de personnes à gauche, tri à droite */}
        {rows.length > 0 && (showCount || (mode === 'liste' && rows.length > 1)) && (
          <div className="flex min-h-8 items-center justify-between gap-2 border-t pt-3">
            <span className="text-xs text-muted-foreground">{showCount ? countLabel(rawRows.length, unit) : ''}</span>
            {mode === 'liste' && rows.length > 1 && (
              <Select value={sort} onValueChange={v => setSort(v as SortKey)}>
                <SelectTrigger size="sm" aria-label="Trier" className="h-7 gap-1 border-0 bg-transparent px-2 text-xs text-muted-foreground shadow-none dark:bg-transparent">
                  <ArrowUpDown className="size-3.5" />
                  <span>Trier</span>
                </SelectTrigger>
                <SelectContent position="popper" align="end">
                  <SelectGroup>
                    <SelectLabel>Jours</SelectLabel>
                    <SelectItem value="days-asc"><ArrowUpNarrowWide /> Petit → Grand</SelectItem>
                    <SelectItem value="days-desc"><ArrowDownWideNarrow /> Grand → Petit</SelectItem>
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Montant</SelectLabel>
                    <SelectItem value="amount-asc"><ArrowUpNarrowWide /> Petit → Grand</SelectItem>
                    <SelectItem value="amount-desc"><ArrowDownWideNarrow /> Grand → Petit</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {rows.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
        {mode === 'graphique' && rows.length > 0 && <RoleDonut rows={rawRows} tone={tone} unit={unit} />}
        {mode === 'liste' && shown.map(r => (
          <div key={r.id} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <span className={cn('shrink-0 font-medium tabular-nums', tone === 'credit' ? 'text-credit' : 'text-debt')} title={amountLabel}>
                {formatFCFA(r.amount)}
              </span>
              {/* L'œil : ouvrir la fiche de cette personne (au retour, on revient ici) */}
              <Button variant="ghost" size="icon" className="-my-1 -mr-2 size-7 shrink-0 text-muted-foreground" aria-label={`Voir la fiche de ${r.name}`} onClick={() => setSelectedPersonId(r.id)}>
                <Eye className="size-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-[width] duration-700', tone === 'credit' ? 'bg-credit' : 'bg-debt')}
                  style={{ width: `${Math.max(4, (Math.max(0, r.days) / max) * 100)}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground" title="Depuis le dernier versement">
                {r.days < 0 ? 'jamais' : r.days === 0 ? "aujourd'hui" : r.days === 1 ? 'hier' : `il y a ${r.days} j`}
              </span>
            </div>
          </div>
        ))}
        {mode === 'liste' && long && (
          <Button variant="ghost" size="sm" className="self-center text-muted-foreground" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Retour' : `Tout voir (${rows.length})`}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}


// Anneau : répartition du montant de la carte entre les rôles (Client, Fournisseur…).
// Plusieurs nuances de la couleur de la carte (vert = on me doit, orange = je dois).
const SHADES = [100, 62, 38, 22, 14, 9]

function RoleDonut({ rows, tone, unit }: { rows: DayRow[]; tone: 'credit' | 'debt'; unit: [string, string] }) {
  const base = tone === 'credit' ? 'var(--color-credit)' : 'var(--color-debt)'
  const groups = new Map<string, { amount: number; people: number }>()
  for (const r of rows) {
    const key = r.role?.trim() || 'Sans rôle'
    const g = groups.get(key) ?? { amount: 0, people: 0 }
    g.amount += r.amount
    g.people += 1
    groups.set(key, g)
  }
  const slices = [...groups.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([label, g], i) => ({
      key: `r${i}`,
      label,
      value: g.amount,
      people: g.people,
      color: `color-mix(in oklch, ${base} ${SHADES[Math.min(i, SHADES.length - 1)]}%, transparent)`,
    }))
  const total = slices.reduce((a, s) => a + s.value, 0)
  const config = Object.fromEntries(slices.map(s => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig
  const data = slices.map(s => ({ key: s.key, value: s.value, fill: `var(--color-${s.key})` }))

  return (
    <div className="flex flex-col gap-4">
      <ChartContainer config={config} className="mx-auto aspect-square h-[180px]">
        <PieChart>
          <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={formatFCFA} />} />
          <Pie data={data} dataKey="value" nameKey="key" innerRadius={58} outerRadius={84} strokeWidth={3} animationDuration={700}>
            <Label
              content={({ viewBox }) =>
                viewBox && 'cx' in viewBox && 'cy' in viewBox ? (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-semibold">
                      {slices.length}
                    </tspan>
                    <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="fill-muted-foreground text-xs">
                      {slices.length > 1 ? 'rôles' : 'rôle'}
                    </tspan>
                  </text>
                ) : null
              }
            />
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="flex flex-col gap-2.5">
        {slices.map(s => (
          <div key={s.key} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-muted-foreground">{s.label}</span>
              <span className="text-xs text-muted-foreground/70">{countLabel(s.people, unit)}</span>
            </span>
            <span className="font-medium tabular-nums">{formatFCFA(s.value)}</span>
            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
              {total > 0 ? Math.round((s.value / total) * 100) : 0} %
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
