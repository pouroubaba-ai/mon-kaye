// ——— Une ligne de la facture, et le clavier des unités ———
import React from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { cn } from '@/lib/utils'
import type { InvoiceLine } from './types'
import { lineTotal, money, qtyLabel, UNIT_GROUPS, unitFor } from './view'

const thousands = (s: string) => (s ? Number(s).toLocaleString('fr-FR').replace(/\s/g, ' ') : '')
const digits = (s: string) => s.replace(/\D/g, '').slice(0, 10)
// Quantité : chiffres et une virgule (« 1,5 »)
const qtyClean = (s: string) => {
  const v = s.replace('.', ',').replace(/[^\d,]/g, '')
  const [a, ...b] = v.split(',')
  return (b.length ? `${a.slice(0, 6)},${b.join('').slice(0, 2)}` : a.slice(0, 6))
}
const qtyNum = (s: string) => parseFloat(s.replace(',', '.')) || 0

const input = 'h-12 w-full rounded-xl border bg-background px-3.5 text-base outline-none focus:border-kgold'
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[13px] text-muted-foreground">{label}</span>
    {children}
  </div>
)

export function LineDialog({
  open,
  onOpenChange,
  line,
  onSave,
  onDelete,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  line: InvoiceLine | null // null : nouvelle ligne
  onSave: (l: InvoiceLine) => void
  onDelete?: () => void
}) {
  const [d, setD] = React.useState('')
  const [x, setX] = React.useState('')
  const [q, setQ] = React.useState('1')
  const [u, setU] = React.useState<string | undefined>(undefined)
  const [p, setP] = React.useState('')
  const [units, setUnits] = React.useState(false)
  React.useEffect(() => {
    if (!open) return
    setD(line?.d ?? '')
    setX(line?.x ?? '')
    setQ(line ? String(line.q).replace('.', ',') : '1')
    setU(line?.u)
    setP(line ? String(line.p) : '')
  }, [open, line])

  const draft: InvoiceLine = { d: d.trim(), ...(x.trim() ? { x: x.trim() } : {}), q: qtyNum(q), ...(u ? { u } : {}), p: parseInt(p, 10) || 0 }
  const ok = draft.d !== '' && draft.q > 0 && draft.p > 0
  const dirty = line ? JSON.stringify(draft) !== JSON.stringify(line) : d.trim() !== '' || p !== ''

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} dirty={dirty} dirtyKind={line ? 'modification' : 'ajout'}>
        <DialogContent fixedHeight>
          <DialogHeader className="text-left">
            <DialogTitle className="text-left text-xl">{line ? 'Modifier la ligne' : 'Une ligne'}</DialogTitle>
            <DialogDescription className="text-left">Ce que je facture</DialogDescription>
          </DialogHeader>
          <form
            className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto pb-2 [&>*]:shrink-0"
            onSubmit={e => {
              e.preventDefault()
              if (ok) onSave(draft)
            }}
          >
            <Field label="Désignation">
              <input value={d} onChange={e => setD(e.target.value)} placeholder="Ex : Location pelle mécanique" aria-label="Désignation" className={input} />
            </Field>
            <Field label="Détail (facultatif)">
              <input value={x} onChange={e => setX(e.target.value)} placeholder="Ex : Carburant inclus" aria-label="Détail" className={cn(input, 'italic')} />
            </Field>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Quantité">
                <input inputMode="decimal" value={q} onChange={e => setQ(qtyClean(e.target.value))} aria-label="Quantité" className={cn(input, 'text-lg font-bold tabular-nums')} />
              </Field>
              <Field label="Unité">
                <button
                  type="button"
                  onClick={() => setUnits(true)}
                  className={cn('flex h-12 items-center justify-between rounded-xl border-2 px-3 text-base font-bold', u ? 'border-kgold bg-kgold text-white dark:text-black' : 'border-kgold/70 bg-kgold/10 text-kgold')}
                >
                  <span className="truncate">{u ? unitFor(u, qtyNum(q)) : 'Choisir'}</span>
                  <ChevronDown className="size-4 shrink-0" />
                </button>
              </Field>
            </div>
            <Field label={`Prix pour 1 ${u ?? 'unité'}`}>
              <label className="flex h-12 items-center gap-2 rounded-xl border bg-background px-3.5 focus-within:border-kgold">
                <input
                  inputMode="numeric"
                  value={thousands(p)}
                  onChange={e => setP(digits(e.target.value))}
                  placeholder="0"
                  aria-label="Prix pour une unité"
                  className="min-w-0 flex-1 bg-transparent text-lg font-bold tabular-nums outline-none placeholder:text-muted-foreground/40"
                />
                <span className="flex-none text-sm text-muted-foreground">FCFA</span>
              </label>
            </Field>
            <div className="flex items-center justify-between gap-2 rounded-xl border bg-muted/40 px-3.5 py-3">
              <span className="truncate text-sm text-muted-foreground">
                {qtyLabel(draft)} × {money(draft.p)}
              </span>
              <span className="shrink-0 text-lg font-bold tabular-nums">{money(lineTotal(draft))} FCFA</span>
            </div>
            <div className="flex-1" />
            <div className="flex gap-2.5">
              {line && onDelete && (
                <button type="button" aria-label="Retirer la ligne" onClick={onDelete} className="flex h-[56px] w-[60px] items-center justify-center rounded-2xl border border-kred/50 text-kred">
                  <Trash2 className="size-5" />
                </button>
              )}
              <button type="submit" disabled={!ok} className="h-[56px] flex-1 rounded-2xl bg-foreground text-lg font-bold text-background disabled:opacity-40">
                {line ? 'Enregistrer la ligne' : 'Ajouter la ligne'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <UnitPicker open={units} onOpenChange={setUnits} value={u} onPick={v => (setU(v), setUnits(false))} />
    </>
  )
}

