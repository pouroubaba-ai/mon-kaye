import React from 'react'
import { Banknote, ChevronLeft, FileText, History, MessageCircle, MoreVertical, Pencil, Phone, Plus, Trash2, UserMinus } from 'lucide-react'

import { useStore } from '@/data/store'
import type { Movement } from '@/data/mockData'
import { dueDateOf, toTime } from '@/data/payroll'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { PersonFormDialog } from '@/components/person-header'
import { DeletePerson } from '@/components/delete-person'
import { PeriodSheet } from '@/components/modals/PeriodSheet'
import { PaySalaryDialog } from '@/components/modals/PaySalaryDialog'
import { PayslipDialog } from '@/components/modals/PayslipDialog'
import { cn, formatFCFA, waNumber } from '@/lib/utils'
import { amt } from '@/modules/personnes/view'
import { Cap, empLine, inDays, monthName, rowSub, shortDate, shortDay } from '@/modules/employes/view'

// ——— Fiche d'un employé (« Kayé simple ») ———
// Deux cartes : « Je lui dois » (salaires) et « Avance à rendre ». La carte choisie décide de ce qu'on voit :
// - Salaires : ses périodes de paie (En cours / Terminé) ; toucher une période ouvre sa fiche de paie ; en bas « Verser le salaire » ;
// - Avance : l'historique de son avance ; en bas « + Avance » et « Il rend ».
// Le menu ⋯ : Modifier ses infos, Historique des versements, WhatsApp, Appeler, Il est parti, Supprimer.

