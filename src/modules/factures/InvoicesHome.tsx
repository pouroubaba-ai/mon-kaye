// ——— Factures : l'accueil du module, et une facture ouverte ———
import React from 'react'
import { Banknote, ChevronDown, ChevronLeft, ChevronRight, Download, Eye, EyeOff, FileText, MoreVertical, Plus, Search, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { HomeTop } from '@/components/screens/HomeScreen'
import { PersonFormDialog } from '@/components/person-header'
import { PersonMenu } from '@/components/person-menu'
import { DetailBand } from '@/components/detail-band'
import { Banknotes } from '@/components/armed'
import { PaymentDetail, PaymentDialog, type PayTarget } from './PaymentDialog'
import { DateFilter } from '@/components/date-filter'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ALL_TIME, inRange, isFiltered, type DateRange } from '@/lib/date-range'
import { useStore } from '@/data/store'
import { cn, plain, waNumber } from '@/lib/utils'
import { initials } from '@/modules/personnes/view'
import { InvoiceEditor, PassagerBadge, type EditorStart } from './InvoiceEditor'
import { ClientInfos, type ClientInfo } from './ClientInfos'
import { PaperPreview, invoicePdf } from './InvoicePaper'
import { useInvoices } from './store'
import type { Invoice, InvoicePayment, InvoiceStatus } from './types'
import { billingLines, clientKeyOf, money, shortNumber, totals } from './view'

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const dateShort = (s: string) => {
  const [, m, d] = s.split('-').map(Number)
  return `${d} ${MOIS[m - 1]}`
}
const CHIP: Record<InvoiceStatus, [string, string]> = {
  payee: ['Payée', 'bg-kgreen/15 text-kgreen'],
  non_payee: ['Non payée', 'bg-kred/15 text-kred'],
  credit: ['Au crédit', 'bg-kred/15 text-kred'],
  devis: ['Devis', 'bg-kgold/15 text-kgold'],
  accepte: ['Accepté', 'bg-kgreen/15 text-kgreen'],
  refuse: ['Refusé', 'bg-muted text-muted-foreground'],
}
type ChipKey = InvoiceStatus | 'partiel' | 'annulee'
const CHIP2: Record<ChipKey, [string, string]> = { ...CHIP, partiel: ['Payée en partie', 'bg-kblue/15 text-kblue'], annulee: ['Annulée', 'bg-muted text-muted-foreground'] }
const Chip = ({ s, first }: { s: ChipKey; first?: boolean }) => <span className={cn(first ? '' : 'ml-1.5', 'inline-block shrink-0 rounded-full px-2 py-px align-[1px] text-[11px] font-bold', CHIP2[s][1])}>{CHIP2[s][0]}</span>
// Ce qui reste à payer sur une facture, et son état (selon les versements)
const useLeft = () => {
  const { paid } = useInvoices()
  const left = (i: Invoice) => (i.kind === 'facture' && !i.cancelled ? Math.max(0, totals(i).net - (paid.get(i.id) ?? 0)) : 0)
  const state = (i: Invoice): ChipKey => {
    if (i.cancelled) return 'annulee'
    if (i.kind === 'devis') return i.status
    const l = left(i)
    if (l <= 0) return 'payee'
    if ((paid.get(i.id) ?? 0) > 0) return 'partiel'
    return i.status === 'credit' ? 'credit' : 'non_payee'
  }
  return { left, state, paidOf: (i: Invoice) => paid.get(i.id) ?? 0 }
}
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`
// Les gros montants rapetissent pour rester dans leur case (jamais de débordement)
const fitBig = (v: number) => { const l = money(v).length; return l <= 9 ? 'text-2xl' : l <= 11 ? 'text-xl' : l <= 13 ? 'text-lg' : 'text-base' }
const fitSmall = (v: number) => { const l = money(v).length; return l <= 9 ? 'text-base' : l <= 11 ? 'text-sm' : 'text-xs' }

const clientKey = clientKeyOf
type ClientRow = { k: string; personId?: string; name: string; details?: string; list: Invoice[]; pays: InvoicePayment[]; archived?: boolean; passager?: boolean; phone?: string }

// ——— L'écran Factures, comme l'écran Clients ———
// Une bascule « À encaisser / Devis en attente » (et l'œil), la recherche, puis directement :
// - À encaisser : les clients qui doivent (du plus gros au plus petit) ; à jour et rangés repliés en bas ;
// - Devis en attente : les devis en cours.
// Toutes les factures (historique, période, non soldées…) : le bouton à côté de la recherche.
export function InvoicesHome() {
  const { invoices, payments, adoptClient } = useInvoices()
  const { persons } = useStore()
  const { left, paidOf } = useLeft()
  const [tab, setTab] = React.useState<'factures' | 'devis'>('factures')
  const [detail, setDetail] = React.useState(false) // l'œil : facturé / versé / reste
  const [search, setSearch] = React.useState('')
  const [editor, setEditor] = React.useState<EditorStart | null>(null)
  const [openId, setOpenId] = React.useState<string | null>(null)
  const [clientOpen, setClientOpen] = React.useState<string | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [paying, setPaying] = React.useState<PayTarget | 'choose' | null>(null)
  const [payOpen, setPayOpen] = React.useState<string | null>(null)
  const [all, setAll] = React.useState(false) // « Toutes les factures »
  const [showZero, setShowZero] = React.useState(false)
  const [showArchived, setShowArchived] = React.useState(false)

  const factures = invoices.filter(i => i.kind === 'facture' && !i.cancelled)
  const toCash = factures.filter(i => left(i) > 0)
  const pending = invoices.filter(i => i.kind === 'devis' && i.status === 'devis')
  const sumLeft = (l: Invoice[]) => l.reduce((a, i) => a + left(i), 0)
  const q = plain(search.trim())
  const searching = q !== ''

  // Les clients : ceux de Kayé, et ceux des factures (avec leurs factures et leurs versements)
  const clients = React.useMemo(() => {
    const m = new Map<string, ClientRow>()
    for (const p of persons) if (p.type === 'partner') m.set(p.id, { k: p.id, personId: p.id, name: p.name, details: billingLines(p).join(' · '), list: [], pays: [], archived: p.archived })
    for (const i of invoices) {
      const k = clientKey(i)
      if (!m.has(k)) m.set(k, { k, name: i.client.name, details: i.client.lines.join(' · '), list: [], pays: [] })
      m.get(k)!.list.push(i)
    }
    for (const pay of payments) m.get(pay.clientKey)?.pays.push(pay)
    // Client de passage : toutes ses factures sont « de passage » (il n'est pas dans mes clients)
    for (const c of m.values())
      if (!c.personId && c.list.length && c.list.every(i => i.client.passager)) {
        c.passager = true
        c.phone = c.list.find(i => i.client.phone)?.client.phone
      }
    return [...m.values()]
  }, [persons, invoices, payments])
  const rows = clients
    .map(c => {
      const open = c.list.filter(i => left(i) > 0)
      return { ...c, due: open.reduce((a, i) => a + left(i), 0), n: open.length }
    })
    .sort((a, b) => b.due - a.due || a.name.localeCompare(b.name, 'fr'))
  const found = searching ? rows.filter(c => plain(c.name).includes(q)) : []
  const owing = rows.filter(c => !c.archived && c.due > 0)
  const zero = rows.filter(c => !c.archived && c.due === 0 && !c.passager) // un client de passage qui a tout payé : seulement dans « Toutes les factures »
  const archived = rows.filter(c => c.archived)
  const quotes = pending
    .filter(i => !searching || plain(`${i.client.name} ${i.number} ${i.objet ?? ''}`).includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const opened = openId ? invoices.find(i => i.id === openId) ?? null : null
  const client = clientOpen ? clients.find(c => c.k === clientOpen) ?? null : null

  // L'œil : facturé, versé, reste (et combien de clients derrière)
  const facturé = factures.reduce((a, i) => a + totals(i).net, 0)
  const versé = factures.reduce((a, i) => a + paidOf(i), 0)
  const who = (n: number) => plural(n, 'client', 'clients')
  const nAll = new Set(factures.map(clientKey)).size
  const nPaid = new Set(factures.filter(i => paidOf(i) > 0).map(clientKey)).size
  const nDue = new Set(toCash.map(clientKey)).size

  const clientRow = (c: (typeof rows)[number], last: boolean) => (
    <button key={c.k} type="button" onClick={() => setClientOpen(c.k)} className={cn('flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-muted/40', !last && 'border-b')}>
      <span className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">{initials(c.name)}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-base font-semibold">{c.name}</span>
          {c.passager && <PassagerBadge />}
        </span>
        <span className="truncate text-[13px] text-muted-foreground">
          {c.archived && 'Rangé · '}
          {c.n === 0 ? 'À jour' : `${plural(c.n, 'facture', 'factures')}${c.list.some(i => left(i) > 0 && paidOf(i) > 0) ? ' · payée en partie' : ' non payée'}${c.n > 1 && !c.list.some(i => left(i) > 0 && paidOf(i) > 0) ? 's' : ''}`}
        </span>
      </span>
      {c.due > 0 ? <span className="shrink-0 text-base font-bold text-kgreen tabular-nums">{money(c.due)}</span> : <span className="shrink-0 text-sm text-muted-foreground">À jour</span>}
    </button>
  )
  const quoteRow = (inv: Invoice, last: boolean) => (
    <button key={inv.id} type="button" onClick={() => setOpenId(inv.id)} className={cn('flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-muted/40', !last && 'border-b')}>
      <span className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">{initials(inv.client.name)}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base font-semibold">{inv.client.name}</span>
        <span className="truncate text-[13px] text-muted-foreground">
          Devis N° {shortNumber(inv.number)} · {dateShort(inv.date)}
        </span>
      </span>
      <span className="shrink-0 text-base font-bold text-kgold tabular-nums">{money(totals(inv).net)}</span>
    </button>
  )

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <HomeTop />

      {/* La bascule, comme « On me doit / Je dois » : le montant est dans l'onglet ; toucher encore : l'œil */}
      <nav aria-label="Factures ou devis" className={cn('grid grid-cols-2', !detail && 'border-b')}>
        {(
          [
            ['factures', 'À encaisser', sumLeft(toCash), who(nDue), true],
            ['devis', 'Devis en attente', pending.reduce((a, i) => a + totals(i).net, 0), plural(pending.length, 'devis', 'devis'), false],
          ] as const
        ).map(([t, label, v, c, green]) => {
          const on = tab === t
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              onClick={() => (on ? green && setDetail(d => !d) : (setTab(t), setDetail(false), setSearch('')))}
              className={cn('flex flex-col items-center gap-0.5 border-b-[3px] px-2 py-3 transition-colors', on ? (green ? 'border-kgreen bg-kgreen/10' : 'border-kgold bg-kgold/10') : 'border-transparent opacity-75')}
            >
              <span className={cn('text-sm font-semibold', on ? (green ? 'text-kgreen' : 'text-kgold') : 'text-muted-foreground')}>{label}</span>
              <span className={cn('flex items-center gap-1.5 font-bold tracking-tight tabular-nums', fitBig(v), green ? 'text-kgreen' : 'text-kgold')}>
                {money(v)}
                {on && green && (detail ? <EyeOff className="size-4 opacity-70" /> : <Eye className="size-4 opacity-70" />)}
              </span>
              <span className="text-xs text-muted-foreground">{c}</span>
            </button>
          )
        })}
      </nav>

      {/* L'œil : facturé, versé, reste */}
      {detail && tab === 'factures' && (
        <div className="grid grid-cols-3 border-b bg-kgreen/5 px-4 py-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs text-muted-foreground">Facturé</span>
            <span className={cn('font-bold tabular-nums', fitSmall(facturé))}>{money(facturé)}</span>
            <span className="text-[11px] text-muted-foreground">{who(nAll)}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 border-x">
            <span className="text-xs text-muted-foreground">Versé</span>
            <span className={cn('font-bold text-kblue tabular-nums', fitSmall(versé))}>{money(versé)}</span>
            <span className="text-[11px] text-muted-foreground">{who(nPaid)}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs text-muted-foreground">Reste</span>
            <span className={cn('font-bold text-kgreen tabular-nums', fitSmall(sumLeft(toCash)))}>{money(sumLeft(toCash))}</span>
            <span className="text-[11px] text-muted-foreground">{who(nDue)}</span>
          </div>
        </div>
      )}

      {/* La recherche, « Toutes les factures », et « Nouveau » (nouveau client) */}
      <div className="mx-4 mt-3 flex items-center gap-1">
        <label className="flex h-[46px] min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-muted px-3.5 text-muted-foreground">
          <Search className="size-[18px] shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Chercher"
            aria-label="Chercher"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          {search && (
            <button type="button" aria-label="Effacer la recherche" onClick={() => setSearch('')} className="flex size-7 items-center justify-center rounded-full hover:bg-background">
              <X className="size-4" />
            </button>
          )}
        </label>
        <button type="button" aria-label="Toutes les factures" onClick={() => setAll(true)} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
          <FileText className="size-[22px]" />
        </button>
        <button type="button" aria-label="Nouveau client" onClick={() => setAdding(true)} className="flex h-[46px] shrink-0 items-center gap-1.5 rounded-xl bg-kgold px-3 text-sm font-bold text-white active:scale-[0.98] dark:text-black">
          <Plus className="size-[18px]" strokeWidth={2.4} /> Nouveau
        </button>
      </div>

      <div className="px-3 pt-1">
        {tab === 'devis' ? (
          quotes.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">{searching ? 'Rien trouvé.' : 'Aucun devis en attente.'}</p>
          ) : (
            quotes.map((inv, i) => quoteRow(inv, i === quotes.length - 1))
          )
        ) : searching ? (
          found.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">Personne ne s’appelle comme ça.</p>
          ) : (
            found.map((c, i) => clientRow(c, i === found.length - 1))
          )
        ) : (
          <>
            {owing.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Personne ne doit rien sur ses factures.</p>}
            {owing.map((c, i) => clientRow(c, i === owing.length - 1))}
            {/* Ceux qui sont à jour, puis ceux qu'on a rangés : repliés, comme sur l'écran Clients */}
            {zero.length > 0 && (
              <div className="mt-2">
                <button type="button" onClick={() => setShowZero(o => !o)} className="flex h-12 w-full items-center justify-between px-2 text-sm font-semibold text-muted-foreground">
                  À jour ({zero.length})
                  {showZero ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
                {showZero && <div className="animate-in fade-in duration-200">{zero.map((c, i) => clientRow(c, i === zero.length - 1))}</div>}
              </div>
            )}
            {archived.length > 0 && (
              <div className="mt-2">
                <button type="button" onClick={() => setShowArchived(o => !o)} className="flex h-12 w-full items-center justify-between px-2 text-sm font-semibold text-muted-foreground">
                  Rangés ({archived.length})
                  {showArchived ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
                {showArchived && <div className="animate-in fade-in duration-200">{archived.map((c, i) => clientRow(c, i === archived.length - 1))}</div>}
              </div>
            )}
          </>
        )}
      </div>

      {/* En bas : À encaisser → Facture et Versement ; Devis → Devis */}
      <div className={cn('fixed inset-x-0 bottom-0 z-30 mx-auto grid w-full max-w-xl gap-3 border-t bg-background px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]', tab === 'factures' ? 'grid-cols-2' : 'grid-cols-1')}>
        {tab === 'factures' ? (
          <>
            <button type="button" aria-label="Nouvelle facture" onClick={() => setEditor({ mode: 'new', kind: 'facture' })} className="flex h-[60px] items-center justify-center gap-2 rounded-2xl bg-kgreen-solid text-lg font-bold text-white active:scale-[0.98]">
              <Plus className="size-[22px]" strokeWidth={2.6} /> Facture
            </button>
            <button type="button" aria-label="Versement" onClick={() => setPaying('choose')} className="flex h-[60px] items-center justify-center gap-2 rounded-2xl border-2 border-kgreen-solid text-lg font-bold text-kgreen active:scale-[0.98]">
              <Banknotes className="size-6" /> Versement
            </button>
          </>
        ) : (
          <button type="button" aria-label="Nouveau devis" onClick={() => setEditor({ mode: 'new', kind: 'devis' })} className="flex h-[60px] items-center justify-center gap-2 rounded-2xl border-2 border-kgold text-lg font-bold text-kgold active:scale-[0.98]">
            <Plus className="size-[22px]" strokeWidth={2.6} /> Devis
          </button>
        )}
      </div>

      {all && <AllInvoices onBack={() => setAll(false)} onOpen={id => setOpenId(id)} />}
      {client && (
        <ClientFiche
          client={client}
          onBack={() => setClientOpen(null)}
          onOpen={id => setOpenId(id)}
          onOpenPay={id => setPayOpen(id)}
          onNew={kind => setEditor({ mode: 'new', kind, personId: client.personId })}
          onPay={() => setPaying({ clientKey: client.k, personId: client.personId, clientName: client.name })}
          onRegister={() => {
            const id = adoptClient(client.k)
            if (id) setClientOpen(id)
          }}
        />
      )}

      <PersonFormDialog type="partner" side="lui" noSex open={adding} onOpenChange={setAdding} onCreated={id => setClientOpen(id)} />
      <PaymentDialog target={paying} onClose={() => setPaying(null)} />
      <PaymentDetail id={payOpen} onClose={() => setPayOpen(null)} />
      <InvoiceSheet inv={opened} onClose={() => setOpenId(null)} onEdit={s => (setOpenId(null), setEditor(s))} />
      <InvoiceEditor
        start={editor}
        onClose={() => setEditor(null)}
        onSaved={inv => {
          setSearch('')
          setOpenId(inv.id) // elle s'ouvre : l'envoyer, ou dire s'il a payé
        }}
      />
    </div>
  )
}

// ——— Toutes les factures : l'historique, de la plus récente à la plus ancienne ———
// Factures ou devis ; toutes, non soldées ou soldées ; une période (calendrier) ; le total de ce qui est affiché.
function AllInvoices({ onBack, onOpen }: { onBack: () => void; onOpen: (id: string) => void }) {
  const { invoices } = useInvoices()
  const { left, state } = useLeft()
  const [kind, setKind] = React.useState<'facture' | 'devis'>('facture')
  const [which, setWhich] = React.useState<'toutes' | 'ouvertes' | 'soldees'>('toutes')
  const [range, setRange] = React.useState<DateRange>(ALL_TIME)
  const [search, setSearch] = React.useState('')
  const q = plain(search.trim())
  const open = (i: Invoice) => (i.kind === 'devis' ? i.status === 'devis' : left(i) > 0)
  const list = invoices
    .filter(i => i.kind === kind)
    .filter(i => (which === 'toutes' ? true : which === 'ouvertes' ? open(i) : !open(i) && !i.cancelled && i.status !== 'refuse'))
    .filter(i => inRange(i.date.split('-').reverse().join('/'), range))
    .filter(i => !q || plain(`${i.client.name} ${i.number} ${i.objet ?? ''}`).includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const live = list.filter(i => !i.cancelled && i.status !== 'refuse')
  const total = live.reduce((a, i) => a + (which === 'ouvertes' && kind === 'facture' ? left(i) : totals(i).net), 0)
  const words = kind === 'devis' ? (['Tous', 'En attente', 'Acceptés / refusés'] as const) : (['Toutes', 'Non soldées', 'Soldées'] as const)

  // Le retour du téléphone (Échap) ferme la page, sauf si une fenêtre est ouverte par-dessus
  const backRef = React.useRef(onBack)
  backRef.current = onBack
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.querySelectorAll('[role="dialog"]').length <= 1) backRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div role="dialog" aria-label="Toutes les factures" className="fixed inset-0 z-40 overflow-y-auto bg-background animate-in slide-in-from-right fade-in-50 duration-300 ease-out motion-reduce:animate-none">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <header className="flex items-center gap-2 px-3 pt-[calc(0.875rem+env(safe-area-inset-top))] pb-2">
          <button type="button" aria-label="Retour" onClick={onBack} className="flex size-11 items-center justify-center rounded-full hover:bg-muted">
            <ChevronLeft className="size-6" />
          </button>
          <span className="min-w-0 flex-1 truncate text-xl font-bold">Toutes les factures</span>
          {!isFiltered(range) && <DateFilter iconOnly value={range} onChange={setRange} align="end" />}
        </header>

        <div className="flex flex-col gap-3 px-4 pt-1">
          {/* Factures ou devis, et lesquelles */}
          <div className="flex items-center justify-between gap-2">
            <div role="tablist" aria-label="Factures ou devis" className="flex gap-1.5">
              {(
                [
                  ['facture', 'Factures'],
                  ['devis', 'Devis'],
                ] as const
              ).map(([v, label]) => (
                <button key={v} type="button" role="tab" aria-selected={kind === v} onClick={() => setKind(v)} className={cn('h-9 rounded-full px-4 text-sm', kind === v ? 'bg-foreground font-bold text-background' : 'border font-semibold text-muted-foreground')}>
                  {label}
                </button>
              ))}
            </div>
            <Select value={which} onValueChange={v => setWhich(v as typeof which)}>
              <SelectTrigger aria-label="Lesquelles" className="h-9 w-auto gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="toutes">{words[0]}</SelectItem>
                <SelectItem value="ouvertes">{words[1]}</SelectItem>
                <SelectItem value="soldees">{words[2]}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isFiltered(range) && <DateFilter value={range} onChange={setRange} />}

          <label className="flex h-[46px] items-center gap-2.5 rounded-xl bg-muted px-3.5 text-muted-foreground">
            <Search className="size-[18px] shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Chercher une facture, un client" aria-label="Chercher" className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground" />
            {search && (
              <button type="button" aria-label="Effacer la recherche" onClick={() => setSearch('')} className="flex size-7 items-center justify-center rounded-full hover:bg-background">
                <X className="size-4" />
              </button>
            )}
          </label>

          {list.length > 0 && (
            <p className="px-1 text-[13px] text-muted-foreground">
              {plural(list.length, kind === 'devis' ? 'devis' : 'facture', kind === 'devis' ? 'devis' : 'factures')} · {which === 'ouvertes' && kind === 'facture' ? 'reste ' : ''}
              {money(total)} FCFA
            </p>
          )}
        </div>

        <div className="px-3 pt-1">
          {list.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">{q ? 'Rien trouvé.' : isFiltered(range) ? 'Rien sur cette période.' : kind === 'devis' ? 'Aucun devis.' : 'Aucune facture.'}</p>
          ) : (
            list.map((inv, i) => (
              <button key={inv.id} type="button" onClick={() => onOpen(inv.id)} className={cn('flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-muted/40', i < list.length - 1 && 'border-b', (inv.cancelled || inv.status === 'refuse') && 'opacity-50')}>
                <span className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">{initials(inv.client.name)}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-base font-semibold">{inv.client.name}</span>
                    {inv.client.passager && !inv.client.personId && <PassagerBadge />}
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    N° {shortNumber(inv.number)} · {dateShort(inv.date)}
                    <Chip s={state(inv)} />
                  </span>
                </span>
                <span className={cn('shrink-0 text-base tabular-nums', open(inv) ? cn('font-bold', kind === 'devis' ? 'text-kgold' : 'text-kgreen') : 'font-semibold text-muted-foreground', (inv.cancelled || inv.status === 'refuse') && 'line-through')}>
                  {money(which === 'ouvertes' && kind === 'facture' ? left(inv) : totals(inv).net)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ——— La fiche d'un client (Factures), construite comme la fiche d'un client dans Kayé ———
// En haut : ←, son nom, son numéro (et ses infos de facture en petit), ⋮.
// Deux cartes, comme un client qui est aussi fournisseur : « À encaisser » et « Devis en cours ».
// On touche celle qu'on veut voir ; toucher encore « À encaisser » : Total facturé, Versé, Reste.
// L'historique : ses factures (+) et ses versements (−) ; ou ses devis en cours (et tous ses devis).
// En bas : Facture et Versement ; ou Devis.
function ClientFiche({ client, onBack, onOpen, onOpenPay, onNew, onPay, onRegister }: { client: ClientRow; onBack: () => void; onOpen: (id: string) => void; onOpenPay: (id: string) => void; onNew: (k: 'facture' | 'devis') => void; onPay: () => void; onRegister: () => void }) {
  const { persons } = useStore()
  const { removeClient } = useInvoices()
  const { left, state, paidOf } = useLeft()
  const person = client.personId ? persons.find(p => p.id === client.personId) : undefined
  const [side, setSide] = React.useState<'factures' | 'devis'>('factures')
  const [detail, setDetail] = React.useState(false)
  const [allQuotes, setAllQuotes] = React.useState(false)
  const [menu, setMenu] = React.useState(false)
  // L'historique : les factures d'abord ; le menu montre aussi les versements, ou tout
  const [show, setShow] = React.useState<'factures' | 'versements' | 'tout'>('factures')
  const byDate = <T extends { date: string; createdAt: string }>(a: T, b: T) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  const allFactures = client.list.filter(i => i.kind === 'facture')
  const factures = allFactures.filter(i => !i.cancelled)
  const livePays = client.pays.filter(p => !p.cancelled)
  const devisAll = client.list.filter(i => i.kind === 'devis').sort(byDate)
  const devisEnCours = devisAll.filter(i => i.status === 'devis')
  const total = factures.reduce((a, i) => a + totals(i).net, 0)
  const versé = factures.reduce((a, i) => a + paidOf(i), 0)
  const reste = factures.reduce((a, i) => a + left(i), 0)
  const nDue = factures.filter(i => left(i) > 0).length
  const lastPay = [...livePays].sort(byDate)[0]
  // L'historique : factures et versements mêlés, le plus récent en haut
  const history = [
    ...(show !== 'versements' ? allFactures.map(f => ({ kind: 'f' as const, date: f.date, createdAt: f.createdAt, f })) : []),
    ...(show !== 'factures' ? client.pays.map(p => ({ kind: 'p' as const, date: p.date, createdAt: p.createdAt, p })) : []),
  ].sort(byDate)
  const quotes = allQuotes ? devisAll : devisEnCours
  // Ses infos de facture : celles de sa fiche, sinon celles de sa dernière facture
  const lastClient = [...client.list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.client
  const info: ClientInfo = person
    ? { name: person.name, phone: person.phone, billing: person.billing, lines: billingLines(person) }
    : { name: client.name, phone: client.phone ?? lastClient?.phone, billing: lastClient?.billing, lines: lastClient?.lines }
  const [editInfo, setEditInfo] = React.useState(false)

  // Le retour du téléphone (Échap) ferme la fiche, sauf si une fenêtre est ouverte par-dessus
  const backRef = React.useRef(onBack)
  backRef.current = onBack
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.querySelectorAll('[role="dialog"]').length <= 1) backRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const card = (s: 'factures' | 'devis') => {
    const on = s === side
    const g = s === 'factures'
    return (
      <button
        key={s}
        type="button"
        onClick={() => (on ? g && setDetail(d => !d) : (setSide(s), setDetail(false)))}
        aria-pressed={on}
        className={cn(
          'flex flex-col gap-1 rounded-2xl p-3.5 text-left transition-all',
          on ? (g ? 'border-2 border-kgreen bg-gradient-to-br from-kgreen/20 to-card to-75%' : 'border-2 border-kgold bg-gradient-to-br from-kgold/20 to-card to-75%') : cn('border bg-card opacity-80', g ? 'border-kgreen/30' : 'border-kgold/30')
        )}
      >
        <span className="text-[13px] text-muted-foreground">{g ? 'À encaisser' : 'Devis en cours'}</span>
        <span className={cn('flex items-center gap-1.5 font-bold tabular-nums', fitBig(g ? reste : devisEnCours.reduce((a, i) => a + totals(i).net, 0)), g ? 'text-kgreen' : 'text-kgold')}>
          {money(g ? reste : devisEnCours.reduce((a, i) => a + totals(i).net, 0))}
          {on && g && (detail ? <EyeOff className="size-4 opacity-70" /> : <Eye className="size-4 opacity-70" />)}
        </span>
        <span className="text-xs text-muted-foreground">
          {g ? (nDue === 0 ? 'rien à encaisser' : plural(nDue, 'facture non payée', 'factures non payées')) : devisEnCours.length === 0 ? 'aucun devis' : plural(devisEnCours.length, 'devis', 'devis')}
        </span>
      </button>
    )
  }

  return (
    <div role="dialog" aria-label={client.name} className="fixed inset-0 z-40 overflow-y-auto bg-background animate-in slide-in-from-right fade-in-50 duration-300 ease-out motion-reduce:animate-none">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
        <header className="flex items-center gap-2 px-3 pt-[calc(0.875rem+env(safe-area-inset-top))] pb-2">
          <button type="button" aria-label="Retour" onClick={onBack} className="flex size-11 items-center justify-center rounded-full hover:bg-muted">
            <ChevronLeft className="size-6" />
          </button>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-xl font-bold">{client.name}</span>
              {client.passager && <PassagerBadge />}
            </span>
            {(person?.phone || client.phone) && <span className="truncate text-[13px] text-muted-foreground">{person?.phone || client.phone}</span>}
            <ClientInfos client={info} onEdit={person ? () => setEditInfo(true) : undefined} className="mt-1.5" />
          </div>
          {(
            <button type="button" aria-label="Plus d'options" onClick={() => setMenu(true)} className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
              <MoreVertical className="size-5" />
            </button>
          )}
        </header>

        <div className="flex flex-1 flex-col gap-3 px-4 pt-2 pb-[calc(7rem+env(safe-area-inset-bottom))]">
          {/* Client de passage : l'ajouter à mes clients, avec ses factures */}
          {client.passager && (
            <button type="button" onClick={onRegister} className="flex h-12 items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-violet-500/60 text-[15px] font-bold text-violet-600 dark:text-violet-300">
              <Plus className="size-[18px]" strokeWidth={2.6} /> L'enregistrer comme client
            </button>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            {card('factures')}
            {card('devis')}
          </div>
          {/* Toucher encore « À encaisser » : Total facturé, Versé, Reste */}
          {detail && side === 'factures' && <DetailBand total={total} paid={versé} rest={reste} tone="green" />}

          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="flex min-w-0 flex-col">
              <span className="text-[15px] font-semibold text-muted-foreground">{side === 'factures' ? 'Historique' : allQuotes ? 'Tous ses devis' : 'Ses devis en cours'}</span>
              {side === 'factures' && lastPay && <span className="truncate text-xs text-muted-foreground">Dernier versement le {dateShort(lastPay.date)}</span>}
            </span>
            {side === 'factures'
              ? (
                  <Select value={show} onValueChange={v => setShow(v as typeof show)}>
                    <SelectTrigger aria-label="Voir" className="h-9 w-auto gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="factures">Factures</SelectItem>
                      <SelectItem value="versements">Versements</SelectItem>
                      <SelectItem value="tout">Tout</SelectItem>
                    </SelectContent>
                  </Select>
                )
              : devisAll.length > devisEnCours.length && (
                  <button type="button" onClick={() => setAllQuotes(a => !a)} className="flex h-9 items-center rounded-[10px] border px-3 text-[13px] font-semibold text-muted-foreground hover:bg-muted">
                    {allQuotes ? 'En cours seulement' : `Tous ses devis (${devisAll.length})`}
                  </button>
                )}
          </div>

          <div className="flex flex-col">
            {side === 'factures' ? (
              history.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{show === 'versements' ? 'Aucun versement pour l’instant.' : 'Aucune facture pour l’instant.'}</p>
              ) : (
                history.map((h, i) =>
                  h.kind === 'f' ? (
                    <DocLine key={h.f.id} inv={h.f} chip={state(h.f)} sign last={i === history.length - 1} onOpen={() => onOpen(h.f.id)} />
                  ) : (
                    <button key={h.p.id} type="button" onClick={() => onOpenPay(h.p.id)} className={cn('flex items-center gap-3 px-1 py-3 text-left', i < history.length - 1 && 'border-b border-border', h.p.cancelled && 'opacity-50')}>
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-kblue/10 text-kblue">
                        <Banknote className="size-[18px]" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center gap-2 text-[15px] font-semibold">
                          <span className={cn(h.p.cancelled && 'line-through')}>Versement</span>
                          {h.p.cancelled && <span className="shrink-0 rounded-full bg-muted px-2 py-px text-[11px] font-semibold text-muted-foreground">Annulé</span>}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {dateShort(h.p.date)}
                          {h.p.note ? ` · ${h.p.note}` : ''}
                        </span>
                      </span>
                      <span className={cn('shrink-0 text-[15px] font-bold text-kblue tabular-nums', h.p.cancelled && 'line-through')}>− {money(h.p.amount)}</span>
                    </button>
                  )
                )
              )
            ) : quotes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{allQuotes ? 'Aucun devis pour ce client.' : 'Aucun devis en cours.'}</p>
            ) : (
              quotes.map((inv, i) => <DocLine key={inv.id} inv={inv} chip={state(inv)} last={i === quotes.length - 1} onOpen={() => onOpen(inv.id)} />)
            )}
          </div>
        </div>

        {/* En bas : les deux gros boutons du côté choisi */}
        <div className={cn('fixed inset-x-0 bottom-0 z-30 mx-auto grid w-full max-w-xl gap-3 border-t bg-background px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]', side === 'factures' && person ? 'grid-cols-2' : 'grid-cols-1')}>
          {side === 'factures' ? (
            <>
              {person && (
                <button type="button" onClick={() => onNew('facture')} className="flex h-[60px] items-center justify-center gap-2 rounded-2xl bg-kgreen-solid text-lg font-bold text-white active:scale-[0.98]">
                  <Plus className="size-[22px]" strokeWidth={2.6} /> Facture
                </button>
              )}
              <button type="button" disabled={reste <= 0} onClick={onPay} className="flex h-[60px] items-center justify-center gap-2 rounded-2xl border-2 border-kgreen-solid text-lg font-bold text-kgreen active:scale-[0.98] disabled:opacity-40">
                <Banknotes className="size-6" /> Versement
              </button>
            </>
          ) : (
            person && (
              <button type="button" onClick={() => onNew('devis')} className="flex h-[60px] items-center justify-center gap-2 rounded-2xl border-2 border-kgold text-lg font-bold text-kgold active:scale-[0.98]">
                <Plus className="size-[22px]" strokeWidth={2.6} /> Devis
              </button>
            )
          )}
        </div>
      </div>
      {person && <PersonMenu person={person} open={menu} onOpenChange={setMenu} />}
      {person && <PersonFormDialog person={person} noSex open={editInfo} onOpenChange={setEditInfo} />}
      {/* Un client seulement sur des factures (pas dans Kayé) : on peut le supprimer avec ses factures */}
      {!person && (
        <Dialog open={menu} onOpenChange={setMenu}>
          <DialogContent>
            <div className="flex flex-col gap-4">
              <DialogHeader className="gap-1 p-0">
                <DialogTitle className="text-left">Supprimer {client.name} ?</DialogTitle>
                <DialogDescription className="text-left">
                  {client.list.length === 1 ? 'Sa facture' : `Ses ${client.list.length} factures et devis`} et ses versements seront effacés pour toujours. On ne pourra pas revenir en arrière.
                </DialogDescription>
              </DialogHeader>
              {reste > 0 && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">Il doit encore {money(reste)} FCFA.</div>}
              <Button
                variant="destructive"
                size="lg"
                className="h-12"
                onClick={() => {
                  setMenu(false)
                  removeClient(client.k)
                  onBack()
                }}
              >
                Supprimer définitivement
              </Button>
              <Button variant="outline" size="lg" className="h-12" onClick={() => setMenu(false)}>
                Annuler
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// Une ligne de la fiche, comme une opération : icône, ce que c'est, quand, montant
function DocLine({ inv, chip, sign, last, onOpen }: { inv: Invoice; chip: ChipKey; sign?: boolean; last: boolean; onOpen: () => void }) {
  const devis = inv.kind === 'devis'
  const what = inv.objet || inv.lines.map(l => l.d).join(', ')
  return (
    <button type="button" onClick={onOpen} className={cn('flex items-center gap-3 px-1 py-3 text-left', !last && 'border-b border-border', (inv.status === 'refuse' || inv.cancelled) && 'opacity-50')}>
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-[10px]', devis ? 'bg-kgold/15 text-kgold' : 'bg-kgreen/15 text-kgreen')}>
        <FileText className="size-[18px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold">
          {devis ? 'Devis' : 'Facture'} N° {shortNumber(inv.number)}
        </span>
        <span className="flex min-w-0 items-center text-xs text-muted-foreground">
          <Chip s={chip} first />
          <span className="ml-1.5 truncate">
            {dateShort(inv.date)}
            {what ? ` · ${what}` : ''}
          </span>
        </span>
      </span>
      <span className={cn('shrink-0 text-[15px] font-bold tabular-nums', devis && 'text-kgold', (inv.status === 'refuse' || inv.cancelled) && 'line-through')}>
        {sign ? '+ ' : ''}
        {money(totals(inv).net)}
      </span>
    </button>
  )
}

// ——— Une facture ouverte : l'aperçu, et ce qu'on peut en faire ———
function InvoiceSheet({ inv, onClose, onEdit }: { inv: Invoice | null; onClose: () => void; onEdit: (s: EditorStart) => void }) {
  const { profile, setStatus, remove, addPayment, cancelInvoice } = useInvoices()
  const { left, state, paidOf } = useLeft()
  const { modules, setSelectedPersonId, persons } = useStore()
  const [askDelete, setAskDelete] = React.useState(false)
  const [asking, setAsking] = React.useState(false) // annuler la facture : le motif
  const [reason, setReason] = React.useState('')
  // Le PDF est préparé dès que la facture s'ouvre : « WhatsApp » l'envoie tout de suite
  const [pdf, setPdf] = React.useState<{ key: string; blob: Blob; name: string; save: () => void } | null>(null)
  // Garde la dernière facture pendant la fermeture (pas de fenêtre vide qui se referme)
  const kept = React.useRef(inv)
  if (inv) kept.current = inv
  const v = inv ?? kept.current
  const rest = v ? left(v) : 0
  const done = !!v && v.kind === 'facture' && !v.cancelled && rest <= 0
  // Sur le papier : « PAYÉE » quand elle est soldée par les versements
  const paper = v && done ? { ...v, status: 'payee' as const } : v
  const pdfKey = paper ? JSON.stringify([paper, profile]) : ''
  React.useEffect(() => {
    setAsking(false)
    setReason('')
  }, [inv?.id])
  React.useEffect(() => {
    if (!inv || !paper) return
    let alive = true
    invoicePdf(paper, profile)
      .then(r => alive && setPdf({ key: pdfKey, ...r }))
      .catch(e => console.error('[Kayé] PDF', e))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv ? pdfKey : ''])
  if (!v || !paper) return null
  const devis = v.kind === 'devis'
  const net = totals(v).net
  const st = state(v)
  const person = v.client.personId ? persons.find(p => p.id === v.client.personId) : undefined
  const ready = pdf && pdf.key === pdfKey ? pdf : null
  const phone = person?.phone ?? v.client.phone
  const message = `Bonjour ${v.client.name}, voici ${devis ? 'votre devis' : 'votre facture'} N° ${v.number} d'un montant de ${money(net)} FCFA.\n${profile.name}`

  // WhatsApp : le téléphone propose WhatsApp avec le PDF joint ; sinon le PDF est téléchargé et la discussion WhatsApp s'ouvre
  const whatsapp = () => {
    if (!ready) return
    const file = new File([ready.blob], ready.name, { type: 'application/pdf' })
    if (navigator.canShare?.({ files: [file] })) {
      void navigator.share({ files: [file], text: message }).catch(() => {})
      return
    }
    ready.save()
    const n = waNumber(phone)
    window.open(`https://wa.me/${n}?text=${encodeURIComponent(message)}`, '_blank')
  }
  const previewW = Math.min(300, window.innerWidth - 72)

  return (
    <>
      <Dialog open={!!inv} onOpenChange={o => !o && onClose()} dirty={asking && reason.trim() !== ''} dirtyKind="modification">
        <DialogContent fixedHeight>
          <DialogHeader className="text-left">
            <DialogTitle className="text-left text-xl">
              {devis ? 'Devis' : 'Facture'} {v.number}
            </DialogTitle>
            <DialogDescription className="text-left">
              {v.client.name} · {dateShort(v.date)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pt-1 pb-2 [&>*]:shrink-0">
            <div className={cn('flex items-center justify-between rounded-[14px] border p-3.5', v.cancelled ? 'bg-muted/40' : devis ? 'border-kgold/50 bg-kgold/5' : !done ? 'border-kgreen/40 bg-kgreen/5' : '')}>
              <span className="flex flex-col">
                <span className="text-[13px] text-muted-foreground">{v.cancelled ? 'Annulée' : devis ? 'Montant du devis' : done ? 'Payée' : 'Reste à encaisser'}</span>
                <span className={cn('text-[28px] leading-tight font-extrabold tabular-nums', v.cancelled ? 'line-through opacity-60' : devis ? 'text-kgold' : !done ? 'text-kgreen' : '')}>{money(devis || done || v.cancelled ? net : rest)}</span>
                {!devis && !v.cancelled && paidOf(v) > 0 && !done && (
                  <span className="text-xs text-muted-foreground">
                    Déjà versé <span className="font-semibold text-kblue">{money(paidOf(v))}</span> sur {money(net)}
                  </span>
                )}
                {v.cancelled && v.cancelReason && <span className="text-xs text-muted-foreground">Motif : {v.cancelReason}</span>}
                {v.status === 'credit' && !v.cancelled && <span className="text-xs text-muted-foreground">Ajoutée au crédit de {v.client.name}</span>}
                {v.fromQuote && <span className="text-xs text-muted-foreground">Faite à partir du devis {v.fromQuote}</span>}
              </span>
              <Chip s={st} />
            </div>

            <PaperPreview inv={paper} profile={profile} width={previewW} />

            {/* Ce qu'on peut faire, selon l'état */}
            {devis && v.status === 'devis' && (
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => onEdit({ mode: 'convert', base: v })} className="h-[56px] rounded-2xl bg-kgreen-solid text-base font-bold text-white">
                  Le client accepte : en faire une facture
                </button>
                <button type="button" onClick={() => setStatus(v.id, 'refuse')} className="h-11 rounded-xl text-sm font-semibold text-muted-foreground">
                  Le client refuse
                </button>
              </div>
            )}
            {!devis && !done && !v.cancelled && (
              <div className={cn('grid gap-2', modules.personnes && v.status === 'non_payee' ? 'grid-cols-2' : 'grid-cols-1')}>
                <button type="button" onClick={() => addPayment({ clientKey: clientKeyOf(v), personId: v.client.personId, clientName: v.client.name, amount: rest, invoiceId: v.id, note: `Facture N° ${shortNumber(v.number)}` })} className="h-[52px] rounded-2xl bg-kgreen-solid text-base font-bold text-white">
                  {paidOf(v) > 0 ? 'Il a payé le reste' : 'Il a payé'}
                </button>
                {modules.personnes && v.status === 'non_payee' && (
                  <button type="button" onClick={() => setStatus(v.id, 'credit')} className="h-[52px] rounded-2xl border-2 border-kgreen-solid text-[15px] font-bold text-kgreen">
                    Mettre à son crédit
                  </button>
                )}
              </div>
            )}
            {v.status === 'credit' && !v.cancelled && person && modules.personnes && (
              <button type="button" onClick={() => (onClose(), setSelectedPersonId(person.id))} className="h-[52px] rounded-2xl border-2 text-base font-bold">
                Voir son compte
              </button>
            )}

            {!v.cancelled && (
              <div className="grid grid-cols-3 gap-2 text-sm font-semibold">
                {v.status !== 'credit' && v.status !== 'accepte' && paidOf(v) === 0 && (
                  <button type="button" onClick={() => onEdit({ mode: 'edit', base: v })} className="h-11 rounded-xl border">
                    Modifier
                  </button>
                )}
                <button type="button" onClick={() => onEdit({ mode: 'duplicate', base: v })} className="h-11 rounded-xl border">
                  Refaire
                </button>
                {devis ? (
                  <button type="button" onClick={() => setAskDelete(true)} className="h-11 rounded-xl border border-kred/40 text-kred">
                    Supprimer
                  </button>
                ) : (
                  <button type="button" onClick={() => setAsking(true)} className="h-11 rounded-xl border border-kred/40 text-kred">
                    Annuler
                  </button>
                )}
              </div>
            )}
            {/* Annuler la facture : jamais supprimée, barrée avec son motif */}
            {asking && !v.cancelled && (
              <form
                className="flex flex-col gap-3 rounded-[14px] border border-kred/40 p-3.5 animate-in fade-in duration-200"
                onSubmit={e => {
                  e.preventDefault()
                  if (!reason.trim()) return
                  cancelInvoice(v.id, reason)
                  setAsking(false)
                }}
              >
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] text-muted-foreground">Motif de l'annulation</span>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Ex : erreur sur la facture, commande annulée…" className="resize-none rounded-xl border bg-background px-3.5 py-3 text-base outline-none focus:border-kred" />
                </label>
                <span className="text-xs text-muted-foreground">
                  Elle reste dans l'historique, barrée. {paidOf(v) > 0 ? 'Ce qui a été versé dessus passe sur ses autres factures. ' : ''}
                  {v.status === 'credit' ? 'Le crédit ajouté à son compte Kayé reste : annulez-le là-bas aussi.' : ''}
                </span>
                <button type="submit" disabled={!reason.trim()} className="h-12 rounded-2xl bg-kred-solid text-base font-bold text-white disabled:opacity-40">
                  Annuler la facture
                </button>
                <button type="button" onClick={() => setAsking(false)} className="h-10 text-sm font-semibold text-muted-foreground">
                  Garder la facture
                </button>
              </form>
            )}
          </div>

          {/* Envoyer : WhatsApp (avec le PDF), ou télécharger */}
          <div className="mt-2 flex shrink-0 gap-2.5">
            <button type="button" aria-label="Télécharger" disabled={!ready} onClick={() => ready?.save()} className="flex h-[56px] w-[64px] items-center justify-center rounded-2xl border-2 disabled:opacity-40">
              <Download className="size-6" />
            </button>
            <button type="button" disabled={!ready} onClick={whatsapp} className="flex h-[56px] flex-1 items-center justify-center gap-2 rounded-2xl text-lg font-bold text-white disabled:opacity-60" style={{ background: '#25d366' }}>
              <WhatsAppIcon />
              {ready ? 'WhatsApp' : 'Préparation…'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={askDelete} onOpenChange={setAskDelete}>
        <DialogContent>
          <div className="flex flex-col gap-4">
            <DialogHeader className="gap-1 p-0">
              <DialogTitle className="text-left">Supprimer ce devis ?</DialogTitle>
              <DialogDescription className="text-left">{v.number} · {v.client.name}. Il ne pourra pas être retrouvé.</DialogDescription>
            </DialogHeader>
            <Button
              variant="destructive"
              size="lg"
              className="h-12"
              onClick={() => {
                setAskDelete(false)
                onClose()
                remove(v.id)
              }}
            >
              Supprimer
            </Button>
            <Button variant="outline" size="lg" className="h-12" onClick={() => setAskDelete(false)}>
              Garder
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.85 9.85 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.2 8.2 0 0 1 8.24 8.25c0 4.54-3.7 8.23-8.23 8.23Zm4.52-6.17c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.48a.92.92 0 0 0-.66.31c-.23.25-.87.85-.87 2.07s.89 2.4 1.01 2.57c.12.16 1.75 2.67 4.25 3.75.59.26 1.05.41 1.41.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  )
}
