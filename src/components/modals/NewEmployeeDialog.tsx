import * as React from 'react'

import { useStore } from '@/data/store'
import { LAST_DAY } from '@/data/payroll'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { cn, formatPhone, nameTaken } from '@/lib/utils'
import { CalendarDays } from 'lucide-react'

// ——— Nouvel employé : un seul écran ———
// Nom, homme ou femme, salaire par mois, jour de paie. Le bouton en pointillés ouvre ce qui existe déjà
// dans le cahier : un reste de salaire, une avance (et comment il la rend), puis numéro et poste.

const thousands = (s: string) => (s ? Number(s).toLocaleString('fr-FR').replace(/\s/g, ' ') : '')
const digits = (s: string) => s.replace(/\D/g, '').slice(0, 9)
const num = (s: string) => parseInt(s, 10) || 0

function Money({ value, onChange, label, tone, autoFocus }: { value: string; onChange: (v: string) => void; label: string; tone?: string; autoFocus?: boolean }) {
  return (
    <label className="flex h-12 items-center gap-2 rounded-xl border bg-background px-3.5">
      <input
        autoFocus={autoFocus}
        inputMode="numeric"
        aria-label={label}
        value={thousands(value)}
        onChange={e => onChange(digits(e.target.value))}
        placeholder="0"
        className={cn('min-w-0 flex-1 bg-transparent text-lg font-bold tabular-nums outline-none placeholder:text-muted-foreground/40', tone)}
      />
      <span className="flex-none text-sm text-muted-foreground">FCFA</span>
    </label>
  )
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-2">
    <span className="text-[13px] text-muted-foreground">{label}</span>
    {children}
  </div>
)
const pill = (on: boolean) => cn('h-11 rounded-full px-4 text-sm', on ? 'border-[1.5px] border-kgold bg-kgold font-bold text-white dark:text-black' : 'border font-semibold text-muted-foreground')