export const EmployeeDetailScreen: React.FC<{ employeeId: string }> = ({ employeeId }) => {
  const { persons, movements, monthStates, openNewMovement, setSelectedPersonId, openMovementDetail } = useStore()
  const [view, setView] = React.useState<'salaire' | 'avance'>('salaire')
  const [period, setPeriod] = React.useState<string | null>(null)
  const [paying, setPaying] = React.useState(false)
  const [slip, setSlip] = React.useState(false)
  const [menu, setMenu] = React.useState(false)
  const [plan, setPlan] = React.useState(false)
  const emp = persons.find(p => p.id === employeeId)
  if (!emp) return null
  const L = empLine(emp, movements, monthStates)
  const pr = L.pr
  const gone = emp.status === 'inactif'
  const Il = emp.sex === 'f' ? 'Elle' : 'Il'
  const per = emp.advanceDeductionPerPeriod || 0
  const salaire = view === 'salaire'

  // Avance : la retenue à venir, puis les remboursements et les avances (le plus récent en haut)
  type AdvItem = { key: string; title: string; sub: string; amount: number; tone: 'green' | 'blue' | 'muted'; badge?: string; mov?: Movement }
  const advItems: AdvItem[] = [
    ...pr.repayments.map(m => ({
      key: m.id,
      title: m.type === 'remboursement_direct' ? `${Il} a rendu` : 'Retenu sur la paie',
      sub: `${shortDay(m.date)}${m.type === 'remboursement_direct' ? ` · ${m.paymentMethod === 'mobile_money' ? 'Mobile Money' : 'Espèces'}` : m.period ? ` · paie ${/^[aeiouéâ]/i.test(monthName(m.period)) ? "d'" : 'de '}${monthName(m.period)}` : ''}`,
      amount: m.amount,
      tone: 'blue' as const,
      mov: m,
    })),
    ...pr.advances.map(a => ({
      key: a.mov.id,
      title: a.etat === 'Annulée' ? 'Avance annulée' : 'Avance prise',
      sub: `${shortDay(a.mov.date)}${a.mov.paymentMethod ? ` · ${a.mov.paymentMethod === 'mobile_money' ? 'Mobile Money' : 'Espèces'}` : a.mov.note ? ` · ${a.mov.note}` : ''}`,
      amount: a.mov.amount,
      tone: a.etat === 'Annulée' ? ('muted' as const) : ('green' as const),
      mov: a.mov,
    })),
  ].sort((a, b) => toTime(b.mov!.date) - toTime(a.mov!.date))
  if (pr.plannedRetenue > 0)
    advItems.unshift({
      key: 'plan',
      title: 'Retenue sur la paie',
      badge: 'À venir',
      sub: `Paie ${/^[aeiouéâ]/i.test(monthName(pr.currentPeriod)) ? "d'" : 'de '}${monthName(pr.currentPeriod)} · le ${shortDate(dueDateOf(pr.currentPeriod, emp.id))}`,
      amount: pr.plannedRetenue,
      tone: 'muted',
    })

  const card = (v: 'salaire' | 'avance') => {
    const on = view === v
    const red = v === 'salaire'
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => setView(v)}
        className={cn(
          'flex flex-col gap-1 rounded-2xl p-3.5 text-left transition-all',
          on ? (red ? 'border-2 border-kred bg-gradient-to-br from-kred/20 to-card to-75%' : 'border-2 border-kgreen bg-gradient-to-br from-kgreen/20 to-card to-75%') : cn('border bg-card opacity-80', red ? 'border-kred/30' : 'border-kgreen/30')
        )}
      >
        <span className="text-[13px] text-muted-foreground">{red ? 'Je lui dois' : 'Avance à rendre'}</span>
        <span className={cn('text-2xl font-bold tabular-nums', red ? 'text-kred' : 'text-kgreen')}>{amt(red ? L.due : pr.advanceReste)}</span>
        <span className={cn('text-xs', red && !gone ? 'text-kgold' : 'text-muted-foreground')}>
          {red ? (gone ? 'Parti' : `paie ${inDays(L.days)}`) : pr.advanceReste > 0 ? (per ? `${amt(Math.min(per, pr.advanceReste))} retenus par mois` : `${Il.toLowerCase()} rend ${Il === 'Elle' ? 'elle' : 'lui'}-même`) : "Pas d'avance"}
        </span>
      </button>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-2 px-3 pt-[calc(0.875rem+env(safe-area-inset-top))] pb-2">
        <button type="button" aria-label="Retour" onClick={() => setSelectedPersonId(null)} className="flex size-11 items-center justify-center rounded-full hover:bg-muted">
          <ChevronLeft className="size-6" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2">
            <span className="truncate text-xl font-bold">{emp.name}</span>
            {gone && <span className="shrink-0 rounded-full bg-muted px-2 py-px text-[11px] font-semibold text-muted-foreground">Parti</span>}
          </span>
          <span className="truncate text-[13px] text-muted-foreground">
            {[emp.role, emp.salary ? `${amt(emp.salary)} par mois` : '', `paie le ${L.dueDate.getDate()}`].filter(Boolean).join(' · ')}
          </span>
        </div>
        <button type="button" aria-label="Plus d'options" onClick={() => setMenu(true)} className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
          <MoreVertical className="size-5" />
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-3 px-4 pt-2 pb-[calc(7rem+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-2 gap-2.5">
          {card('salaire')}
          {card('avance')}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-muted-foreground">{salaire ? 'Ses salaires' : 'Son avance'}</span>
          {salaire ? (
            <button type="button" onClick={() => setSlip(true)} className="flex h-9 items-center gap-1.5 rounded-[10px] border px-3 text-[13px] font-semibold text-muted-foreground hover:bg-muted">
              <FileText className="size-4" /> Fiche de paie
            </button>
          ) : (
            !gone && (
              <button type="button" onClick={() => setPlan(true)} className="flex h-9 items-center gap-1.5 rounded-[10px] border px-3 text-[13px] font-semibold text-muted-foreground hover:bg-muted">
                <Pencil className="size-[15px]" /> Retenue par mois
              </button>
            )
          )}
        </div>

        {salaire ? (
          <div className="flex flex-col">
            {pr.months.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aucune paie pour l'instant.</p>}
            {pr.months.map((r, i) => {
              const enCours = r.state === 'en_cours'
              const value = enCours || r.reste > 0 ? r.reste : r.brut
              return (
                <button key={r.period} type="button" onClick={() => setPeriod(r.period)} className={cn('flex items-center gap-3 px-1 py-3 text-left', i < pr.months.length - 1 && 'border-b border-border', r.state === 'annule' && 'opacity-50')}>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="text-[15px] font-semibold">{Cap(monthName(r.period))}</span>
                      <span className={cn('rounded-full px-2 py-px text-[11px] font-bold', enCours ? 'bg-kgold/15 text-kgold' : r.state === 'annule' ? 'bg-muted text-muted-foreground' : 'bg-kgreen/15 text-kgreen')}>
                        {enCours ? 'En cours' : r.state === 'annule' ? 'Annulée' : 'Terminé'}
                      </span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{rowSub(r, pr, emp.id)}</span>
                  </span>
                  <span className={cn('shrink-0 text-[15px] font-bold tabular-nums', !enCours && r.reste > 0 ? 'text-kred' : enCours ? 'text-foreground/80' : 'font-semibold text-muted-foreground')}>{amt(value)}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col">
            {advItems.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aucune avance.</p>}
            {advItems.map((a, i) => (
              <button
                key={a.key}
                type="button"
                disabled={!a.mov}
                onClick={() => a.mov && openMovementDetail(a.mov)}
                className={cn('flex items-center gap-3 px-1 py-3 text-left', i < advItems.length - 1 && 'border-b border-border', a.tone === 'muted' && a.mov && 'opacity-50')}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold">{a.title}</span>
                    {a.badge && <span className="rounded-full bg-kgold/15 px-2 py-px text-[11px] font-bold text-kgold">{a.badge}</span>}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{a.sub}</span>
                </span>
                <span className={cn('shrink-0 text-[15px] font-bold tabular-nums', a.tone === 'green' ? 'text-kgreen' : a.tone === 'blue' ? 'text-kblue' : 'text-foreground/80')}>{amt(a.amount)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-xl border-t bg-background px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {salaire ? (
          <button type="button" onClick={() => setPaying(true)} disabled={gone && L.due === 0} className="flex h-[60px] w-full items-center justify-center gap-2.5 rounded-2xl bg-kred-solid text-lg font-bold text-white active:scale-[0.98] disabled:opacity-40">
            <Banknote className="size-6" /> Verser le salaire
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" disabled={gone} onClick={() => openNewMovement(emp.id, 'avance_salaire')} className="flex h-[60px] items-center justify-center gap-2 rounded-2xl bg-kgreen-solid text-[17px] font-bold text-white active:scale-[0.98] disabled:opacity-40">
              <Plus className="size-[22px]" strokeWidth={2.6} /> Avance
            </button>
            <button type="button" disabled={pr.advanceReste === 0} onClick={() => openNewMovement(emp.id, 'remboursement_direct')} className="flex h-[60px] items-center justify-center gap-2 rounded-2xl border-2 border-kgreen-solid text-[17px] font-bold text-kgreen active:scale-[0.98] disabled:opacity-40">
              <Banknote className="size-6" /> {Il} rend
            </button>
          </div>
        )}
      </div>

      <PeriodSheet empId={emp.id} period={period} open={period !== null} onOpenChange={o => !o && setPeriod(null)} />
      <PaySalaryDialog empId={emp.id} open={paying} onOpenChange={setPaying} />
      <PayslipDialog empId={emp.id} period={pr.months[0]?.period ?? pr.currentPeriod} open={slip} onOpenChange={setSlip} />
      <AdvancePlanDialog empId={emp.id} open={plan} onOpenChange={setPlan} />
      <EmployeeMenu empId={emp.id} open={menu} onOpenChange={setMenu} />
    </div>
  )
}

// ——— Retenue par mois : il rend lui-même, ou on retient tant par mois sur sa paie ———
function AdvancePlanDialog({ empId, open, onOpenChange }: { empId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { persons, setAdvancePlan } = useStore()
  const emp = persons.find(p => p.id === empId)
  const [retain, setRetain] = React.useState(false)
  const [str, setStr] = React.useState('')
  React.useEffect(() => {
    if (!open || !emp) return
    setRetain((emp.advanceDeductionPerPeriod || 0) > 0)
    setStr(emp.advanceDeductionPerPeriod ? String(emp.advanceDeductionPerPeriod) : '')
  }, [open])
  if (!emp) return null
  const Il = emp.sex === 'f' ? 'Elle' : 'Il'
  const n = parseInt(str, 10) || 0
  const pill = (on: boolean) => cn('h-11 rounded-full px-3 text-sm', on ? 'border-[1.5px] border-kgold bg-kgold font-bold text-white dark:text-black' : 'border font-semibold text-muted-foreground')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="text-left">
          <DialogTitle className="text-left text-lg">Comment {Il.toLowerCase()} rend son avance ?</DialogTitle>
          <DialogDescription className="text-left">{emp.name}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 pb-2">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setRetain(false)} className={pill(!retain)}>
              {Il} rend {Il === 'Elle' ? 'elle' : 'lui'}-même
            </button>
            <button type="button" onClick={() => setRetain(true)} className={pill(retain)}>
              Retenir sur sa paie
            </button>
          </div>
          {retain && (
            <label className="flex items-center gap-2 text-[15px] text-muted-foreground">
              Retenir
              <input
                autoFocus
                inputMode="numeric"
                value={str ? Number(str).toLocaleString('fr-FR').replace(/\s/g, ' ') : ''}
                onChange={e => setStr(e.target.value.replace(/\D/g, '').slice(0, 9))}
                placeholder="5 000"
                aria-label="Retenue par mois"
                className="h-11 w-28 rounded-xl border-2 border-kgold bg-background text-center text-base font-bold text-foreground outline-none"
              />
              par mois
            </label>
          )}
          <button
            type="button"
            disabled={retain && n <= 0}
            onClick={() => {
              setAdvancePlan(emp.id, retain ? n : 0)
              onOpenChange(false)
            }}
            className="h-14 rounded-2xl bg-kgreen-solid text-lg font-bold text-white disabled:opacity-40"
          >
            Enregistrer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ——— Menu ⋯ de l'employé ———
function EmployeeMenu({ empId, open, onOpenChange }: { empId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { persons, movements, monthStates, openDeparture, shop } = useStore()
  const [editing, setEditing] = React.useState(false)
  const [history, setHistory] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const emp = persons.find(p => p.id === empId)
  if (!emp) return null
  const L = empLine(emp, movements, monthStates)
  const gone = emp.status === 'inactif'
  const close = () => onOpenChange(false)
  const text = [`Bonjour ${emp.name},`, L.due > 0 ? `je vous dois ${formatFCFA(L.due)} de salaire.` : `votre prochaine paie : ${formatFCFA(L.upcoming)}, le ${shortDate(L.dueDate)}.`, L.pr.advanceReste > 0 ? `Avance à rendre : ${formatFCFA(L.pr.advanceReste)}.` : '', shop.name ? `— ${shop.name}` : '']
    .filter(Boolean)
    .join('\n')

  const item = (Icon: React.ComponentType<{ className?: string }>, label: string, hint: string, onClick: () => void, opts: { danger?: boolean; green?: boolean; href?: string; last?: boolean } = {}) => {
    const inner = (
      <>
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', opts.danger ? 'bg-kred/10 text-kred' : opts.green ? 'bg-kgreen/10 text-kgreen' : 'bg-muted text-muted-foreground')}>
          <Icon className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn('text-base font-semibold', opts.danger && 'text-kred')}>{label}</span>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </span>
      </>
    )
    const cls = cn('flex w-full items-center gap-3.5 py-3 text-left', !opts.last && 'border-b border-border')
    return opts.href ? (
      <a key={label} href={opts.href} target={opts.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" onClick={close} className={cls}>
        {inner}
      </a>
    ) : (
      <button key={label} type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader className="gap-0.5 text-left">
            <DialogTitle className="text-left text-lg">{emp.name}</DialogTitle>
            <DialogDescription className="text-left">{[emp.role, emp.salary ? `${amt(emp.salary)} par mois` : '', `paie le ${L.dueDate.getDate()}`].filter(Boolean).join(' · ')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col px-1 pb-2">
            {item(Pencil, 'Modifier ses infos', 'Nom, poste, numéro, salaire', () => {
              close()
              setEditing(true)
            })}
            {item(History, 'Historique des versements', `Tout ce qu'${emp.sex === 'f' ? 'elle' : 'il'} a reçu`, () => {
              close()
              setHistory(true)
            })}
            {item(MessageCircle, 'Envoyer sur WhatsApp', 'Sa paie ou ce que je lui dois', () => {}, { green: true, href: `https://wa.me/${waNumber(emp.phone)}?text=${encodeURIComponent(text)}` })}
            {emp.phone && item(Phone, 'Appeler', emp.phone, () => {}, { href: `tel:${emp.phone.replace(/\s/g, '')}` })}
            {!gone &&
              item(UserMinus, `${emp.sex === 'f' ? 'Elle' : 'Il'} est parti${emp.sex === 'f' ? 'e' : ''}`, 'Plus de nouvelles paies · on garde ses comptes', () => {
                close()
                openDeparture(emp.id)
              })}
            {item(
              Trash2,
              'Supprimer',
              "Seulement en cas d'erreur",
              () => {
                close()
                setDeleting(true)
              },
              { danger: true, last: true }
            )}
          </div>
        </DialogContent>
      </Dialog>
      <PersonFormDialog person={emp} open={editing} onOpenChange={setEditing} />
      <DeletePerson personId={emp.id} open={deleting} onOpenChange={setDeleting} />
      <Dialog open={history} onOpenChange={setHistory}>
        <DialogContent fixedHeight>
          <DialogHeader className="text-left">
            <DialogTitle className="text-left text-lg">Historique des versements</DialogTitle>
            <DialogDescription className="text-left">{emp.name}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col pb-2 min-h-0 flex-1 overflow-y-auto">
            {L.pr.payments.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Rien versé pour l'instant.</p>}
            {L.pr.payments.map((m, i) => (
              <div key={m.id} className={cn('flex items-center gap-3 py-2.5', i < L.pr.payments.length - 1 && 'border-b border-border', m.isCancelled && 'opacity-50')}>
                <span className="flex size-[34px] items-center justify-center rounded-[10px] bg-kblue/10 text-kblue">
                  <Banknote className="size-[18px]" />
                </span>
                <span className="flex flex-1 flex-col">
                  <span className={cn('text-sm font-semibold', m.isCancelled && 'line-through')}>{shortDay(m.date)}</span>
                  <span className="text-xs text-muted-foreground">{m.isCancelled ? 'Annulé' : m.paymentMethod === 'mobile_money' ? 'Mobile Money' : 'Espèces'}</span>
                </span>
                <span className={cn('text-[15px] font-bold text-kblue tabular-nums', m.isCancelled && 'line-through')}>{amt(m.amount)}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
