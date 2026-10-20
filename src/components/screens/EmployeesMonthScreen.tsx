import React from 'react'

import { useStore } from '@/data/store'
import { currentPeriod, dayMonth, daysUntil, dueDateOf, ofMonth, payrollOf, type PayMonthRow } from '@/data/payroll'
import type { Person } from '@/data/mockData'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ColumnTable, type Column } from '@/components/column-table'
import { MonthDialog } from '@/components/modals/MonthDialog'
import { cn, formatFCFA } from '@/lib/utils'

// Les paies du mois de tous les employés : chaque employé a son jour de paie (échéance) ; la paie
// d'octobre est celle dont l'échéance tombe en octobre. Deux cartes (salaires du mois, reste à verser)
// et le même tableau que sur la fiche, avec les colonnes « Employé » et « Échéance » en plus.
// Une paie dont l'échéance n'est pas encore arrivée est « à venir » : elle n'est pas encore à verser.

export type MonthLine = { emp: Person; row: PayMonthRow; planned: number; owed: number; before: number; upcoming: number }

// Une ligne par employé qui a un salaire ce mois-ci (actif, ou parti en cours de mois)
export function monthLines(persons: Person[], movements: Parameters<typeof payrollOf>[1], monthStates: Parameters<typeof payrollOf>[2]): MonthLine[] {
  const cur = currentPeriod()
  return persons
    .filter(p => p.type === 'employee')
    .map(emp => {
      const pr = payrollOf(emp.id, movements, monthStates)
      const row = pr.months.find(m => m.period === cur)
      // owed : tout ce qu'on lui doit (comme sur sa fiche) ; before : ce qui reste des mois d'avant
      const before = pr.months.filter(m => m.period < cur).reduce((a, m) => a + m.reste, 0)
      // owed : ce qui est à verser maintenant (échéances passées) ; upcoming : la paie du mois pas encore échue
      const upcoming = row?.state === 'en_cours' ? row.reste + pr.plannedRetenue : 0
      return row ? { emp, row, planned: row.state === 'en_cours' ? pr.plannedRetenue : 0, owed: pr.dueReste, before, upcoming } : null
    })
    .filter((l): l is MonthLine => l !== null)
    .sort((a, b) => a.emp.name.localeCompare(b.emp.name, 'fr'))
}
// Employés à qui il reste quelque chose à verser maintenant (la pastille rouge) : échéance passée et
// pas tout payé (une paie à venir ne compte pas encore)
export const stillToPay = (l: MonthLine) => (l.row.state !== 'en_cours' && l.row.reste > 0) || l.before > 0

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
  { key: 'apayer', label: 'À payer', align: 'right', defaultOn: true, render: l => money(l.row.aPayer) },
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
  const [open, setOpen] = React.useState<string | null>(null) // employé dont on ouvre le mois
  const cur = currentPeriod()
  const lines = monthLines(persons, movements, monthStates)

  // Comme sur la fiche : la retenue d'avance prévue fait partie du salaire tant que le mois n'est pas clos
  const total = lines.reduce((a, l) => a + l.row.aPayer + l.planned, 0)
  // Reste : ce qui est à verser maintenant (échéances passées), comme sur les fiches et le tableau de bord
  const reste = lines.reduce((a, l) => a + l.owed, 0)
  const before = lines.reduce((a, l) => a + l.before, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="gap-1 py-4">
          <CardContent className="flex flex-col gap-1 px-4">
            <p className="text-xs text-muted-foreground">Salaires du mois</p>
            <p className="text-xl font-semibold tabular-nums">{formatFCFA(total)}</p>
            <Badge variant="outline" className="self-start tabular-nums">{lines.length} employé{lines.length > 1 ? 's' : ''}</Badge>
          </CardContent>
        </Card>
        <Card className="gap-1 py-4">
          <CardContent className="flex flex-col gap-1 px-4">
            <p className="text-xs text-muted-foreground">Reste à verser</p>
            <p className="text-xl font-semibold text-debt tabular-nums">{formatFCFA(reste)}</p>
            {before > 0 && <p className="text-xs text-muted-foreground tabular-nums">dont {formatFCFA(before)} des mois d'avant</p>}
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

      <MonthDialog empId={open ?? ''} period={open ? (lines.find(l => l.emp.id === open)?.row.period ?? cur) : null} open={open !== null} onOpenChange={o => !o && setOpen(null)} />
    </div>
  )
}


// Nombre d'employés pas encore payés en entier ce mois-ci : la pastille rouge du menu
export function useToPayCount() {
  const { persons, movements, monthStates } = useStore()
  return monthLines(persons, movements, monthStates).filter(stillToPay).length
}