export function NewEmployeeDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: (id: string) => void }) {
  const { addPerson, persons } = useStore()
  const [name, setName] = React.useState('')
  const [sex, setSex] = React.useState<'h' | 'f' | undefined>()
  const [salary, setSalary] = React.useState('')
  const [dueDay, setDueDay] = React.useState<number | null>(null)
  const [more, setMore] = React.useState(false)
  const [picking, setPicking] = React.useState(false)
  const [oldDebt, setOldDebt] = React.useState('')
  const [advance, setAdvance] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [role, setRole] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    setName('')
    setSex(undefined)
    setSalary('')
    setDueDay(null)
    setMore(false)
    setOldDebt('')
    setAdvance('')
    setPhone('')
    setRole('')
  }, [open])

  const taken = nameTaken(persons, name)
  const day = dueDay
  const adv = num(advance)
  const ok = name.trim() !== '' && !taken && num(salary) > 0 && day !== null

  const save = () => {
    if (!ok) return
    const id = addPerson({
      type: 'employee',
      name: name.trim(),
      sex,
      phone: formatPhone(phone),
      role: role.trim() || undefined,
      salary: num(salary),
      dueDay: day ?? LAST_DAY,
      oldDebt: num(oldDebt) || undefined,
      advance: adv || undefined,
    })
    onOpenChange(false)
    onCreated?.(id)
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange} dirty={name.trim() !== '' || salary !== ''} dirtyKind="ajout">
      <DialogContent fixedHeight>
        <DialogHeader className="text-left">
          <DialogTitle className="text-left text-xl">Nouvel employé</DialogTitle>
          <DialogDescription className="sr-only">Ajouter un employé</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4 pb-2 min-h-0 flex-1 overflow-y-auto [&>*]:shrink-0"
          onSubmit={e => {
            e.preventDefault()
            save()
          }}
        >
          <Field label="Nom">
            <input autoFocus value={name} onChange={e => setName(e.target.value)} aria-label="Nom" aria-invalid={!!taken} className="h-12 rounded-xl border bg-background px-3.5 text-base outline-none" />
            {taken && <span className="text-xs text-destructive">{taken}</span>}
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Homme ou femme">
              {(
                [
                  ['h', 'Homme'],
                  ['f', 'Femme'],
                ] as const
              ).map(([v, label]) => (
                <button key={v} type="button" role="radio" aria-checked={sex === v} onClick={() => setSex(sex === v ? undefined : v)} className={pill(sex === v)}>
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Salaire par mois">
            <Money value={salary} onChange={setSalary} label="Salaire par mois" />
          </Field>
          <Field label="Je le paie le">
            {/* Un bouton qui ouvre le choix du jour (pas de jour à taper au hasard) */}
            <button
              type="button"
              onClick={() => setPicking(true)}
              className={cn('flex h-12 items-center justify-between rounded-xl border bg-background px-3.5 text-left text-base', dueDay === null ? 'text-muted-foreground' : 'font-semibold')}
            >
              {dueDay === null ? 'Choisir le jour de paie' : dayText(dueDay)}
              <CalendarDays className="size-5 text-muted-foreground" />
            </button>
          </Field>

          {!more ? (
            <button type="button" onClick={() => setMore(true)} className="flex h-12 items-center justify-center rounded-xl border-[1.5px] border-dashed border-kgold/60 bg-kgold/5 text-sm font-semibold text-kgold">
              {sex === 'f' ? 'Elle' : 'Il'} a déjà un reste à toucher ou une avance ?
            </button>
          ) : (
            <div className="flex flex-col gap-4 rounded-2xl border bg-muted/30 p-3.5 animate-in fade-in duration-200">
              <span className="text-xs tracking-[0.08em] text-muted-foreground uppercase">Ce qu'il y a déjà dans le cahier</span>
              <Field label="Je lui dois déjà (reste de salaire)">
                <Money value={oldDebt} onChange={setOldDebt} label="Reste de salaire" tone="text-kred" />
              </Field>
              <Field label={`${sex === 'f' ? 'Elle' : 'Il'} me doit déjà (avance)`}>
                <Money value={advance} onChange={setAdvance} label="Avance" tone="text-kgreen" />
              </Field>
              <Field label="Numéro">
                <input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+242 06 …" className="h-12 rounded-xl border bg-background px-3.5 text-base outline-none" />
              </Field>
              <Field label="Poste">
                <input value={role} onChange={e => setRole(e.target.value)} placeholder="Ex : Livreur" className="h-12 rounded-xl border bg-background px-3.5 text-base outline-none" />
              </Field>
            </div>
          )}

          <button type="submit" disabled={!ok} className="h-[58px] rounded-2xl bg-kgreen-solid text-lg font-bold text-white disabled:opacity-40">
            Enregistrer
          </button>
        </form>
      </DialogContent>
    </Dialog>
    <DayPicker open={picking} onOpenChange={setPicking} value={dueDay} onPick={d => setDueDay(d)} />
    </>
  )
}

const dayText = (d: number) => (d >= LAST_DAY ? 'Fin du mois' : `Le ${d} de chaque mois`)

// ——— Choisir le jour de paie : 1 à 28, ou la fin du mois ———
function DayPicker({ open, onOpenChange, value, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; value: number | null; onPick: (d: number) => void }) {
  const pick = (d: number) => {
    onPick(d)
    onOpenChange(false)
  }
  const cell = (on: boolean) => cn('h-11 rounded-xl text-base tabular-nums', on ? 'bg-kgold font-bold text-white dark:text-black' : 'border bg-background font-semibold')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="text-left">
          <DialogTitle className="text-left text-lg">Je le paie le</DialogTitle>
          <DialogDescription className="text-left">Choisissez le jour de paie de chaque mois</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 pb-2">
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
              <button key={d} type="button" onClick={() => pick(d)} className={cell(value === d)} aria-pressed={value === d}>
                {d}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => pick(LAST_DAY)} className={cell(value === LAST_DAY)} aria-pressed={value === LAST_DAY}>
            Fin du mois
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
