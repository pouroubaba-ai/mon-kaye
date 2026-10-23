import * as React from 'react'
import { Banknote, FileText, Plus, X } from 'lucide-react'

import { useStore } from '@/data/store'
import type { Movement } from '@/data/mockData'
import { dueDateOf, payrollOf, periodBounds, dueDayOf } from '@/data/payroll'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { PayslipDialog } from '@/components/modals/PayslipDialog'
import { cn } from '@/lib/utils'
import { amt } from '@/modules/personnes/view'
import { inDays, monthName, shortDate, shortDay } from '@/modules/employes/view'
import { daysUntil, toTime } from '@/data/payroll'

// ——— Une période de paie (« Paie de septembre ») ———
// Terminée : on la regarde seulement (le reste se verse depuis la fiche de l'employé).
// En cours : on peut encore ajouter une prime ou une retenue, ou enlever celles qu'on a ajoutées.

const motifOf = (m: Movement) => {
  const i = m.label.indexOf(':')
  return i >= 0 ? m.label.slice(i + 1).trim() : m.note || ''
}

export function PeriodSheet({ empId, period, open, onOpenChange }: { empId: string; period: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { persons, movements, monthStates, cancelMovement } = useStore()
  const [adding, setAdding] = React.useState(false)
  const [slip, setSlip] = React.useState(false)
  const kept = React.useRef(period)
  if (period) kept.current = period
  const p = kept.current
  const emp = persons.find(x => x.id === empId)
  if (!emp || !p) return null
  const pr = payrollOf(empId, movements, monthStates)
  const row = pr.months.find(m => m.period === p)
  if (!row) return null

  const enCours = row.state === 'en_cours'
  const editable = enCours && emp.status !== 'inactif'
  const { start, end } = periodBounds(p, dueDayOf(empId))
  const live = row.items.filter(m => !m.isCancelled)
  const base = live.filter(m => m.type === 'salaire_du').reduce((a, m) => a + m.amount, 0)
  const adds = live.filter(m => m.type === 'ajout_salaire')
  const cuts = live.filter(m => m.type === 'retenue_manuelle')
  const advCut = live.filter(m => m.type === 'retenue_salaire').reduce((a, m) => a + m.amount, 0)
  const planned = enCours && advCut === 0 ? pr.plannedRetenue : 0
  const total = row.aPayer
  const pays = [...row.paymentParts].sort((a, b) => toTime(b.mov.date) - toTime(a.mov.date))
  const days = daysUntil(dueDateOf(p, empId))

  const line = (label: string, sub: string, value: React.ReactNode, onRemove?: () => void) => (
    <div className="flex items-center justify-between gap-2 py-2.5 text-[15px]">
      <span className="flex min-w-0 flex-col">
        <span>{label}</span>
        {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {value}
        {onRemove ? (
          <button type="button" aria-label={`Enlever : ${label}`} onClick={onRemove} className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
            <X className="size-3.5" />
          </button>
        ) : (
          editable && <span className="w-7" />
        )}
      </span>
    </div>
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent fixedHeight>
          <DialogHeader className="gap-0.5 text-left">
            <DialogTitle className="flex items-center gap-2 text-left text-xl">
              Paie {/^[aeiouéâ]/i.test(monthName(p)) ? "d'" : 'de '}
              {monthName(p)}
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', enCours ? 'bg-kgold/15 text-kgold' : row.state === 'annule' ? 'bg-muted text-muted-foreground' : 'bg-kgreen/15 text-kgreen')}>
                {enCours ? 'En cours' : row.state === 'annule' ? 'Annulée' : 'Terminé'}
              </span>
            </DialogTitle>
            <DialogDescription className="text-left">
              {emp.name} · du {shortDate(start)} au {shortDate(end)}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3.5 pb-2 min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col rounded-[14px] border bg-background px-3.5 py-1">
              {line('Salaire de base', '', <span className="tabular-nums">{amt(base)}</span>)}
              {adds.map(m => line('Prime', [motifOf(m), m.date ? `ajoutée le ${shortDay(m.date)}` : ''].filter(Boolean).join(' · '), <span className="text-kred tabular-nums">+ {amt(m.amount)}</span>, editable ? () => cancelMovement(m.id, 'Enlevée de la paie') : undefined))}
              {cuts.map(m => line('Retenue', motifOf(m), <span className="text-kgreen tabular-nums">− {amt(m.amount)}</span>, editable ? () => cancelMovement(m.id, 'Enlevée de la paie') : undefined))}
              {(advCut > 0 || planned > 0) && line('Retenue pour son avance', enCours ? 'Chaque mois, toute seule' : '', <span className="text-kgreen tabular-nums">− {amt(advCut || planned)}</span>)}
              {editable && (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="my-1.5 flex h-11 items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-kgold/60 bg-kgold/5 text-sm font-semibold text-kgold"
                >
                  <Plus className="size-[18px]" strokeWidth={2.4} /> Ajouter une prime ou une retenue
                </button>
              )}
              <div className="flex items-center justify-between border-t py-3">
                <span className="flex flex-col gap-0.5">
                  <span className="text-base font-bold">{enCours ? `À payer le ${shortDate(dueDateOf(p, empId))}` : 'À payer'}</span>
                  {enCours && <span className="text-[13px] font-semibold text-kgold">{inDays(days)}</span>}
                </span>
                <span className="text-lg font-bold tabular-nums">{amt(total)}</span>
              </div>
            </div>

            <div className="flex flex-col rounded-[14px] border bg-background px-3.5 py-1">
              <span className="border-b py-2.5 text-[13px] font-semibold text-muted-foreground">Versements</span>
              {pays.length === 0 && <span className="py-3 text-sm text-muted-foreground">Rien versé pour l'instant</span>}
              {pays.map((x, i) => (
                <div key={x.mov.id} className={cn('flex items-center gap-3 py-2.5', i < pays.length - 1 && 'border-b border-border')}>
                  <span className="flex size-[34px] items-center justify-center rounded-[10px] bg-kblue/10 text-kblue">
                    <Banknote className="size-[18px]" />
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="text-sm font-semibold">{shortDay(x.mov.date)}</span>
                    <span className="text-xs text-muted-foreground">{x.mov.paymentMethod === 'mobile_money' ? 'Mobile Money' : 'Espèces'}</span>
                  </span>
                  <span className="text-[15px] font-bold text-kblue tabular-nums">{amt(x.amount)}</span>
                </div>
              ))}
            </div>

            {!enCours && row.reste > 0 && (
              <div className="flex items-baseline justify-between rounded-[14px] border border-kred/30 bg-kred/5 px-3.5 py-3">
                <span className="text-[15px] font-semibold">Reste à payer</span>
                <span className="text-[22px] font-bold text-kred tabular-nums">
                  {amt(row.reste)} <span className="text-[13px] font-medium text-muted-foreground">FCFA</span>
                </span>
              </div>
            )}

            <button type="button" onClick={() => setSlip(true)} className="flex h-14 items-center justify-center gap-2 rounded-2xl border text-[15px] font-semibold hover:bg-muted">
              <FileText className="size-[18px]" /> Fiche de paie
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <AddLineDialog empId={empId} period={p} max={row.reste} open={adding} onOpenChange={setAdding} />
      <PayslipDialog empId={empId} period={p} open={slip} onOpenChange={setSlip} />
    </>
  )
}

// ——— Ajouter une prime ou une retenue à la paie en cours ———
const REASONS = { ajout_salaire: ['Bon travail', 'Heures en plus', 'Fête', 'Autre'], retenue_manuelle: ['Absence', 'Retard', 'Casse', 'Autre'] } as const

export function AddLineDialog({ empId, period, max, open, onOpenChange }: { empId: string; period: string; max: number; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { persons, addMovement } = useStore()
  const [type, setType] = React.useState<'ajout_salaire' | 'retenue_manuelle'>('retenue_manuelle')
  const [amountStr, setAmountStr] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [note, setNote] = React.useState('')
  React.useEffect(() => {
    if (!open) return
    setType('retenue_manuelle')
    setAmountStr('')
    setReason('')
    setNote('')
  }, [open])
  const emp = persons.find(x => x.id === empId)
  if (!emp) return null
  const amount = parseInt(amountStr, 10) || 0
  const prime = type === 'ajout_salaire'
  const after = prime ? max + amount : max - amount
  const tooMuch = !prime && amount > max
  const motif = [reason !== 'Autre' ? reason : '', note.trim()].filter(Boolean).join(', ')
  const save = () => {
    if (amount <= 0 || tooMuch) return
    addMovement({
      personId: emp.id,
      personName: emp.name,
      type,
      label: `${prime ? 'Prime' : 'Retenue'}${motif ? ` : ${motif}` : ''}`,
      amount,
      period,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dirty={amount > 0} dirtyKind="ajout">
      <DialogContent fixedHeight>
        <DialogHeader className="gap-0.5 text-left">
          <DialogTitle className="text-left text-lg">Ajouter à la paie {/^[aeiouéâ]/i.test(monthName(period)) ? "d'" : 'de '}{monthName(period)}</DialogTitle>
          <DialogDescription className="text-left">{emp.name}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4 pb-2 min-h-0 flex-1 overflow-y-auto"
          onSubmit={e => {
            e.preventDefault()
            save()
          }}
        >
          <div role="tablist" aria-label="Type" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(['ajout_salaire', 'retenue_manuelle'] as const).map(t => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={type === t}
                onClick={() => {
                  setType(t)
                  setReason('')
                }}
                className={cn('h-11 rounded-[9px] text-[15px]', type === t ? (t === 'ajout_salaire' ? 'bg-kred-solid font-bold text-white shadow-sm' : 'bg-kgreen-solid font-bold text-white shadow-sm') : 'font-semibold text-muted-foreground')}
              >
                {t === 'ajout_salaire' ? '+ Prime' : '− Retenue'}
              </button>
            ))}
          </div>
          <label className="flex flex-col items-center gap-1 py-1.5">
            <span className="text-[13px] text-muted-foreground">{prime ? 'Je lui ajoute' : 'Je retiens'}</span>
            <span className="flex items-baseline gap-2">
              <input
                autoFocus
                inputMode="numeric"
                value={amountStr ? Number(amountStr).toLocaleString('fr-FR').replace(/\s/g, ' ') : ''}
                onChange={e => setAmountStr(e.target.value.replace(/\D/g, '').slice(0, 9))}
                placeholder="0"
                aria-label="Montant"
                style={{ width: `${Math.max(1, (amountStr ? Number(amountStr).toLocaleString('fr-FR').length : 1)) + 0.6}ch` }}
                className={cn('bg-transparent text-center text-[40px] font-bold tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/40', prime ? 'text-kred' : 'text-kgreen', tooMuch && 'text-destructive')}
              />
              <span className="text-base text-muted-foreground">FCFA</span>
            </span>
            {/* La place du message est toujours gardée : rien ne bouge quand il apparaît */}
            <span className="min-h-4 text-xs text-destructive">{tooMuch ? `Pas plus que ce qu'il reste à payer (${amt(max)})` : ''}</span>
          </label>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] text-muted-foreground">Pourquoi ?</span>
            {/* Toujours 4 choix sur 2 lignes : la fenêtre garde la même hauteur entre Prime et Retenue */}
            <div className="grid grid-cols-2 gap-2">
              {REASONS[type].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(reason === r ? '' : r)}
                  className={cn('h-10 rounded-full px-4 text-sm', reason === r ? 'border-[1.5px] border-kgold bg-kgold font-bold text-white dark:text-black' : 'border font-semibold text-muted-foreground')}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={prime ? 'Petite note (facultatif)' : 'Ex : 1 jour, le 14 oct.'}
            aria-label="Petite note"
            className="h-12 rounded-xl border bg-background px-3.5 text-[15px] outline-none"
          />
          <div className="flex justify-between rounded-xl bg-muted/60 px-3.5 py-3 text-sm">
            <span className="text-muted-foreground">À payer</span>
            <span>
              {amount > 0 && <span className="mr-2 text-muted-foreground line-through">{amt(max)}</span>}
              <b className="tabular-nums">{amt(Math.max(0, after))}</b>
            </span>
          </div>
          <button type="submit" disabled={amount <= 0 || tooMuch} className="h-[58px] rounded-2xl bg-kred-solid text-lg font-bold text-white disabled:opacity-40">
            Enregistrer
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

