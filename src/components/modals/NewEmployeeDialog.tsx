import * as React from 'react'
import { ArrowLeft } from 'lucide-react'

import { useStore } from '@/data/store'
import { LAST_DAY, dayMonth, dueDayLabel, ofMonth, periodBounds, periodFor } from '@/data/payroll'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, formatFCFA, formatPhone, nameTaken } from '@/lib/utils'

// Nouvel employé, un écran court par question :
//   Qui ?  →  Son salaire  →  Sa paie  →  Ancien compte  →  Anciennes avances  →  Résumé
// « Sa paie » : seulement le jour de l'échéance (du 1 au 28, ou le dernier jour du mois).
// La période de paie va d'une échéance à la suivante ; chaque période compte le salaire entier.

type Step = 'qui' | 'salaire' | 'mois' | 'ancien' | 'avance' | 'resume'
const ORDER: Step[] = ['qui', 'salaire', 'mois', 'ancien', 'avance', 'resume']
const TITLES: Record<Step, string> = {
  qui: 'Nouvel employé',
  salaire: 'Son salaire',
  mois: 'Sa paie',
  ancien: 'Ancien compte',
  avance: 'Anciennes avances',
  resume: 'Résumé',
}

const thousands = (s: string) => (s ? Number(s).toLocaleString('fr-FR').replace(/\s/g, ' ') : '')
const digits = (s: string) => s.replace(/\D/g, '').slice(0, 9)
const num = (s: string) => parseInt(s, 10) || 0

function MoneyInput({ id, value, onChange, autoFocus }: { id: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <div className="relative">
      <Input
        id={id}
        autoFocus={autoFocus}
        inputMode="numeric"
        value={thousands(value)}
        onChange={e => onChange(digits(e.target.value))}
        className="h-12 pr-16 text-lg tabular-nums"
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">FCFA</span>
    </div>
  )
}

function Choice({ on, title, onPick, children }: { on: boolean; title: string; onPick: () => void; children?: React.ReactNode }) {
  return (
    <div className={cn('rounded-xl border transition-colors', on && 'border-primary bg-muted/40')}>
      <button type="button" role="radio" aria-checked={on} onClick={onPick} className="flex w-full items-center gap-3 p-3 text-left">
        <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-primary' : 'border-muted-foreground/40')}>
          {on && <span className="size-2.5 rounded-full bg-primary" />}
        </span>
        <span className="text-sm font-medium">{title}</span>
      </button>
      {on && children && <div className="px-3 pb-3 pl-11">{children}</div>}
    </div>
  )
}

