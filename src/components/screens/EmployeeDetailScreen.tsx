import React from 'react'
import { Coins, HandCoins, Plus, Scale, UserMinus } from 'lucide-react'

import { useStore } from '@/data/store'
import { payrollOf, type AdvanceRow, type PayMonthRow } from '@/data/payroll'
import { daysSince } from '@/data/payHistory'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MovementHistory } from '@/components/movement-history'
import { PersonHeader } from '@/components/person-header'
import { BalanceCard } from '@/components/balance-card'
import { ColumnTable, type Column } from '@/components/column-table'
import { MonthDialog } from '@/components/modals/MonthDialog'
import { cn, formatFCFA } from '@/lib/utils'

// Fiche employé : trois onglets au même niveau, comme la fiche d'une personne.
// - Vue d'ensemble : les deux cartes (Je lui dois, Avance à rendre) ; les toucher ouvre leur onglet.
// - Salaire : en haut, ce qui concerne tout le salaire (reste à payer, dernier versement) ;
//   pastilles « Mois » (tableau, une ligne par mois) et « Versements » (liste de tous les versements).
// - Avance : en haut, reste à rendre, façon de rendre, dernier remboursement ;
//   pastilles « Avances » (tableau, une ligne par avance) et « Remboursements ».

const TAB = 'gap-1 px-1.5 text-[13px] min-[400px]:text-sm'
const ago = (d?: string) => {
  const n = d ? daysSince(d) : null
  return n === null || n === undefined ? '—' : n === 0 ? "aujourd'hui" : n === 1 ? 'hier' : `il y a ${n} j`
}

const ETAT_STYLE: Record<string, string> = {
  Payé: 'text-credit',
  Soldée: 'text-credit',
  'En partie': 'text-debt',
  'En cours': 'text-debt',
  'Pas payé': 'text-destructive',
  Annulé: 'text-muted-foreground line-through',
  Annulée: 'text-muted-foreground line-through',
}
const Etat = ({ v }: { v: string }) => <span className={cn('text-xs font-medium', ETAT_STYLE[v])}>{v}</span>
const money = (v: number) => (v ? formatFCFA(v).replace(/\s?FCFA$/, '') : '—')

const MONTH_COLUMNS: Column<PayMonthRow>[] = [
  { key: 'mois', label: 'Mois', fixed: true, render: r => <span className="font-medium">{r.label}{r.state === 'en_cours' ? ' •' : ''}</span> },
  { key: 'base', label: 'Salaire de base', align: 'right', render: r => money(r.base) },
  { key: 'ajouts', label: 'Ajouts', align: 'right', render: r => (r.ajouts ? `+ ${money(r.ajouts)}` : '—') },
  { key: 'retenues', label: 'Retenues', align: 'right', render: r => (r.retenues ? `− ${money(r.retenues)}` : '—') },
  { key: 'apayer', label: 'À payer', align: 'right', defaultOn: true, render: r => money(r.aPayer) },
  { key: 'verse', label: 'Versé', align: 'right', render: r => money(r.verse) },
  { key: 'reste', label: 'Reste', align: 'right', defaultOn: true, render: r => <span className={r.reste ? 'text-debt' : ''}>{money(r.reste)}</span> },
  { key: 'etat', label: 'État', defaultOn: true, render: r => <Etat v={r.etat} /> },
]

const ADVANCE_COLUMNS: Column<AdvanceRow>[] = [
  { key: 'date', label: 'Date', fixed: true, render: r => <span className="font-medium">{r.mov.date}</span> },
  { key: 'montant', label: 'Montant', align: 'right', defaultOn: true, render: r => money(r.mov.amount) },
  { key: 'rendu', label: 'Rendu', align: 'right', render: r => money(r.rendu) },
  { key: 'reste', label: 'Reste', align: 'right', defaultOn: true, render: r => <span className={r.reste ? 'text-credit' : ''}>{money(r.reste)}</span> },
  { key: 'etat', label: 'État', defaultOn: true, render: r => <Etat v={r.etat} /> },
  { key: 'note', label: 'Note', render: r => <span className="block max-w-40 truncate text-muted-foreground">{r.mov.note || r.mov.label}</span> },
]

