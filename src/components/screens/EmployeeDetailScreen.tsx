import React from 'react'
import { Coins, HandCoins, Pencil, Plus, UserMinus } from 'lucide-react'
import { Input } from '@/components/ui/input'

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
import { DeletePerson } from '@/components/delete-person'
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
  const { persons, movements, monthStates, openNewMovement, openDeparture, openMovementDetail, setAdvancePlan } = useStore()
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
  // Salaire encore dû, retenue prévue comprise (elle n'est coupée qu'à la clôture du mois)
  const salaryReste = pr.totalReste + pr.plannedRetenue
  // Façon de rendre : court, la valeur seule (« 15 000 FCFA / mois » ou « Direct »)
  const plan = emp.advanceDeductionPerPeriod && emp.advanceDeductionPerPeriod > 0
    ? `${formatFCFA(emp.advanceDeductionPerPeriod)} / mois`
    : 'Direct'

  // Versements sortis d'un mois arrêté ou annulé : combien, vers quoi, de quel mois
  const moved = new Map<string, { amount: number; to: 'avance' | 'rendu'; month: string }>()
  for (const r of pr.months)
    for (const p of r.movedParts) {
      const prev = moved.get(p.mov.id)
      moved.set(p.mov.id, { amount: (prev?.amount ?? 0) + p.amount, to: p.to, month: r.label })
    }
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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BalanceCard
              title="Je lui dois"
              Icon={Coins}
              tone="debt"
              remaining={salaryReste}
              paid={salaryPaid}
              onClick={() => setView('salaire')}
              note={pr.plannedRetenue > 0 ? `dont ${formatFCFA(pr.plannedRetenue)} retenus pour l'avance` : undefined}
            />
            <BalanceCard
              title="Avance à rendre"
              Icon={HandCoins}
              tone="credit"
              remaining={pr.advanceReste}
              paid={advRepaid}
              onClick={() => setView('avance')}
              paidLabel="rendu"
              note={pr.advanceReste > 0 && active ? `Façon de rendre : ${plan}` : undefined}
            />
          </div>
          {/* Parti : on peut encore lui verser ce qui reste, ou noter qu'il rend son avance */}
          {(active || salaryReste > 0 || pr.advanceReste > 0) && (
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
                <p className="text-2xl font-semibold text-debt tabular-nums">{formatFCFA(salaryReste)}</p>
                {pr.plannedRetenue > 0 && (
                  <p className="text-xs text-muted-foreground tabular-nums">dont {formatFCFA(pr.plannedRetenue)} retenus pour l'avance</p>
                )}
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
                Versements <span className="text-xs text-muted-foreground">{pr.payments.filter(m => m.type !== 'surplus_salaire').length}</span>
              </Button>
            </div>
            {(active || salaryReste > 0) && (
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
            <MovementHistory
              title="Versements"
              // Le « trop reçu » n'est pas un versement : on ne l'affiche pas comme une ligne à part.
              // Le versement concerné est barré, avec ce qu'il est devenu.
              movements={pr.payments.filter(m => m.type !== 'surplus_salaire')}
              onOpen={openMovementDetail}
              amountClass={() => 'text-debt'}
              struck={m => (moved.get(m.id)?.amount ?? 0) >= m.amount}
              sub={m => {
                const mv = moved.get(m.id)
                if (!mv) return undefined
                const what = mv.to === 'avance' ? 'passé en avance' : 'rendu'
                return (
                  <Badge variant="destructive">
                    {mv.amount >= m.amount ? `Mois ${mv.month} : ${what}` : `${formatFCFA(mv.amount)} ${what} (${mv.month})`}
                  </Badge>
                )
              }}
            />
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
                  {pr.plannedRetenue > 0 && (
                    <p className="text-xs text-muted-foreground tabular-nums">dont {formatFCFA(pr.plannedRetenue)} retenus ce mois-ci</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Dernier remboursement</p>
                  <p className="text-sm">{ago(pr.lastRepayment)}</p>
                </div>
              </div>
              <PlanRow value={emp.advanceDeductionPerPeriod || 0} label={plan} editable={active} onSave={v => setAdvancePlan(emp.id, v)} />
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

      {view === 'ensemble' && <DeletePerson personId={emp.id} />}
      <MonthDialog empId={emp.id} period={month} open={month !== null} onOpenChange={o => !o && setMonth(null)} />
    </div>
  )
}

// « Façon de rendre » : libellé à gauche, valeur à droite, crayon pour la changer (0 = direct).
function PlanRow({ value, label, editable, onSave }: { value: number; label: string; editable: boolean; onSave: (v: number) => void }) {
  const [editing, setEditing] = React.useState(false)
  const [str, setStr] = React.useState('')
  const fmt = (s: string) => (s ? Number(s).toLocaleString('fr-FR').replace(/\s/g, ' ') : '')
  if (!editing)
    return (
      <div className="flex items-center justify-between gap-2 border-t pt-2 text-sm">
        <span className="text-muted-foreground">Façon de rendre</span>
        <span className="flex items-center gap-1 font-medium tabular-nums">
          {label}
          {editable && (
            <Button
              variant="ghost"
              size="icon"
              className="-mr-2 size-7 text-muted-foreground"
              aria-label="Changer la façon de rendre"
              onClick={() => {
                setStr(value ? String(value) : '')
                setEditing(true)
              }}
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
        </span>
      </div>
    )
  return (
    <form
      className="flex flex-col gap-2 border-t pt-2"
      onSubmit={e => {
        e.preventDefault()
        onSave(parseInt(str, 10) || 0)
        setEditing(false)
      }}
    >
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Retenue / mois</span>
        <Input
          autoFocus
          inputMode="numeric"
          placeholder="0 = direct"
          value={fmt(str)}
          onChange={e => setStr(e.target.value.replace(/\D/g, '').slice(0, 9))}
          className="h-8 flex-1 text-right"
        />
      </label>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={() => setEditing(false)}>
          Fermer
        </Button>
        <Button type="submit" size="sm" className="flex-1">
          Enregistrer
        </Button>
      </div>
    </form>
  )
}
