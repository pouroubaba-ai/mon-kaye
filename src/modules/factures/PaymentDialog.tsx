// ——— Versement sur les factures : comme un versement dans Kayé ———
// 1. De qui ? (les clients qui doivent, avec leur reste)  2. Combien ? (« Il doit encore … »)
// Le versement paie ses factures dans l'ordre, la plus ancienne d'abord.
import React from 'react'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { Input } from '@/components/ui/input'
import { cn, plain } from '@/lib/utils'
import { useInvoices } from './store'
import { clientKeyOf, money, totals } from './view'

export type PayTarget = { clientKey: string; personId?: string; clientName: string }
const thousands = (s: string) => (s ? Number(s).toLocaleString('fr-FR').replace(/\s/g, ' ') : '')
const digits = (s: string) => s.split(/[.,]/)[0].replace(/\D/g, '').slice(0, 10)

export function PaymentDialog({ target, onClose }: { target: PayTarget | 'choose' | null; onClose: () => void }) {
  const { invoices, paid, addPayment } = useInvoices()
  const [who, setWho] = React.useState<PayTarget | null>(null)
  const [search, setSearch] = React.useState('')
  const [amount, setAmount] = React.useState('')
  React.useEffect(() => {
    if (!target) return
    setWho(target === 'choose' ? null : target)
    setSearch('')
    setAmount('')
  }, [target])

  // Ce que chaque client doit encore sur ses factures
  const dues = React.useMemo(() => {
    const m = new Map<string, PayTarget & { due: number }>()
    for (const i of invoices) {
      if (i.kind !== 'facture') continue
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
  const n = parseInt(amount, 10) || 0
  const tooMuch = n > due
  const ok = !!who && n > 0 && !tooMuch

  const save = () => {
    if (!ok || !who) return
    addPayment({ ...who, amount: n })
    onClose()
  }

  return (
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
            className="flex min-h-0 flex-1 flex-col gap-4"
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
              <span className="text-sm text-muted-foreground">
                Il doit encore <span className="font-semibold text-kgreen">{money(due)}</span>
              </span>
              {tooMuch && <span className="text-xs text-kred">C'est plus que ce qu'il doit sur ses factures.</span>}
              <button type="button" onClick={() => setAmount(String(due))} className="mt-2 h-9 rounded-full border px-4 text-sm font-semibold text-muted-foreground">
                Tout ({money(due)})
              </button>
            </div>
            <div className="flex-1" />
            <button type="submit" disabled={!ok} className="h-[56px] rounded-2xl bg-kgreen-solid text-lg font-bold text-white disabled:opacity-40">
              Enregistrer
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
