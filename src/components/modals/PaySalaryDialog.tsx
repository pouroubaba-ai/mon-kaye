import * as React from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Info, Search } from 'lucide-react'

import { useStore } from '@/data/store'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { PeriodSheet } from '@/components/modals/PeriodSheet'
import { cn, matchesPerson } from '@/lib/utils'
import { amt, initials } from '@/modules/personnes/view'
import { dueRows, empLine, inDays, monthName, shortDate } from '@/modules/employes/view'

// ——— Verser le salaire ———
// Un seul gros chiffre : « À lui verser ». « Voir le détail » ouvre ce qu'on lui doit au total et ce qui
// est retenu ; chaque période s'ouvre sur sa fiche de paie. Ce qui dépasse le salaire dû devient une avance.
// Sans employé choisi (bouton de la liste) : on choisit d'abord à qui.

export function PaySalaryDialog({ empId, open, onOpenChange }: { empId: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { persons, movements, monthStates, addMovement, openNewMovement } = useStore()
  const [picked, setPicked] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  const [custom, setCustom] = React.useState<string | null>(null) // montant changé à la main
  const [method, setMethod] = React.useState<'especes' | 'mobile_money'>('especes')
  const [detail, setDetail] = React.useState(false)
  React.useEffect(() => {
    if (!open) return
    setPicked(empId)
    setSearch('')
    setCustom(null)
    setMethod('especes')
  }, [open, empId])

  const id = picked
  const emp = id ? persons.find(p => p.id === id) : undefined
  const L = emp ? empLine(emp, movements, monthStates) : null
  const due = L?.due ?? 0
  // Le champ « Je lui verse » part vide : on tape le montant, ou on touche « Tout »
  const amount = parseInt(custom ?? '', 10) || 0
  const tooMuch = amount > due

  const save = () => {
    if (!emp || amount <= 0 || tooMuch) return
    addMovement({ personId: emp.id, personName: emp.name, type: 'je_lui_ai_verse', label: 'Salaire versé', amount, paymentMethod: method })
    onOpenChange(false)
  }

  // Choisir l'employé
  const list = persons
    .filter(p => p.type === 'employee' && matchesPerson(p, search))
    .map(p => empLine(p, movements, monthStates))
    .filter(l => l.emp.status !== 'inactif' || l.due > 0)
    .sort((a, b) => b.due - a.due || a.days - b.days)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} dirty={custom !== null} dirtyKind="ajout">
        <DialogContent fixedHeight>
          {!emp ? (
            <>
              <DialogHeader className="text-left">
                <DialogTitle className="text-left text-xl">
                  Verser un salaire <span className="font-medium text-muted-foreground">— à qui ?</span>
                </DialogTitle>
                <DialogDescription className="sr-only">Choisir l'employé</DialogDescription>
              </DialogHeader>
              <label className="flex h-12 items-center gap-2.5 rounded-[14px] border bg-background px-3.5 text-muted-foreground">
                <Search className="size-5" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Chercher un employé" className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none" />
              </label>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-2 pb-2 [&>*]:shrink-0">
                {list.map((l, i) => (
                  <button key={l.emp.id} type="button" onClick={() => setPicked(l.emp.id)} className={cn('flex items-center gap-3 px-1.5 py-3 text-left', i < list.length - 1 && 'border-b border-border')}>
                    <span className="flex size-10 items-center justify-center rounded-full bg-muted text-[13px] font-semibold text-muted-foreground">{initials(l.emp.name)}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-base font-semibold">{l.emp.name}</span>
                      <span className="text-xs text-muted-foreground">{l.due > 0 ? 'Je lui dois maintenant' : `Rien à payer · prochaine paie le ${shortDate(l.dueDate)}, ${inDays(l.days)}`}</span>
                    </span>
                    {l.due > 0 ? <span className="text-[15px] font-bold text-kred tabular-nums">{amt(l.due)}</span> : <span className="text-sm text-muted-foreground">Rien dû</span>}
                  </button>
                ))}
                {list.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Aucun employé.</p>}
              </div>
            </>
          ) : (
            <>
              <DialogHeader className="text-left">
                <div className="flex items-center gap-2">
                  {!empId && (
                    <button type="button" aria-label="Retour" onClick={() => setPicked(null)} className="-ml-2 flex size-10 items-center justify-center rounded-full hover:bg-muted">
                      <ChevronLeft className="size-[22px]" />
                    </button>
                  )}
                  <div className="flex flex-col">
                    <DialogTitle className="text-left text-lg">Verser le salaire</DialogTitle>
                    <DialogDescription className="text-left">
                      {emp.name} · {L && L.days <= 0 ? `le ${shortDate(L.dueDate)}, jour de paie` : due > 0 ? 'paie en retard' : `paie le ${L ? shortDate(L.dueDate) : ''}, ${inDays(L?.days ?? 0)}`}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              {due === 0 ? (
                // Rien n'est dû : pas de salaire à verser. Seulement la prochaine paie, et l'avance si besoin.
                <div className="flex flex-col gap-4 pb-2 min-h-0 flex-1 overflow-y-auto [&>*]:shrink-0">
                  <div className="flex flex-col items-center gap-1.5 py-5 text-center">
                    <span className="text-2xl font-bold">Rien à payer pour l'instant</span>
                    <span className="text-[15px] text-muted-foreground">
                      Prochaine paie : <b className="text-foreground tabular-nums">{amt(L?.upcoming ?? 0)}</b> le {L ? shortDate(L.dueDate) : ''} <span className="text-kgold">({inDays(L?.days ?? 0)})</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={emp.status === 'inactif'}
                    onClick={() => {
                      onOpenChange(false)
                      openNewMovement(emp.id, 'avance_salaire')
                    }}
                    className="h-[58px] rounded-2xl border-2 border-kgreen-solid text-lg font-bold text-kgreen disabled:opacity-40"
                  >
                    Lui donner une avance
                  </button>
                </div>
              ) : (
              <div className="flex flex-col gap-3.5 pb-2 min-h-0 flex-1 overflow-y-auto [&>*]:shrink-0">
                <div className="flex flex-col items-center gap-1 pt-3">
                  <span className="text-sm text-muted-foreground">Je lui dois maintenant</span>
                  <span className="text-[44px] leading-tight font-bold tracking-tight text-kred tabular-nums">
                    {amt(due)} <span className="text-base font-medium text-muted-foreground">FCFA</span>
                  </span>
                  <button type="button" onClick={() => setDetail(true)} className="mt-1 flex h-9 items-center gap-1.5 rounded-full border border-kgold/40 bg-kgold/10 px-3.5 text-[13px] font-semibold text-kgold">
                    <Info className="size-4" /> Voir le détail
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] text-muted-foreground">Je lui verse</span>
                  <div className="flex items-center gap-2">
                    <label className={cn('flex h-14 min-w-0 flex-1 items-center gap-2 rounded-xl border-2 bg-background px-3.5', tooMuch ? 'border-destructive' : 'border-kgold/60')}>
                      <input
                        inputMode="numeric"
                        value={custom ? Number(custom).toLocaleString('fr-FR').replace(/\s/g, ' ') : ''}
                        onChange={e => setCustom(e.target.value.replace(/\D/g, '').slice(0, 9))}
                        placeholder="0"
                        aria-label="Je lui verse"
                        className="min-w-0 flex-1 bg-transparent text-2xl font-bold tabular-nums outline-none placeholder:text-muted-foreground/40"
                      />
                      <span className="flex-none text-sm text-muted-foreground">FCFA</span>
                    </label>
                    <button type="button" onClick={() => setCustom(String(due))} className="h-14 shrink-0 rounded-xl border px-3.5 text-sm font-semibold hover:bg-muted">
                      Tout ({amt(due)})
                    </button>
                  </div>
                  <span className="min-h-4 text-xs text-destructive">{tooMuch ? `Pas plus que ce que je lui dois (${amt(due)}).` : ''}</span>
                </div>
                <div role="tablist" aria-label="Moyen de paiement" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                  {(
                    [
                      ['especes', 'Espèces'],
                      ['mobile_money', 'Mobile Money'],
                    ] as const
                  ).map(([v, label]) => (
                    <button key={v} type="button" role="tab" aria-selected={method === v} onClick={() => setMethod(v)} className={cn('h-10 rounded-[9px] text-sm', method === v ? 'bg-foreground font-bold text-background shadow-sm' : 'font-semibold text-muted-foreground')}>
                      {label}
                    </button>
                  ))}
                </div>
                <button type="button" disabled={amount <= 0 || tooMuch} onClick={save} className="h-[58px] rounded-2xl bg-kred-solid text-lg font-bold text-white disabled:opacity-40">
                  Enregistrer
                </button>
              </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      {emp && <PayDetail empId={emp.id} open={detail} onOpenChange={setDetail} />}
    </>
  )
}

// ——— Détail du versement : ce que je lui dois au total, ce qui est retenu, période par période ———
function PayDetail({ empId, open, onOpenChange }: { empId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { persons, movements, monthStates } = useStore()
  const [openDue, setOpenDue] = React.useState(false)
  const [openCut, setOpenCut] = React.useState(false)
  const [period, setPeriod] = React.useState<string | null>(null)
  const emp = persons.find(p => p.id === empId)
  if (!emp) return null
  const L = empLine(emp, movements, monthStates)
  // Les périodes à payer maintenant ; sinon (avant le jour de paie) la période en cours
  const rows = dueRows(L.pr)
  const cur = L.pr.months.find(m => m.period === L.pr.currentPeriod)
  const shownRows = rows.length ? rows : cur ? [cur] : []
  const lines = shownRows.map(r => ({ row: r, owed: r.reste + r.retenues, cut: r.retenues }))
  const owed = lines.reduce((a, l) => a + l.owed, 0)
  const cut = lines.reduce((a, l) => a + l.cut, 0)
  const ofP = (p: string) => `Paie ${/^[aeiouéâ]/i.test(monthName(p)) ? "d'" : 'de '}${monthName(p)}`
  const cutLines = shownRows.flatMap(r => {
    const items = r.items.filter(m => !m.isCancelled && (m.type === 'retenue_salaire' || m.type === 'retenue_manuelle'))
    const out = items.map(m => ({
      key: m.id,
      label: m.type === 'retenue_salaire' ? 'Pour son avance' : m.label.includes(':') ? m.label.split(':').slice(1).join(':').trim() : 'Retenue',
      sub: ofP(r.period),
      amount: m.amount,
    }))
    // Retenue d'avance prévue sur la paie en cours (pas encore écrite)
    if (r.state === 'en_cours' && L.pr.plannedRetenue > 0 && !items.some(m => m.type === 'retenue_salaire'))
      out.push({ key: `plan-${r.period}`, label: 'Pour son avance', sub: ofP(r.period), amount: L.pr.plannedRetenue })
    return out
  })

  const head = (label: string, sub: string, value: React.ReactNode, isOpen: boolean, toggle: () => void) => (
    <button type="button" onClick={toggle} aria-expanded={isOpen} className="flex items-center gap-2.5 py-3.5 text-left">
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">{sub}</span>
      </span>
      {value}
      {isOpen ? <ChevronUp className="size-[18px] text-muted-foreground" /> : <ChevronDown className="size-[18px] text-muted-foreground" />}
    </button>
  )
  const sub = (key: string, label: string, badge: React.ReactNode, desc: string, value: React.ReactNode, onClick?: () => void) => (
    <button key={key} type="button" onClick={onClick} disabled={!onClick} className="flex items-center gap-2.5 rounded-[10px] bg-muted/60 px-3 py-2.5 text-left">
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-sm font-semibold">
          {label}
          {badge}
        </span>
        <span className="text-xs text-muted-foreground">{desc}</span>
      </span>
      {value}
      {onClick && <ChevronRight className="size-4 text-muted-foreground" />}
    </button>
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent fixedHeight>
          <DialogHeader className="text-left">
            <DialogTitle className="text-left text-lg">Détail du versement</DialogTitle>
            <DialogDescription className="text-left">{emp.name}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col pb-2 min-h-0 flex-1 overflow-y-auto [&>*]:shrink-0">
            <div className="flex flex-col rounded-[14px] border bg-background px-3.5 py-1">
              {head('Je lui dois au total', `${lines.length} période${lines.length > 1 ? 's' : ''}`, <span className="text-[17px] font-bold text-kred tabular-nums">{amt(owed)}</span>, openDue, () => setOpenDue(o => !o))}
              {openDue && (
                <div className="flex flex-col gap-1.5 pb-3">
                  {lines.map(l =>
                    sub(
                      l.row.period,
                      `${monthName(l.row.period).charAt(0).toUpperCase()}${monthName(l.row.period).slice(1)}`,
                      <span className={cn('rounded-full px-2 py-px text-[11px] font-bold', l.row.state === 'en_cours' ? 'bg-kgold/15 text-kgold' : 'bg-kgreen/15 text-kgreen')}>{l.row.state === 'en_cours' ? 'En cours' : 'Terminé'}</span>,
                      l.row.verse > 0 ? `Reste à payer · ${amt(l.row.verse)} déjà versés` : 'Salaire de la période',
                      <span className={cn('text-sm font-bold tabular-nums', l.row.state === 'en_cours' ? 'text-muted-foreground' : 'text-kred')}>{amt(l.owed)}</span>,
                      () => setPeriod(l.row.period)
                    )
                  )}
                </div>
              )}
              <div className="h-px bg-border/60" />
              {head('Retenu', `${cutLines.length} retenue${cutLines.length > 1 ? 's' : ''}`, <span className="text-[17px] font-bold text-kgreen tabular-nums">− {amt(cut)}</span>, openCut, () => setOpenCut(o => !o))}
              {openCut && (
                <div className="flex flex-col gap-1.5 pb-3">
                  {cutLines.length === 0 && <span className="px-1 text-sm text-muted-foreground">Rien de retenu.</span>}
                  {cutLines.map(c => sub(c.key, c.label, null, c.sub, <span className="text-sm font-bold text-kgreen tabular-nums">− {amt(c.amount)}</span>))}
                </div>
              )}
              <div className="flex justify-between border-t py-3.5 text-[17px] font-bold">
                <span>À lui verser</span>
                <span className="text-kred tabular-nums">{amt(owed - cut)}</span>
              </div>
            </div>
            <span className="mt-3 text-center text-[13px] text-muted-foreground">{openDue ? 'Touche une période pour ouvrir sa fiche de paie' : 'Touche une ligne pour voir le détail'}</span>
          </div>
        </DialogContent>
      </Dialog>
      <PeriodSheet empId={empId} period={period} open={period !== null} onOpenChange={o => !o && setPeriod(null)} />
    </>
  )
}