// Le clavier des unités : on touche une unité ; « Autre » pour écrire la sienne
export function UnitPicker({ open, onOpenChange, value, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; value?: string; onPick: (u: string | undefined) => void }) {
  const known = UNIT_GROUPS.some(g => g.units.includes(value ?? ''))
  const [other, setOther] = React.useState('')
  React.useEffect(() => {
    if (open) setOther(value && !known ? value : '')
  }, [open, value, known])
  const key = (u: string) => (
    <button
      key={u}
      type="button"
      onClick={() => onPick(u)}
      aria-pressed={value === u}
      className={cn('h-[42px] truncate rounded-[11px] px-1 text-sm', value === u ? 'bg-kgold font-extrabold text-white dark:text-black' : 'bg-muted font-semibold')}
    >
      {u}
    </button>
  )
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fixedHeight>
        <DialogHeader className="text-left">
          <DialogTitle className="text-left text-xl">Unité</DialogTitle>
          <DialogDescription className="text-left">Touche l'unité de la quantité</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-2">
          {UNIT_GROUPS.map(g => (
            <div key={g.label}>
              <div className="mt-3 mb-2 text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">{g.label}</div>
              <div className="grid grid-cols-4 gap-[7px]">{g.units.map(key)}</div>
            </div>
          ))}
          <div className="mt-3 mb-2 text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">Autre</div>
          <form
            className="flex gap-2"
            onSubmit={e => {
              e.preventDefault()
              if (other.trim()) onPick(other.trim())
            }}
          >
            <input
              value={other}
              onChange={e => setOther(e.target.value.slice(0, 16))}
              placeholder="Écris ton unité (ex. : rouleau, benne…)"
              aria-label="Autre unité"
              className={cn(input, 'min-w-0 flex-1', value && !known && 'border-kgold')}
            />
            <button type="submit" disabled={!other.trim()} className="h-12 rounded-xl bg-kgold px-4 font-bold text-white disabled:opacity-40 dark:text-black">
              OK
            </button>
          </form>
          {value && (
            <button type="button" onClick={() => onPick(undefined)} className="mt-4 h-11 rounded-xl text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline">
              Sans unité
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