export function NewEmployeeDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: (id: string) => void }) {
  const { addPerson, persons } = useStore()

  const [step, setStep] = React.useState<Step>('qui')
  const [name, setName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [role, setRole] = React.useState('')
  const [salary, setSalary] = React.useState('')
  // Jour de paie (31 = dernier jour du mois) : vide au départ, c'est l'utilisateur qui le choisit
  const [dueDay, setDueDay] = React.useState<number | null>(null)
  const [oldDebt, setOldDebt] = React.useState('')
  const [advance, setAdvance] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    setStep('qui')
    setName('')
    setPhone('')
    setRole('')
    setSalary('')
    setDueDay(null)
    setOldDebt('')
    setAdvance('')
  }, [open])

  const sal = num(salary)
  // Sa période en cours, selon le jour de paie choisi
  const cur = periodFor(dueDay ?? LAST_DAY)
  const { start, end } = periodBounds(cur, dueDay ?? LAST_DAY)
  const firstMonth = sal
  const debt = num(oldDebt)
  const adv = num(advance)
  // Façon de rendre l'avance : réglée plus tard (pour l'instant, pas de retenue sur le salaire)
  const per = 0
  const toPay = Math.max(0, firstMonth + debt - per)

  const okStep: Record<Step, boolean> = {
    qui: name.trim().length > 0 && !nameTaken(persons, name),
    salaire: sal > 0,
    mois: dueDay !== null,
    ancien: true,
    avance: true,
    resume: true,
  }
  const i = ORDER.indexOf(step)
  const next = () => okStep[step] && setStep(ORDER[i + 1])
  const back = () => i > 0 && setStep(ORDER[i - 1])
  const dirty = name.trim() !== '' || phone.trim() !== '' || salary !== ''

  const save = () => {
    const id = addPerson({
      type: 'employee',
      name: name.trim(),
      phone: formatPhone(phone),
      role: role.trim() || undefined,
      salary: sal,
      dueDay: dueDay ?? LAST_DAY,
      oldDebt: debt || undefined,
      advance: adv || undefined,
      perMonth: per || undefined,
    })
    onCreated?.(id)
    onOpenChange(false)
  }

  const Row = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-medium tabular-nums', tone)}>{value}</span>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dirty={dirty} dirtyKind="ajout">
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form
          className="flex flex-col gap-5"
          onSubmit={e => {
            e.preventDefault()
            if (step === 'resume') save()
            else next()
          }}
        >
          <DialogHeader className="gap-1 p-0">
            <div className="flex items-center gap-2">
              {i > 0 && (
                <Button type="button" variant="ghost" size="icon" className="-ml-2 size-8" aria-label="Retour" onClick={back}>
                  <ArrowLeft />
                </Button>
              )}
              <DialogTitle className="text-left">{TITLES[step]}</DialogTitle>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {i + 1} / {ORDER.length}
              </span>
            </div>
            <DialogDescription className="text-left">{step === 'qui' ? 'Qui est-il ?' : name.trim()}</DialogDescription>
          </DialogHeader>

          {step === 'qui' && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ne-name">Nom</Label>
                <Input id="ne-name" autoFocus value={name} onChange={e => setName(e.target.value)} aria-invalid={!!nameTaken(persons, name)} />
                {nameTaken(persons, name) && <p className="text-xs text-destructive">{nameTaken(persons, name)}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ne-phone">Numéro</Label>
                <Input id="ne-phone" type="tel" inputMode="tel" placeholder="+242 06 …" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ne-role">Poste</Label>
                <Input id="ne-role" placeholder="Ex : Caissière" value={role} onChange={e => setRole(e.target.value)} />
              </div>
            </div>
          )}

          {step === 'salaire' && (
            <div className="grid gap-2">
              <Label htmlFor="ne-salary">Son salaire de base, par mois</Label>
              <MoneyInput id="ne-salary" autoFocus value={salary} onChange={setSalary} />
            </div>
          )}

          {step === 'mois' && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label>Vous le payez le combien du mois ?</Label>
                {/* Tous les jours visibles d'un coup : on touche le jour, sans rien faire défiler */}
                <div id="ne-dueday" role="radiogroup" aria-label="Jour de paie" className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 28 }, (_, k) => k + 1).map(d => (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={dueDay === d}
                      onClick={() => setDueDay(d)}
                      className={cn(
                        'flex h-10 items-center justify-center rounded-lg border text-sm font-medium tabular-nums transition-colors',
                        dueDay === d ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
                      )}
                    >
                      {d}
                    </button>
                  ))}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={dueDay === LAST_DAY}
                    onClick={() => setDueDay(LAST_DAY)}
                    className={cn(
                      'col-span-7 flex h-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors',
                      dueDay === LAST_DAY ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
                    )}
                  >
                    Le dernier jour du mois
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'ancien' && (
            <div className="grid gap-2">
              <Label htmlFor="ne-old">Vous lui devez combien ?</Label>
              <MoneyInput id="ne-old" autoFocus value={oldDebt} onChange={setOldDebt} />
              <p className="text-xs text-muted-foreground">Ajouté à sa paie {ofMonth(cur)}. Rien ? Laissez vide.</p>
            </div>
          )}

          {step === 'avance' && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ne-adv">Combien vous doit-il sur ses anciennes avances ?</Label>
                <MoneyInput id="ne-adv" autoFocus value={advance} onChange={setAdvance} />
                <p className="text-xs text-muted-foreground">Rien ? Laissez vide.</p>
              </div>
            </div>
          )}

          {step === 'resume' && (
            <div className="flex flex-col gap-3">
              {/* 1. Son salaire */}
              <section className="rounded-xl border px-3 py-1">
                <Row label="Salaire par mois" value={formatFCFA(sal)} />
                <Row label="Payé" value={dueDayLabel(dueDay ?? LAST_DAY)} />
              </section>

              {/* 2. Sa paie */}
              <section className="flex flex-col rounded-xl border px-3 pt-2 pb-1">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Paie {ofMonth(cur)}</p>
                <p className="text-xs text-muted-foreground">Du {dayMonth(start)} au {dayMonth(end)} · échéance le {dayMonth(end)}</p>
                <Row label="Salaire de la période" value={formatFCFA(firstMonth)} />
              </section>

              {/* 3. Son ancien compte, à part */}
              {debt > 0 && (
                <section className="flex flex-col rounded-xl border px-3 pt-2 pb-1">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Ancien compte</p>
                  <Row label="Vous lui devez" value={formatFCFA(debt)} tone="text-debt" />
                </section>
              )}

              {/* 4. Ses anciennes avances, à part */}
              {adv > 0 && (
                <section className="flex flex-col rounded-xl border px-3 pt-2 pb-1">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Anciennes avances</p>
                  <Row label="Il doit" value={formatFCFA(adv)} tone="text-credit" />
                </section>
              )}
            </div>
          )}

          <Button type="submit" size="lg" className="h-12" disabled={!okStep[step]}>
            {step === 'resume' ? 'Enregistrer' : 'Suivant'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
