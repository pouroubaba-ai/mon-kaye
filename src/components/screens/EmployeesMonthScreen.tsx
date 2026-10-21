import React from 'react'

import { useStore } from '@/data/store'
import { dayMonth, daysUntil, dueDateOf, payrollOf, type PayMonthRow } from '@/data/payroll'
import type { Person } from '@/data/mockData'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ColumnTable, type Column } from '@/components/column-table'
import { MonthDialog } from '@/components/modals/MonthDialog'
import { cn, formatFCFA } from '@/lib/utils'

// Les salaires de tous les employés : chaque employé a son jour de paie (échéance) ; une période va
// d'une échéance à la suivante. On montre la période en cours de chacun (« à venir » tant que
// l'échéance n'est pas arrivée) et les périodes échues pas encore entièrement payées.
// « À payer » ne change jamais : c'est le salaire (base + ajouts). Les retenues baissent le reste.

export type MonthLine = { emp: Person; row: PayMonthRow }

export function monthLines(persons: Person[], movements: Parameters<typeof payrollOf>[1], monthStates: Parameters<typeof payrollOf>[2]): MonthLine[] {
  const out: MonthLine[] = []
  for (const emp of persons.filter(p => p.type === 'employee')) {
    const pr = payrollOf(emp.id, movements, monthStates)
    for (const row of [...pr.months].reverse())
      if (row.state !== 'annule' && (row.state === 'en_cours' || row.reste > 0)) out.push({ emp, row })
  }
  return out.sort((a, b) => a.emp.name.localeCompare(b.emp.name, 'fr') || a.row.period.localeCompare(b.row.period))
}

const ETAT_STYLE: Record<string, string> = {
  Payé: 'text-credit',
  'En partie': 'text-debt',
  'Pas payé': 'text-destructive',
  Annulé: 'text-muted-foreground line-through',
}
const money = (v: number) => (v ? formatFCFA(v).replace(/\s?FCFA$/, '') : '—')

const COLUMNS: Column<MonthLine>[] = [
  { key: 'employe', label: 'Employé', fixed: true, render: l => <span className="block max-w-32 truncate font-medium">{l.emp.name}</span> },
  {
    key: 'echeance',
    label: 'Échéance',
    defaultOn: true,
    render: l => {
      const d = dueDateOf(l.row.period, l.emp.id)
      const n = daysUntil(d)
      return (
        <span className="whitespace-nowrap">
          {dayMonth(d)}
          {l.row.state === 'en_cours' && <span className="text-xs text-muted-foreground">{n === 0 ? " · aujourd'hui" : n === 1 ? ' · demain' : ` · dans ${n} j`}</span>}
        </span>
      )
    },
  },
  { key: 'base', label: 'Salaire de base', align: 'right', render: l => money(l.row.base) },
  { key: 'ajouts', label: 'Ajouts', align: 'right', render: l => (l.row.ajouts ? `+ ${money(l.row.ajouts)}` : '—') },
  { key: 'retenues', label: 'Retenues', align: 'right', render: l => (l.row.retenues ? `− ${money(l.row.retenues)}` : '—') },
  { key: 'apayer', label: 'À payer', align: 'right', defaultOn: true, render: l => money(l.row.brut) },
  { key: 'verse', label: 'Versé', align: 'right', render: l => money(l.row.verse) },
  { key: 'reste', label: 'Reste', align: 'right', defaultOn: true, render: l => <span className={l.row.reste ? 'text-debt' : ''}>{money(l.row.reste)}</span> },
  {
    key: 'etat',
    label: 'État',
    defaultOn: true,
    render: l =>
      l.row.state === 'en_cours' && l.row.reste > 0 ? (
        <span className="text-xs font-medium text-muted-foreground">{l.row.verse > 0 ? 'À venir (en partie)' : 'À venir'}</span>
      ) : (
        <span className={cn('text-xs font-medium', ETAT_STYLE[l.row.etat])}>{l.row.etat}</span>
      ),
  },
]

export const EmployeesMonthScreen: React.FC = () => {
  const { persons, movements, monthStates } = useStore()
  const [open, setOpen] = React.useState<MonthLine | null>(null) // ligne dont on ouvre la période
  const lines = monthLines(persons, movements, monthStates)
  const current = lines.filter(l => l.row.state === 'en_cours')

  // Salaires des périodes en cours (le salaire, sans les retenues)
  const total = current.reduce((a, l) => a + l.row.brut, 0)
  // Total des retenues des périodes en cours (retenues d'avance et autres retenues)
  const retenues = current.reduce((a, l) => a + l.row.retenues, 0)

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-1 py-4">
        <CardContent className="flex flex-col gap-1 px-4">
          <p className="text-xs text-muted-foreground">Salaires du mois</p>
          <p className="text-xl font-semibold tabular-nums text-debt">{formatFCFA(total)}</p>
          {retenues > 0 && (
            <p className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground tabular-nums">
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: 'var(--color-debt)' }} />
              Retenues {formatFCFA(retenues).replace(/\s?FCFA$/, '')}
            </p>
          )}
          <Badge variant="outline" className="self-start tabular-nums">{current.length} employé{current.length > 1 ? 's' : ''}</Badge>
        </CardContent>
      </Card>

      <ColumnTable
        columns={COLUMNS}
        rows={lines}
        rowKey={l => `${l.emp.id}|${l.row.period}`}
        onRowClick={l => setOpen(l)}
        empty="Aucun salaire ce mois-ci."
      />

      <MonthDialog empId={open?.emp.id ?? ''} period={open?.row.period ?? null} open={open !== null} onOpenChange={o => !o && setOpen(null)} />
    </div>
  )
}


// Nombre d'employés pas encore payés en entier ce mois-ci : la pastille rouge du menu
export function useToPayCount() {
  const { persons, movements, monthStates } = useStore()
  // Employés en cours : ceux dont un salaire n'est pas entièrement versé (à venir ou déjà échu)
  return new Set(monthLines(persons, movements, monthStates).filter(l => l.row.reste > 0).map(l => l.emp.id)).size
}
