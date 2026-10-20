import React, { useState } from 'react'
import { useStore } from '@/data/store'
import { currentPeriod, daysInPeriod, daysWorked, ofMonth, payrollOf, simulateDeparture } from '@/data/payroll'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn, formatFCFA, useKept } from '@/lib/utils'

// L'employé quitte la boutique : deux questions courtes (son dernier mois, son avance),
// puis ce qui reste à faire. Rien n'est versé ici : on verse ensuite comme d'habitude.

const thousands = (s: string) => (s ? Number(s).toLocaleString('fr-FR').replace(/\s/g, ' ') : '')
const digits = (s: string) => s.replace(/\D/g, '').slice(0, 9)

type Basis = 'complet' | 'prorata' | 'fixe'
type AdvChoice = 'retenir' | 'dette' | 'laisser'

function Choice({ on, title, hint, onPick, children }: { on: boolean; title: string; hint?: string; onPick: () => void; children?: React.ReactNode }) {
  return (
    <div className={cn('rounded-xl border transition-colors', on && 'border-primary bg-muted/40')}>
      <button type="button" role="radio" aria-checked={on} onClick={onPick} className="flex w-full items-center gap-3 p-3 text-left">
        <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-primary' : 'border-muted-foreground/40')}>
          {on && <span className="size-2.5 rounded-full bg-primary" />}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium">{title}</span>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </span>
      </button>
      {on && children && <div className="px-3 pb-3 pl-11">{children}</div>}
    </div>
  )
}

export const DepartureModal: React.FC = () => {
  const { isDepartureOpen, closeDeparture, departureTargetEmployeeId, persons, movements, monthStates, processDeparture } = useStore()
  // Pendant la fermeture, la fiche reste affichée (pas de disparition d'un coup)
  const keptId = useKept(departureTargetEmployeeId)
  const emp = persons.find(p => p.id === keptId)
  // Sa période de paie en cours (d'une échéance à l'autre)
  const cur = currentPeriod(keptId ?? undefined)
  const dim = daysInPeriod(cur, keptId ?? undefined)

  const [basis, setBasis] = useState<Basis>('prorata')
  const [daysStr, setDaysStr] = useState('')
  const [fixedStr, setFixedStr] = useState('')
  const [adv, setAdv] = useState<AdvChoice>('retenir')
  const [note, setNote] = useState('')

  // À chaque ouverture, on repart des choix par défaut.
  React.useEffect(() => {
    if (!isDepartureOpen) return
    setBasis('prorata')
    // Jours déjà travaillés dans la période en cours
    const id = departureTargetEmployeeId
    setDaysStr(String(id ? daysWorked(currentPeriod(id), id) : new Date().getDate()))
    setFixedStr('')
    setAdv('retenir')
    setNote('')
  }, [isDepartureOpen])

  if (!emp) return null

  const salary = emp.salary || 0
  const days = Math.min(dim, parseInt(daysStr, 10) || 0)
  const newBase = basis === 'complet' ? salary : basis === 'prorata' ? Math.round((salary * days) / dim) : parseInt(fixedStr, 10) || 0
  const basisLabel = basis === 'complet' ? 'montant complet' : basis === 'prorata' ? `${days} jours sur ${dim}` : 'montant convenu'

  // Ce que le départ donnerait : salaire encore dû, avance encore due (un trop reçu devient de l'avance)
  const sim = simulateDeparture(emp.id, movements, monthStates, basis === 'complet' ? null : newBase, basisLabel, '', 0)
  const pr = payrollOf(emp.id, sim.next, sim.states)
  const monthOpen = sim.stopped
  const salaryDue = pr.totalReste
  const advDue = pr.advanceReste + pr.surplus
  const cut = adv === 'retenir' ? Math.min(advDue, salaryDue) : 0
  const toPay = salaryDue - cut
  const stillOwes = adv === 'laisser' ? 0 : advDue - cut

  const invalid = (monthOpen && basis !== 'complet' && newBase <= 0) || (advDue > 0 && adv === 'laisser' && !note.trim())
  const dirty = basis !== 'prorata' || fixedStr !== '' || adv !== 'retenir' || note.trim() !== ''

  const submit = () => {
    if (invalid) return
    processDeparture(emp.id, basis === 'complet' ? null : newBase, basisLabel, advDue > 0 ? adv : 'dette', note)
  }

  return (
    <Dialog open={isDepartureOpen} onOpenChange={open => !open && closeDeparture()} dirty={dirty} dirtyKind="modification">
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <div className="flex flex-col gap-5">
          <DialogHeader className="gap-1 p-0">
            <DialogTitle className="text-left">Il quitte la boutique</DialogTitle>
            <DialogDescription className="text-left">{emp.name}</DialogDescription>
          </DialogHeader>

          {monthOpen && (
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Dernier mois">
              <p className="text-sm font-medium">Combien touche-t-il pour le mois {ofMonth(cur)} ?</p>
              <Choice on={basis === 'complet'} title="Montant complet" hint={formatFCFA(salary)} onPick={() => setBasis('complet')} />
              <Choice on={basis === 'prorata'} title="Selon les jours travaillés" onPick={() => setBasis('prorata')}>
                <label className="flex items-center gap-2 text-sm">
                  Il a travaillé
                  <Input
                    inputMode="numeric"
                    aria-label="Jours travaillés"
                    value={daysStr}
                    onFocus={e => e.currentTarget.select()}
                    onChange={e => setDaysStr(digits(e.target.value).slice(0, 2))}
                    className="h-10 w-16 text-center"
                  />
                  jours sur {dim}
                </label>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">Soit {formatFCFA(newBase)}</p>
              </Choice>
              <Choice on={basis === 'fixe'} title="Montant convenu" onPick={() => setBasis('fixe')}>
                <Input
                  autoFocus
                  inputMode="numeric"
                  placeholder="Montant"
                  aria-label="Montant convenu"
                  value={thousands(fixedStr)}
                  onChange={e => setFixedStr(digits(e.target.value))}
                  className="h-10"
                />
              </Choice>
            </div>
          )}

          {advDue > 0 && (
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Son avance">
              <p className="text-sm font-medium">
                Son avance : il doit encore <span className="text-credit tabular-nums">{formatFCFA(advDue)}</span>
              </p>
              <Choice
                on={adv === 'retenir'}
                title="La retirer de son salaire"
                hint={salaryDue > 0 ? `${formatFCFA(Math.min(advDue, salaryDue))} en moins à lui verser` : 'Rien à retirer : son salaire est déjà payé'}
                onPick={() => setAdv('retenir')}
              />
              <Choice on={adv === 'dette'} title="Il me la rendra plus tard" onPick={() => setAdv('dette')} />
              <Choice on={adv === 'laisser'} title="Je la lui laisse" onPick={() => setAdv('laisser')}>
                <Input autoFocus placeholder="Motif obligatoire" value={note} onChange={e => setNote(e.target.value)} className="h-10" />
              </Choice>
            </div>
          )}

          <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">À lui verser</span>
              <span className="text-base font-semibold text-debt tabular-nums">{formatFCFA(toPay)}</span>
            </div>
            {stillOwes > 0 && (
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">Il vous devra encore</span>
                <span className="text-base font-semibold text-credit tabular-nums">{formatFCFA(stillOwes)}</span>
              </div>
            )}
          </div>

          <Button variant="destructive" size="lg" className="h-12" disabled={invalid} onClick={submit}>
            Confirmer son départ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
