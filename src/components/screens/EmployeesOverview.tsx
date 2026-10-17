import React from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ArrowDownWideNarrow, ArrowUpDown, ArrowUpNarrowWide, Check, ChevronsUpDown } from 'lucide-react'

import { useStore } from '@/data/store'
import type { Person } from '@/data/mockData'
import { buildPayHistory, daysSince } from '@/data/payHistory'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn, formatFCFA } from '@/lib/utils'

// Vue d'ensemble des employés.
// En haut : choix d'un employé (liste avec recherche, modèle shadcn « Combobox ») ;
// « Tous les employés » par défaut. Le choix s'applique aux trois cartes.
// 1. Salaires : barres empilées (gris = versé, orange = reste dû), par mois ou par année.
// 2. Avances : jours depuis le dernier remboursement + montant que l'employé doit encore.
// 3. Salaires en retard : jours depuis le dernier salaire versé + montant que je dois encore.
// Listes longues : au-delà de 7 employés, on montre les 5 premiers et un bouton « Voir plus ».

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const SHOW_FIRST = 5
const LONG_LIST = 7

const payConfig = {
  paid: { label: 'Versé', color: 'color-mix(in oklch, var(--foreground) 35%, transparent)' },
  unpaid: { label: 'Reste dû', color: 'var(--color-debt)' },
} satisfies ChartConfig

const countLabel = (n: number) => `${n} ${n > 1 ? 'employés' : 'employé'}`

const short = (v: number) => (v >= 1_000_000 ? `${Math.round(v / 100_000) / 10} M` : v >= 1000 ? `${Math.round(v / 1000)} k` : String(v))

function EmployeePicker({ employees, value, onChange }: { employees: Person[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const current = employees.find(e => e.id === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className="truncate">{current ? current.name : 'Tous les employés'}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Chercher un employé" />
          <CommandList>
            <CommandEmpty>Aucun employé trouvé.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="Tous les employés" onSelect={() => { onChange('tous'); setOpen(false) }}>
                Tous les employés
                <Check className={cn('ml-auto', value === 'tous' ? 'opacity-100' : 'opacity-0')} />
              </CommandItem>
              {employees.map(e => (
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

type DayRow = { id: string; name: string; days: number; amount: number }

// Liste en barres : nom + montant sur une ligne, barre des jours en dessous.
type SortKey = 'days-desc' | 'days-asc' | 'amount-desc' | 'amount-asc'

function DaysCard({
  title,
  rows: rawRows,
  tone,
  amountLabel,
  empty,
  totalLabel,
  showCount,
}: {
  title: string
  rows: DayRow[]
  tone: 'credit' | 'debt'
  amountLabel: string
  empty: string
  totalLabel?: string
  showCount?: boolean
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
            {showCount && <span className="text-xs text-muted-foreground">{countLabel(rawRows.length)}</span>}
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

export const EmployeesOverview: React.FC = () => {
  const { persons } = useStore()
  const isMobile = useIsMobile()
  const employees = persons.filter(p => p.type === 'employee')
  const [who, setWho] = React.useState('tous')
  const selected = who === 'tous' ? employees : employees.filter(e => e.id === who)

  const history = buildPayHistory(selected)
  const years = [...new Set(history.map(h => h.year))]
  const [period, setPeriod] = React.useState<string>(String(new Date().getFullYear()))
  const activePeriod = period === 'tout' || years.includes(Number(period)) ? period : String(years[years.length - 1] ?? '')

  const payData =
    activePeriod === 'tout'
      ? years.map(y => {
          const rows = history.filter(h => h.year === y)
          const due = rows.reduce((a, r) => a + r.due, 0)
          const paid = rows.reduce((a, r) => a + r.paid, 0)
          return { label: String(y), paid, unpaid: due - paid }
        })
      : MONTHS.map((name, i) => {
          const r = history.find(h => h.year === Number(activePeriod) && h.month === i)
          return { label: name, paid: r?.paid ?? 0, unpaid: r ? r.due - r.paid : 0 }
        })

  // Nombre d'employés concernés par chaque total de la période choisie.
  const inPeriod = (y: number) => activePeriod === 'tout' || y === Number(activePeriod)
  const perEmployee = selected.map(e => buildPayHistory([e]).filter(r => inPeriod(r.year)))
  const countTotal = perEmployee.filter(rows => rows.some(r => r.due > 0)).length
  const countUnpaid = perEmployee.filter(rows => rows.some(r => r.due - r.paid > 0)).length
  const showCount = who === 'tous'

  const total = payData.reduce((a, d) => a + d.paid + d.unpaid, 0)
  const totalUnpaid = payData.reduce((a, d) => a + d.unpaid, 0)

  const advanceRows: DayRow[] = selected
    .filter(p => (p.advanceBalance || 0) > 0)
    .map(p => ({ id: p.id, name: p.name, days: daysSince(p.lastAdvanceRepaymentDate) ?? 0, amount: p.advanceBalance || 0 }))
    .sort((a, b) => b.days - a.days)

  const salaryRows: DayRow[] = selected
    .filter(p => p.status === 'actif' && (p.currentSalaryDue || 0) > 0)
    .map(p => ({ id: p.id, name: p.name, days: daysSince(p.lastSalaryPaymentDate) ?? 0, amount: p.currentSalaryDue || 0 }))
    .sort((a, b) => b.days - a.days)

  return (
    <div className="flex flex-col gap-4">
      <EmployeePicker employees={employees} value={who} onChange={setWho} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">Salaires</CardTitle>
          <CardAction>
            <Select value={activePeriod} onValueChange={setPeriod}>
              <SelectTrigger size="sm" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {[...years].reverse().map(y => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
                <SelectItem value="tout">Tout</SelectItem>
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="text-lg font-semibold tabular-nums">{formatFCFA(total)}</span>
              {showCount && <span className="text-xs text-muted-foreground">{countLabel(countTotal)}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2.5 rounded-full bg-debt" /> Reste dû
              </span>
              <span className="text-lg font-semibold tabular-nums text-debt">{formatFCFA(totalUnpaid)}</span>
              {showCount && <span className="text-xs text-muted-foreground">{countLabel(countUnpaid)}</span>}
            </div>
          </div>

          <ChartContainer config={payConfig} className="aspect-auto h-[220px] w-full">
            <BarChart data={payData} margin={{ left: 0, right: 0, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={0}
                fontSize={11}
                tickFormatter={(v: string) => (isMobile && activePeriod !== 'tout' ? v.charAt(0) : v)}
              />
              <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={short} fontSize={11} />
              <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.4 }} content={<ChartTooltipContent formatter={formatFCFA} />} />
              <Bar dataKey="paid" stackId="s" fill="var(--color-paid)" radius={[0, 0, 4, 4]} />
              <Bar dataKey="unpaid" stackId="s" fill="var(--color-unpaid)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <DaysCard
        title="Dernier remboursement"
        totalLabel="Avances à rendre"
        showCount={who === 'tous'}
        rows={advanceRows}
        tone="credit"
        amountLabel="Avance à rendre"
        empty="Aucune avance en cours."
      />
      <DaysCard
        title="Dernier versement"
        rows={salaryRows}
        tone="debt"
        amountLabel="Salaire que je dois"
        empty="Aucun salaire en retard."
      />
    </div>
  )
}
