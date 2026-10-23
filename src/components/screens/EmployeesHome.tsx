import React from 'react'
import { Banknote, Check, ChevronDown, ChevronRight, Eye, EyeOff, Plus, Search, X } from 'lucide-react'

import { useStore } from '@/data/store'
import { HomeTop } from '@/components/screens/HomeScreen'
import { NewEmployeeDialog } from '@/components/modals/NewEmployeeDialog'
import { PaySalaryDialog } from '@/components/modals/PaySalaryDialog'
import { daysSince } from '@/data/payHistory'
import { cn, matchesPerson } from '@/lib/utils'
import { amt, initials } from '@/modules/personnes/view'
import { dueRows, empLine, inDays, monthName, shortDate, type EmpLine } from '@/modules/employes/view'

// ——— Employés « Kayé simple » ———
// Deux onglets avec leur montant : Salaires à payer (rouge) / Avances à rendre (vert), une recherche,
// + Nouvel employé, la liste, et en bas « Verser un salaire » (ou « + Avance » / « Il rend »).

export const EmployeesHome: React.FC = () => {
  const { persons, movements, monthStates, setSelectedPersonId, openNewMovement } = useStore()
  const [tab, setTab] = React.useState<'salaires' | 'avances'>('salaires')
  const [showCur, setShowCur] = React.useState(false) // « Salaires à payer » touché une deuxième fois : la paie en cours
  const [search, setSearch] = React.useState('')
  const [adding, setAdding] = React.useState(false)
  const [paying, setPaying] = React.useState(false)
  const [showOld, setShowOld] = React.useState(false)

  const lines = persons.filter(p => p.type === 'employee').map(p => empLine(p, movements, monthStates))
  const salaryDue = lines.reduce((a, l) => a + l.due, 0)
  const nDue = lines.filter(l => l.due > 0).length
  const advTotal = lines.reduce((a, l) => a + l.pr.advanceReste, 0)
  const nAdv = lines.filter(l => l.pr.advanceReste > 0).length
  const salaires = tab === 'salaires'
  // Paie en cours de tous les employés actifs (retenues déjà enlevées)
  const curLines = lines.filter(l => l.emp.status !== 'inactif' && l.upcoming > 0)
  const curTotal = curLines.reduce((a, l) => a + l.upcoming, 0)
  const nCur = curLines.length
  // Avances : retenues prévues sur les paies en cours
  const cutLines = lines.filter(l => l.emp.status !== 'inactif' && l.pr.plannedRetenue > 0)
  const cutTotal = cutLines.reduce((a, l) => a + l.pr.plannedRetenue, 0)
  const nCut = cutLines.length
  // Jusqu'au dernier jour de paie parmi eux : « d'ici 23 jours »
  const until = (ls: EmpLine[]) => {
    if (!ls.length) return ''
    const n = Math.max(...ls.map(l => l.days))
    return n <= 0 ? "aujourd'hui" : n === 1 ? "d'ici demain" : `d'ici ${n} jours`
  }
  // Salaires : les paies terminées de tous les employés (la paie en cours n'est pas encore due)
  const salTotal = lines.reduce((a, l) => a + l.pr.months.filter(m => m.state !== 'en_cours' && m.state !== 'annule').reduce((x, m) => x + m.aPayer, 0), 0)
  // Avances : toutes les avances prises (annulées exclues)
  const advAll = lines.reduce((a, l) => a + l.pr.advances.filter(x => x.etat !== 'Annulée').reduce((y, x) => y + x.mov.amount, 0), 0)
  const searching = search.trim() !== ''
  const match = (l: EmpLine) => matchesPerson(l.emp, search)

  // Salaires : ceux qui sont payés aujourd'hui ou en retard d'abord, puis par jour de paie
  const active = lines.filter(l => l.emp.status !== 'inactif' && match(l)).sort((a, b) => b.due - a.due || a.days - b.days || a.emp.name.localeCompare(b.emp.name, 'fr'))
  const gone = lines.filter(l => l.emp.status === 'inactif' && match(l))
  const goneOwed = gone.filter(l => l.due > 0)
  const goneDone = gone.filter(l => l.due === 0)
  const advLines = lines.filter(l => l.pr.advanceReste > 0 && match(l)).sort((a, b) => b.pr.advanceReste - a.pr.advanceReste)

  const row = (l: EmpLine, sub: React.ReactNode, value: React.ReactNode, last: boolean, opts: { dim?: boolean; gone?: boolean } = {}) => (
    <button
      key={l.emp.id}
      type="button"
      onClick={() => setSelectedPersonId(l.emp.id)}
      className={cn('flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-muted/40', !last && 'border-b border-border', opts.dim && 'opacity-55')}
    >
      <span className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">{initials(l.emp.name)}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className={cn('truncate text-base font-semibold', opts.gone && 'text-muted-foreground')}>{l.emp.name}</span>
          {opts.gone && <span className="shrink-0 rounded-full bg-muted px-2 py-px text-[11px] font-semibold text-muted-foreground">Parti</span>}
        </span>
        <span className="truncate text-[13px] text-muted-foreground">{sub}</span>
      </span>
      {value}
    </button>
  )

  // Le texte et le montant d'un employé dans « Salaires à payer »
  const salaryRow = (l: EmpLine, last: boolean, gone = false) => {
    const day = shortDate(l.dueDate) // « 13 nov. » : le jour et le mois
    if (l.due > 0) {
      const late = dueRows(l.pr)
      const first = late[0]
      const what = gone
        ? 'Reste de sa dernière paie'
        : late.length > 1
          ? `${late.length} paies en retard`
          : first
            ? `${first.verse > 0 ? 'Reste' : 'Paie'} ${/^[aeiouéâ]/i.test(monthName(first.period)) ? "d'" : 'de '}${monthName(first.period)}`
            : 'À payer'
      const then = !gone && l.upcoming > 0 ? ` · puis ${amt(l.upcoming)} le ${day}` : ''
      return row(l, what + then, <span className="shrink-0 text-base font-bold text-kred tabular-nums">{amt(l.due)}</span>, last, { gone })
    }
    if (l.upcoming > 0)
      return row(
        l,
        <span className={l.days <= 3 ? 'font-semibold text-kgold' : undefined}>
          Paie le {day} · {inDays(l.days)}
        </span>,
        // Rien de dû aujourd'hui : 0 (le montant de la prochaine paie n'est pas une dette)
        <span className="shrink-0 text-base font-semibold text-muted-foreground tabular-nums">0</span>,
        last
      )
    return row(l, `${l.emp.sex === 'f' ? 'Payée' : 'Payé'} pour ${monthName(l.pr.currentPeriod)}`, <Check className="size-[22px] shrink-0 text-kgreen" strokeWidth={2.6} aria-label="Payé" />, last, { dim: true })
  }

  const advRow = (l: EmpLine, last: boolean) => {
    const per = l.emp.advanceDeductionPerPeriod || 0
    let sub: React.ReactNode = `Retenu ${amt(per)} par mois sur sa paie`
    if (!per) {
      const lastRepay = l.pr.lastRepayment
      const firstAdv = l.pr.advances.filter(a => a.reste > 0).map(a => a.mov.date).pop()
      const n = daysSince(lastRepay ?? firstAdv)
      sub = `${l.emp.sex === 'f' ? 'Elle' : 'Il'} rend ${l.emp.sex === 'f' ? 'elle' : 'lui'}-même${n !== null ? ` · pas versé depuis ${n} j` : ''}`
    }
    return row(l, sub, <span className="shrink-0 text-base font-bold text-kgreen tabular-nums">{amt(l.pr.advanceReste)}</span>, last, { gone: l.emp.status === 'inactif' })
  }

  const mainList = [...active, ...goneOwed]

  return (
    <div className="flex min-h-dvh flex-col">
      <HomeTop />

      <nav aria-label="Comptes des employés" className="grid grid-cols-2 border-b">
        {(
          [
            ['salaires', 'Salaires à payer', salaryDue, `dû à ${nDue} employé${nDue > 1 ? 's' : ''}`],
            ['avances', 'Avances à rendre', advTotal, `${nAdv} employé${nAdv > 1 ? 's' : ''}`],
          ] as const
        ).map(([t, label, value, sub]) => {
          const on = tab === t
          const red = t === 'salaires'
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              onClick={() => (on ? setShowCur(c => !c) : (setTab(t), setShowCur(false)))}
              className={cn('flex flex-col items-center gap-0.5 border-b-[3px] px-2 py-3', on ? (red ? 'border-kred bg-kred/10' : 'border-kgreen bg-kgreen/10') : 'border-transparent opacity-75')}
            >
              <span className={cn('text-sm font-semibold', on ? (red ? 'text-kred' : 'text-kgreen') : 'text-muted-foreground')}>{label}</span>
              <span className={cn('flex items-center gap-1.5 text-2xl font-bold tracking-tight tabular-nums', red ? 'text-kred' : 'text-kgreen')}>
                {amt(value)}
                {on && (showCur ? <EyeOff className="size-4 opacity-70" /> : <Eye className="size-4 opacity-70" />)}
              </span>
              <span className="text-xs text-muted-foreground">{sub}</span>
            </button>
          )
        })}
      </nav>

      {/* Onglet touché une deuxième fois : Total, Versé, Reste ; et, pour les salaires, la paie en cours */}
      {showCur && (
        <div className="border-b animate-in fade-in slide-in-from-top-1 duration-200">
          <div className={cn('grid grid-cols-3 px-4 py-3', salaires ? 'bg-kred/5' : 'bg-kgreen/5')}>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="text-base font-bold tabular-nums">{amt(salaires ? salTotal : advAll)}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 border-x">
              <span className="text-xs text-muted-foreground">Versé</span>
              <span className="text-base font-bold text-kblue tabular-nums">{amt(salaires ? salTotal - salaryDue : advAll - advTotal)}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs text-muted-foreground">Reste</span>
              <span className={cn('text-base font-bold tabular-nums', salaires ? 'text-kred' : 'text-kgreen')}>{amt(salaires ? salaryDue : advTotal)}</span>
            </div>
          </div>
          {!salaires && (
            // Avances : ce qui sera retenu sur les paies en cours, à leur jour de paie
            <div className="flex items-center justify-between gap-3 border-t bg-kgold/5 px-5 py-3">
              <span className="flex flex-col">
                <span className="text-sm font-semibold">Retenues en cours</span>
                <span className="text-xs text-muted-foreground">
                  À retenir sur la paie de {nCut} employé{nCut > 1 ? 's' : ''} {until(cutLines)}
                </span>
              </span>
              <span className="text-xl font-bold text-kgold tabular-nums">{amt(cutTotal)}</span>
            </div>
          )}
          {salaires && (
            <div className="flex items-center justify-between gap-3 border-t bg-kgold/5 px-5 py-3">
              <span className="flex flex-col">
                <span className="text-sm font-semibold">Paie en cours</span>
                <span className="text-xs text-muted-foreground">
                  À donner à {nCur} employé{nCur > 1 ? 's' : ''} {until(curLines)}
                </span>
              </span>
              <span className="text-xl font-bold text-kgold tabular-nums">{amt(curTotal)}</span>
            </div>
          )}
        </div>
      )}

      <label className="mx-4 mt-3 flex h-[46px] items-center gap-2.5 rounded-xl bg-muted px-3.5 text-muted-foreground">
        <Search className="size-[18px] shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Chercher un employé" aria-label="Chercher un employé" className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground" />
        {searching && (
          <button type="button" aria-label="Effacer la recherche" onClick={() => setSearch('')} className="flex size-7 items-center justify-center rounded-full hover:bg-background">
            <X className="size-4" />
          </button>
        )}
      </label>

      <div className="flex flex-1 flex-col px-3 pt-1 pb-[calc(7rem+env(safe-area-inset-bottom))]">
        {salaires ? (
          <>
            {(
              <button type="button" onClick={() => setAdding(true)} className="my-1 flex h-[52px] items-center justify-center gap-2 rounded-[14px] border border-dashed border-foreground/25 text-[15px] font-semibold text-muted-foreground hover:bg-muted/40">
                <Plus className="size-5" strokeWidth={2.4} /> Nouvel employé
              </button>
            )}
            {mainList.length === 0 && <p className="px-2 py-8 text-center text-sm text-muted-foreground">{searching ? "Personne ne s'appelle comme ça." : 'Ajoutez votre premier employé.'}</p>}
            {mainList.map((l, i) => salaryRow(l, i === mainList.length - 1, l.emp.status === 'inactif'))}
            {goneDone.length > 0 && (
              <div className="mt-2">
                <button type="button" onClick={() => setShowOld(o => !o)} className="flex h-12 w-full items-center justify-between px-2 text-sm font-semibold text-muted-foreground">
                  Anciens employés ({goneDone.length})
                  {showOld ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
                {showOld && goneDone.map((l, i) => row(l, 'Plus rien à payer', <span className="text-sm text-muted-foreground">À jour</span>, i === goneDone.length - 1, { gone: true }))}
              </div>
            )}
          </>
        ) : (
          <>
            {advLines.length === 0 && <p className="px-2 py-8 text-center text-sm text-muted-foreground">Aucune avance à rendre.</p>}
            {advLines.map((l, i) => advRow(l, i === advLines.length - 1))}
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-xl border-t bg-background px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {salaires ? (
          <button type="button" onClick={() => setPaying(true)} className="flex h-[60px] w-full items-center justify-center gap-2.5 rounded-2xl bg-kred-solid text-lg font-bold text-white active:scale-[0.98]">
            <Banknote className="size-6" /> Verser un salaire
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => openNewMovement(undefined, 'avance_salaire')} className="flex h-[60px] items-center justify-center gap-2 rounded-2xl bg-kgreen-solid text-[17px] font-bold text-white active:scale-[0.98]">
              <Plus className="size-[22px]" strokeWidth={2.6} /> Avance
            </button>
            <button type="button" onClick={() => openNewMovement(undefined, 'remboursement_direct')} className="flex h-[60px] items-center justify-center gap-2 rounded-2xl border-2 border-kgreen-solid text-[17px] font-bold text-kgreen active:scale-[0.98]">
              <Banknote className="size-6" /> Il rend
            </button>
          </div>
        )}
      </div>

      <NewEmployeeDialog open={adding} onOpenChange={setAdding} onCreated={id => setSelectedPersonId(id)} />
      <PaySalaryDialog empId={null} open={paying} onOpenChange={setPaying} />
    </div>
  )
}
