import React from 'react'

import { useStore } from '@/data/store'
import { currentPeriod, ofMonth, payrollOf, type PayMonthRow } from '@/data/payroll'
import type { Person } from '@/data/mockData'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ColumnTable, type Column } from '@/components/column-table'
import { MonthDialog } from '@/components/modals/MonthDialog'
import { cn, formatFCFA } from '@/lib/utils'

// Le mois en cours de tous les employés : deux cartes (salaires du mois, reste à verser)
// et le même tableau que sur la fiche, avec une colonne « Employé » en plus.

export type MonthLine = { emp: Person; row: PayMonthRow; planned: number }

// Une ligne par employé qui a un salaire ce mois-ci (actif, ou parti en cours de mois)
export function monthLines(persons: Person[], movements: Parameters<typeof payrollOf>[1], monthStates: Parameters<typeof payrollOf>[2]): MonthLine[] {
  const cur = currentPeriod()
  return persons
    .filter(p => p.type === 'employee')
    .map(emp => {
      const pr = payrollOf(emp.id, movements, monthStates)
      const row = pr.months.find(m => m.period === cur)
      return row ? { emp, row, planned: pr.plannedRetenue } : null
    })
    .filter((l): l is MonthLine => l !== null)
    .sort((a, b) => a.emp.name.localeCompare(b.emp.name, 'fr'))
}
// Employés pas encore payés en entier ce mois-ci (la pastille rouge)
export const stillToPay = (l: MonthLine) => l.row.reste + l.planned > 0 && l.row.state !== 'annule'

const ETAT_STYLE: Record<string, string> = {
  Payé: 'text-credit',
  'En partie': 'text-debt',
  'Pas payé': 'text-destructive',
  Annulé: 'text-muted-foreground line-through',
}
const money = (v: number) => (v ? formatFCFA(v).replace(/\s?FCFA$/, '') : '—')

const COLUMNS: Column<MonthLine>[] = [
  { key: 'employe', label: 'Employé', fixed: true, render: l => <span className="block max-w-32 truncate font-medium">{l.emp.name}</span> },
  { key: 'base', label: 'Salaire de base', align: 'right', render: l => money(l.row.base) },
  { key: 'ajouts', label: 'Ajouts', align: 'right', render: l => (l.row.ajouts ? `+ ${money(l.row.ajouts)}` : '—') },
  { key: 'retenues', label: 'Retenues', align: 'right', render: l => (l.row.retenues ? `− ${money(l.row.retenues)}` : '—') },
  { key: 'apayer', label: 'À payer', align: 'right', defaultOn: true, render: l => money(l.row.aPayer) },
  { key: 'verse', label: 'Versé', align: 'right', render: l => money(l.row.verse) },
  { key: 'reste', label: 'Reste', align: 'right', defaultOn: true, render: l => <span className={l.row.reste ? 'text-debt' : ''}>{money(l.row.reste)}</span> },
  { key: 'etat', label: 'État', defaultOn: true, render: l => <span className={cn('text-xs font-medium', ETAT_STYLE[l.row.etat])}>{l.row.etat}</span> },
]

export const EmployeesMonthScreen: React.FC = () => {
  const { persons, movements, monthStates } = useStore()
  const [open, setOpen] = React.useState<string | null>(null) // employé dont on ouvre le mois
  const cur = currentPeriod()
  const lines = monthLines(persons, movements, monthStates)

  // Comme sur la fiche : la retenue d'avance prévue fait partie du salaire tant que le mois n'est pas clos
  const total = lines.reduce((a, l) => a + l.row.aPayer + l.planned, 0)
  const reste = lines.reduce((a, l) => a + l.row.reste + l.planned, 0)
  const planned = lines.reduce((a, l) => a + l.planned, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="gap-1 py-4">
          <CardContent className="flex flex-col gap-1 px-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Salaires du mois</p>
              <Badge variant="outline" className="tabular-nums">{lines.length} employé{lines.length > 1 ? 's' : ''}</Badge>
            </div>
            <p className="text-xl font-semibold tabular-nums">{formatFCFA(total)}</p>
          </CardContent>
        </Card>
        <Card className="gap-1 py-4">
          <CardContent className="flex flex-col gap-1 px-4">
            <p className="text-xs text-muted-foreground">Reste à verser</p>
            <p className="text-xl font-semibold text-debt tabular-nums">{formatFCFA(reste)}</p>
            {planned > 0 && <p className="text-xs text-muted-foreground tabular-nums">dont {formatFCFA(planned)} retenus pour l'avance</p>}
          </CardContent>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">Salaires {ofMonth(cur)}</p>
      <ColumnTable
        columns={COLUMNS}
        rows={lines}
        rowKey={l => l.emp.id}
        onRowClick={l => setOpen(l.emp.id)}
        empty="Aucun salaire ce mois-ci."
      />

      <MonthDialog empId={open ?? ''} period={open ? cur : null} open={open !== null} onOpenChange={o => !o && setOpen(null)} />
    </div>
  )
}


// Nombre d'employés pas encore payés en entier ce mois-ci : la pastille rouge du menu
export function useToPayCount() {
  const { persons, movements, monthStates } = useStore()
  return monthLines(persons, movements, monthStates).filter(stillToPay).length
}