export const EmployeeDetailScreen: React.FC<{ employeeId: string }> = ({ employeeId }) => {
  const { persons, movements, monthStates, openNewMovement, openDeparture, openMovementDetail } = useStore()
  const [view, setView] = React.useState<'ensemble' | 'salaire' | 'avance'>('ensemble')
  const [salaryList, setSalaryList] = React.useState<'mois' | 'versements'>('mois')
  const [advList, setAdvList] = React.useState<'avances' | 'remboursements'>('avances')
  const [month, setMonth] = React.useState<string | null>(null)

  const emp = persons.find(p => p.id === employeeId)
  if (!emp) return null
  const active = emp.status === 'actif'
  const pr = payrollOf(emp.id, movements, monthStates)

  // Cartes : sur ce qui est encore ouvert (mois pas soldés, avances en cours)
  const openMonths = pr.months.filter(m => m.reste > 0 || m.state === 'en_cours')
  const salaryPaid = openMonths.reduce((a, m) => a + m.verse, 0)
  const openAdv = pr.advances.filter(a => a.etat === 'En cours')
  const advRepaid = openAdv.reduce((a, r) => a + r.rendu, 0)
  const net = pr.totalReste - pr.advanceReste
  const plan = emp.advanceDeductionPerPeriod && emp.advanceDeductionPerPeriod > 0
    ? `Retenue de ${formatFCFA(emp.advanceDeductionPerPeriod)} par mois`
    : 'Il rend directement'

  const chip = (on: boolean) => (on ? 'secondary' : 'ghost') as 'secondary' | 'ghost'

  return (
    <div className="flex flex-col gap-4">
      <PersonHeader person={emp} badge={<Badge variant={active ? 'outline' : 'secondary'}>{active ? 'Actif' : 'Parti'}</Badge>} />

      <Tabs value={view} onValueChange={v => setView(v as typeof view)}>
        <TabsList className="w-full">
          <TabsTrigger value="ensemble" className={TAB}>Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="salaire" className={TAB}><Coins className="text-debt max-[359px]:hidden" /> Salaire</TabsTrigger>
          <TabsTrigger value="avance" className={TAB}><HandCoins className="text-credit max-[359px]:hidden" /> Avance</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === 'ensemble' && (
        <>
          {pr.totalReste > 0 && pr.advanceReste > 0 && (
            <div
              className="flex items-center gap-3 rounded-xl border p-3"
              style={{
                background: `color-mix(in srgb, ${net >= 0 ? 'var(--color-debt)' : 'var(--color-credit)'} 12%, var(--card))`,
                borderColor: `color-mix(in srgb, ${net >= 0 ? 'var(--color-debt)' : 'var(--color-credit)'} 35%, transparent)`,
              }}
            >
              <Scale className={net >= 0 ? 'size-5 shrink-0 text-debt' : 'size-5 shrink-0 text-credit'} />
              <p className="min-w-0 flex-1 text-sm">
                {net > 0 && <>Avance déduite, <span className="font-semibold text-debt">vous lui devez {formatFCFA(net)}</span></>}
                {net < 0 && <>Salaire déduit, <span className="font-semibold text-credit">il vous doit {formatFCFA(-net)}</span></>}
                {net === 0 && <span className="font-semibold">Salaire et avance s'annulent</span>}
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <BalanceCard title="Je lui dois" Icon={Coins} tone="debt" remaining={pr.totalReste} paid={salaryPaid} onClick={() => setView('salaire')} />
            <BalanceCard
              title="Avance à rendre"
              Icon={HandCoins}
              tone="credit"
              remaining={pr.advanceReste}
              paid={advRepaid}
              onClick={() => setView('avance')}
              note={pr.advanceReste > 0 ? plan : undefined}
            />
          </div>
          {active && (
            <Button size="lg" className="h-12" onClick={() => openNewMovement(emp.id)}>
              <Plus /> Enregistrer une opération
            </Button>
          )}
          {active && (
            <Button variant="ghost" className="self-start text-destructive" onClick={() => openDeparture(emp.id)}>
              <UserMinus /> L'employé quitte la boutique
            </Button>
          )}
        </>
      )}

      {view === 'salaire' && (
        <>
          {/* Ce qui concerne tout le salaire : une seule fois, en haut */}
          <Card className="py-4">
            <CardContent className="flex items-end justify-between gap-3 px-4">
              <div>
                <p className="text-xs text-muted-foreground">Reste à payer</p>
                <p className="text-2xl font-semibold text-debt tabular-nums">{formatFCFA(pr.totalReste)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Dernier versement</p>
                <p className="text-sm">{ago(pr.lastPayment)}</p>
              </div>
            </CardContent>
          </Card>
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1">
              <Button size="sm" variant={chip(salaryList === 'mois')} className="rounded-full" onClick={() => setSalaryList('mois')}>
                Mois <span className="text-xs text-muted-foreground">{pr.months.length}</span>
              </Button>
              <Button size="sm" variant={chip(salaryList === 'versements')} className="rounded-full" onClick={() => setSalaryList('versements')}>
                Versements <span className="text-xs text-muted-foreground">{pr.payments.length}</span>
              </Button>
            </div>
            {active && (
              <Button size="sm" onClick={() => openNewMovement(emp.id, 'je_lui_ai_verse')}>
                <Plus /> Verser
              </Button>
            )}
          </div>
          {salaryList === 'mois' ? (
            <ColumnTable
              columns={MONTH_COLUMNS}
              rows={pr.months}
              rowKey={r => r.period}
              onRowClick={r => setMonth(r.period)}
              rowClassName={r => (r.state === 'en_cours' ? 'bg-muted/30' : undefined)}
              empty="Aucun mois pour l'instant."
            />
          ) : (
            <MovementHistory title="Versements" movements={pr.payments} onOpen={openMovementDetail} amountClass={() => 'text-debt'} />
          )}
        </>
      )}

      {view === 'avance' && (
        <>
          <Card className="py-4">
            <CardContent className="flex flex-col gap-3 px-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Reste à rendre</p>
                  <p className="text-2xl font-semibold text-credit tabular-nums">{formatFCFA(pr.advanceReste)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Dernier remboursement</p>
                  <p className="text-sm">{ago(pr.lastRepayment)}</p>
                </div>
              </div>
              <p className="border-t pt-2 text-sm">
                <span className="text-muted-foreground">Façon de rendre : </span>
                {plan}
              </p>
            </CardContent>
          </Card>
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1">
              <Button size="sm" variant={chip(advList === 'avances')} className="rounded-full" onClick={() => setAdvList('avances')}>
                Avances <span className="text-xs text-muted-foreground">{pr.advances.length}</span>
              </Button>
              <Button size="sm" variant={chip(advList === 'remboursements')} className="rounded-full" onClick={() => setAdvList('remboursements')}>
                Remboursements <span className="text-xs text-muted-foreground">{pr.repayments.length}</span>
              </Button>
            </div>
            {active && (
              <Button size="sm" onClick={() => openNewMovement(emp.id, 'avance_salaire')}>
                <Plus /> Avance
              </Button>
            )}
          </div>
          {advList === 'avances' ? (
            <ColumnTable
              columns={ADVANCE_COLUMNS}
              rows={pr.advances}
              rowKey={r => r.mov.id}
              onRowClick={r => openMovementDetail(r.mov)}
              empty="Aucune avance."
            />
          ) : (
            <MovementHistory title="Remboursements" movements={pr.repayments} onOpen={openMovementDetail} amountClass={() => 'text-credit'} />
          )}
        </>
      )}

      <MonthDialog empId={emp.id} period={month} open={month !== null} onOpenChange={o => !o && setMonth(null)} />
    </div>
  )
}
