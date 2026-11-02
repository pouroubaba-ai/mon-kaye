// ——— Versement sur les factures : comme un versement dans Kayé ———
// 1. De qui ? (les clients qui doivent, avec leur reste)  2. Combien ? (« Il doit encore … »)
// Le versement paie ses factures dans l'ordre, la plus ancienne d'abord.
import React from 'react'
import { ChevronLeft, ChevronRight, Eye, Search, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { Input } from '@/components/ui/input'
import { cn, plain } from '@/lib/utils'
import { useInvoices } from './store'
import { clientKeyOf, money, shortNumber, totals } from './view'

const MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const dateShort = (s: string) => {
  const [, m, d] = s.split('-').map(Number)
  return `${d} ${MOIS_C[m - 1]}`
}

export type PayTarget = { clientKey: string; personId?: string; clientName: string }
const thousands = (s: string) => (s ? Number(s).toLocaleString('fr-FR').replace(/\s/g, ' ') : '')
const digits = (s: string) => s.split(/[.,]/)[0].replace(/\D/g, '').slice(0, 10)

export function PaymentDialog({ target, onClose }: { target: PayTarget | 'choose' | null; onClose: () => void }) {
  const { invoices, paid, addPayment } = useInvoices()
  const [who, setWho] = React.useState<PayTarget | null>(null)
  const [search, setSearch] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [note, setNote] = React.useState('')
  const [showOpen, setShowOpen] = React.useState(false) // l'œil : les factures sur lesquelles il doit encore
  React.useEffect(() => {
    if (!target) return
    setWho(target === 'choose' ? null : target)
    setSearch('')
    setAmount('')
    setNote('')
    setShowOpen(false)
  }, [target])

  // Ce que chaque client doit encore sur ses factures
  const dues = React.useMemo(() => {
    const m = new Map<string, PayTarget & { due: number }>()
    for (const i of invoices) {
      if (i.kind !== 'facture' || i.cancelled) continue
      const l = totals(i).net - (paid.get(i.id) ?? 0)
      if (l <= 0) continue
      const k = clientKeyOf(i)
      const c = m.get(k) ?? { clientKey: k, personId: i.client.personId, clientName: i.client.name, due: 0 }
      c.due += l
      m.set(k, c)
    }
    return [...m.values()].sort((a, b) => b.due - a.due)
  }, [invoices, paid])
  const q = plain(search.trim())
  const shown = q ? dues.filter(d => plain(d.clientName).includes(q)) : dues
  const due = who ? dues.find(d => d.clientKey === who.clientKey)?.due ?? 0 : 0
  // Ses factures pas encore soldées (la plus ancienne d'abord : c'est elle que le versement paie en premier)
  const openInvoices = who
    ? invoices
        .filter(i => i.kind === 'facture' && !i.cancelled && clientKeyOf(i) === who.clientKey && totals(i).net - (paid.get(i.id) ?? 0) > 0)
        .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    : []
  const n = parseInt(amount, 10) || 0
  const tooMuch = n > due
  const ok = !!who && n > 0 && !tooMuch

  const save = () => {
    if (!ok || !who) return
    addPayment({ ...who, amount: n, ...(note.trim() ? { note: note.trim() } : {}) })
    onClose()
  }

  return (
    <>
    <Dialog open={!!target} onOpenChange={o => !o && onClose()} dirty={n > 0} dirtyKind="ajout">
      <DialogContent fixedHeight>
        <DialogHeader className="text-left">
          <div className="flex items-center gap-1">
            {who && target === 'choose' && (
              <button type="button" aria-label="Retour" onClick={() => setWho(null)} className="-ml-2 flex size-9 items-center justify-center rounded-full hover:bg-muted">
                <ChevronLeft className="size-5" />
              </button>
            )}
            <DialogTitle className="text-left text-xl">Versement</DialogTitle>
          </div>
          <DialogDescription className="truncate text-left">{who ? who.clientName : 'de qui ?'}</DialogDescription>
        </DialogHeader>

        {!who ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Chercher un client" value={search} onChange={e => setSearch(e.target.value)} className="pr-10 pl-9" />
              {search && (
                <button type="button" aria-label="Effacer la recherche" onClick={() => setSearch('')} className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="flex flex-col divide-y rounded-lg border">
                {shown.map(d => (
                  <button key={d.clientKey} type="button" onClick={() => setWho(d)} className="flex items-center gap-3 p-3 text-left hover:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.clientName}</p>
                      <p className="truncate text-xs text-kgreen">{money(d.due)} FCFA</p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
                {shown.length === 0 && <p className="p-3 text-sm text-muted-foreground">{q ? 'Personne ne s’appelle comme ça.' : 'Personne ne doit rien sur ses factures.'}</p>}
              </div>
            </div>
          </div>
        ) : (
          <form
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
            onSubmit={e => {
              e.preventDefault()
              save()
            }}
          >
            <div className="flex flex-col items-center gap-1 pt-4">
              <label className="flex items-baseline gap-2">
                <input
                  inputMode="numeric"
                  value={thousands(amount)}
                  onChange={e => setAmount(digits(e.target.value))}
                  placeholder="0"
                  aria-label="Montant versé"
                  style={{ width: `${Math.max(1, thousands(amount).length) + 0.6}ch` }}
                  className={cn('max-w-[260px] bg-transparent text-center text-[40px] font-bold tabular-nums outline-none placeholder:text-muted-foreground/40', tooMuch ? 'text-kred' : 'text-kblue')}
                />
                <span className="text-base text-muted-foreground">FCFA</span>
              </label>
              <button type="button" onClick={() => setShowOpen(o => !o)} aria-label="Voir les factures sur lesquelles il doit encore" className="flex items-center gap-1.5 text-sm text-muted-foreground">
                Il doit encore <span className="font-semibold text-kgreen">{money(due)}</span>
                <Eye className="size-4" />
              </button>
              {tooMuch && <span className="text-xs text-kred">C'est plus que ce qu'il doit sur ses factures.</span>}
              <button type="button" onClick={() => setAmount(String(due))} className="mt-2 h-9 rounded-full border px-4 text-sm font-semibold text-muted-foreground">
                Tout ({money(due)})
              </button>
            </div>
            {/* Pourquoi il verse : on le retrouve dans le détail du versement */}
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-muted-foreground">Pourquoi ? (facultatif)</span>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ex : avance sur chantier, solde…" className="h-12 rounded-xl border bg-background px-3.5 text-base outline-none focus:border-kgold" />
            </label>
            <div className="flex-1" />
            <button type="submit" disabled={!ok} className="h-[56px] rounded-2xl bg-kgreen-solid text-lg font-bold text-white disabled:opacity-40">
              Enregistrer
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
      {/* L'œil : les factures sur lesquelles il doit encore (la plus ancienne d'abord : le versement la paie en premier) */}
      <Dialog open={showOpen} onOpenChange={setShowOpen}>
        <DialogContent>
          <DialogHeader className="text-left">
            <DialogTitle className="text-left text-xl">Ce qu'il doit encore</DialogTitle>
            <DialogDescription className="text-left">
              {who?.clientName} · {money(due)} FCFA
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col pb-2">
            {openInvoices.map((i, k) => {
              const p = paid.get(i.id) ?? 0
              return (
                <div key={i.id} className={cn('flex items-center justify-between gap-3 py-3', k < openInvoices.length - 1 && 'border-b')}>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[15px] font-semibold">Facture N° {shortNumber(i.number)}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {dateShort(i.date)} · {money(totals(i).net)}
                      {p > 0 ? ` · déjà versé ${money(p)}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-[15px] font-bold text-kgreen tabular-nums">{money(totals(i).net - p)}</span>
                </div>
              )
            })}
            <span className="mt-2 text-xs text-muted-foreground">Le versement paie d'abord la facture la plus ancienne.</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ——— Le détail d'un versement : montant, date, pourquoi ; l'annuler (avec un motif, jamais supprimé) ———
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const dateLong = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return `${d} ${MOIS[m - 1]} ${y}`
}
export function PaymentDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { payments, invoices, cancelPayment } = useInvoices()
  const [asking, setAsking] = React.useState(false)
  const [reason, setReason] = React.useState('')
  const kept = React.useRef<(typeof payments)[number] | null>(null)
  const found = id ? payments.find(p => p.id === id) ?? null : null
  if (found) kept.current = found
  React.useEffect(() => {
    setAsking(false)
    setReason('')
  }, [id])
  const p = found ?? kept.current
  if (!p) return null
  const target = p.invoiceId ? invoices.find(i => i.id === p.invoiceId) : undefined
  const onKaye = invoices.some(i => i.status === 'credit' && clientKeyOf(i) === p.clientKey)
  const rows: [string, string][] = [
    ['Client', p.clientName],
    ['Date', dateLong(p.date)],
    ['Pourquoi', p.note || '—'],
    ...(target ? ([['Pour la facture', target.number]] as [string, string][]) : []),
  ]
  return (
    <Dialog open={!!id} onOpenChange={o => !o && onClose()} dirty={asking && reason.trim() !== ''} dirtyKind="modification">
      <DialogContent>
        <DialogHeader className="text-left">
          <DialogTitle className="text-left text-xl">Versement</DialogTitle>
          <DialogDescription className="text-left">{p.clientName}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pb-1">
          <span className={cn('text-center text-[36px] font-bold text-kblue tabular-nums', p.cancelled && 'line-through opacity-60')}>
            {money(p.amount)} <span className="text-base font-medium text-muted-foreground">FCFA</span>
          </span>
          {p.cancelled && (
            <div className="rounded-xl border bg-muted/40 px-3.5 py-2.5 text-sm">
              <span className="font-semibold">Annulé</span>
              {p.cancelledAt && ` le ${dateLong(p.cancelledAt)}`}
              {p.cancelReason && <span className="mt-0.5 block text-muted-foreground">Motif : {p.cancelReason}</span>}
            </div>
          )}
          <div className="flex flex-col rounded-xl border px-3.5">
            {rows.map(([k, v], i) => (
              <div key={k} className={cn('flex items-baseline justify-between gap-3 py-2.5', i < rows.length - 1 && 'border-b')}>
                <span className="shrink-0 text-[13px] text-muted-foreground">{k}</span>
                <span className="min-w-0 text-right text-[15px] font-semibold break-words">{v}</span>
              </div>
            ))}
          </div>
          {!p.cancelled &&
            (asking ? (
              <form
                className="flex flex-col gap-3 animate-in fade-in duration-200"
                onSubmit={e => {
                  e.preventDefault()
                  if (!reason.trim()) return
                  cancelPayment(p.id, reason)
                  setAsking(false)
                }}
              >
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] text-muted-foreground">Motif de l'annulation</span>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Ex : erreur de montant, versement en double…" className="resize-none rounded-xl border bg-background px-3.5 py-3 text-base outline-none focus:border-kred" />
                </label>
                {onKaye && <span className="text-xs text-muted-foreground">S'il a aussi été noté sur son compte Kayé, annulez-le là-bas aussi.</span>}
                <button type="submit" disabled={!reason.trim()} className="h-12 rounded-2xl bg-kred-solid text-base font-bold text-white disabled:opacity-40">
                  Annuler le versement
                </button>
                <button type="button" onClick={() => setAsking(false)} className="h-10 text-sm font-semibold text-muted-foreground">
                  Garder le versement
                </button>
              </form>
            ) : (
              <button type="button" onClick={() => setAsking(true)} className="h-12 rounded-2xl border border-kred/40 text-base font-semibold text-kred">
                Annuler ce versement
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
