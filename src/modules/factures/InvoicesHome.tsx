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
import { PaymentDialog, type PayTarget } from './PaymentDialog'
import { useStore } from '@/data/store'
import { cn, plain } from '@/lib/utils'
import { initials } from '@/modules/personnes/view'
import { InvoiceEditor, type EditorStart } from './InvoiceEditor'
import { PaperPreview, downloadInvoice, shareInvoice } from './InvoicePaper'
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
type ChipKey = InvoiceStatus | 'partiel'
const CHIP2: Record<ChipKey, [string, string]> = { ...CHIP, partiel: ['Payée en partie', 'bg-kblue/15 text-kblue'] }
const Chip = ({ s, first }: { s: ChipKey; first?: boolean }) => <span className={cn(first ? '' : 'ml-1.5', 'inline-block shrink-0 rounded-full px-2 py-px align-[1px] text-[11px] font-bold', CHIP2[s][1])}>{CHIP2[s][0]}</span>
// Ce qui reste à payer sur une facture, et son état (selon les versements)
const useLeft = () => {
  const { paid } = useInvoices()
  const left = (i: Invoice) => (i.kind === 'facture' ? Math.max(0, totals(i).net - (paid.get(i.id) ?? 0)) : 0)
  const state = (i: Invoice): ChipKey => {
    if (i.kind === 'devis') return i.status
    const l = left(i)
    if (l <= 0) return 'payee'
    if ((paid.get(i.id) ?? 0) > 0) return 'partiel'
    return i.status === 'credit' ? 'credit' : 'non_payee'
  }
  return { left, state, paidOf: (i: Invoice) => paid.get(i.id) ?? 0 }
}
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

const clientKey = clientKeyOf
type View = 'facture' | 'client'
type ClientRow = { k: string; personId?: string; name: string; details?: string; list: Invoice[]; pays: InvoicePayment[]; archived?: boolean }

export function InvoicesHome() {
  const { invoices, payments, profileSet } = useInvoices()
  const { navigate, setSettingsView, persons } = useStore()
  const { left, state, paidOf } = useLeft()
  const [tab, setTab] = React.useState<'factures' | 'devis'>('factures')
  const [detail, setDetail] = React.useState(false) // l'œil : facturé / versé / reste
  const [view, setView] = React.useState<View>('facture')
  const [search, setSearch] = React.useState('')
  const [editor, setEditor] = React.useState<EditorStart | null>(null)
  const [openId, setOpenId] = React.useState<string | null>(null)
  const [clientOpen, setClientOpen] = React.useState<string | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [paying, setPaying] = React.useState<PayTarget | 'choose' | null>(null)

  const factures = invoices.filter(i => i.kind === 'facture')
  const toCash = factures.filter(i => left(i) > 0)
  const pending = invoices.filter(i => i.kind === 'devis' && i.status === 'devis')
  const sumLeft = (l: Invoice[]) => l.reduce((a, i) => a + left(i), 0)
  const sumNet = (l: Invoice[]) => l.reduce((a, i) => a + totals(i).net, 0)
  const q = plain(search.trim())
  // Vue par facture : les factures pas encore soldées (ou les devis en cours)
  const list = (tab === 'devis' ? pending : toCash)
    .filter(i => !q || plain(`${i.client.name} ${i.number} ${i.objet ?? ''}`).includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
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
    return [...m.values()]
  }, [persons, invoices, payments])
  const isShown = (i: Invoice) => (tab === 'devis' ? i.kind === 'devis' && i.status === 'devis' : left(i) > 0)
  const amountOf = (i: Invoice) => (tab === 'devis' ? totals(i).net : left(i))
  const rows = clients
    .filter(c => !q || plain(c.name).includes(q))
    .map(c => {
      const l = c.list.filter(isShown)
      return { ...c, due: l.reduce((a, i) => a + amountOf(i), 0), n: l.length }
    })
    .sort((a, b) => b.due - a.due || a.name.localeCompare(b.name, 'fr'))
  // Comme l'écran Clients : les rangés à part, repliés en bas (en cherchant, tout le monde)
  const clientRows = q ? rows : rows.filter(c => !c.archived)
  const archivedRows = q ? [] : rows.filter(c => c.archived)
  const [showArchived, setShowArchived] = React.useState(false)
  const opened = openId ? invoices.find(i => i.id === openId) ?? null : null
  const client = clientOpen ? clients.find(c => c.k === clientOpen) ?? null : null
  // Pour l'œil : facturé, versé, reste (et combien de clients derrière)
  const facturé = sumNet(factures)
  const versé = factures.reduce((a, i) => a + paidOf(i), 0)
  const nClientsDue = new Set(toCash.map(clientKey)).size
  const nClientsPaid = new Set(factures.filter(i => paidOf(i) > 0).map(clientKey)).size
  const nClientsAll = new Set(factures.map(clientKey)).size
  const who = (n: number) => plural(n, 'client', 'clients')

  const clientRow = (c: (typeof rows)[number], last: boolean) => (
    <button key={c.k} type="button" onClick={() => setClientOpen(c.k)} className={cn('flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-muted/40', !last && 'border-b')}>
      <span className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">{initials(c.name)}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base font-semibold">{c.name}</span>
        <span className="truncate text-[13px] text-muted-foreground">
          {c.archived && 'Rangé · '}
          {c.n === 0 ? (tab === 'devis' ? 'Aucun devis en cours' : 'Rien à encaisser') : tab === 'devis' ? plural(c.n, 'devis en cours', 'devis en cours') : plural(c.n, 'facture non payée', 'factures non payées')}
        </span>
      </span>
      <span className={cn('shrink-0 text-base tabular-nums', c.due > 0 ? cn('font-bold', tab === 'devis' ? 'text-kgold' : 'text-kgreen') : 'font-semibold text-muted-foreground')}>{money(c.due)}</span>
    </button>
  )

  const goProfile = () => {
    navigate('reglages')
    setSettingsView('factures')
  }

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <HomeTop />

      {/* Les deux onglets, comme « On me doit / Je dois » : le montant est dans l'onglet ; toucher encore : l'œil */}
      <nav aria-label="Factures ou devis" className={cn('grid grid-cols-2', !detail && 'border-b')}>
        {(
          [
            ['factures', 'À encaisser', sumLeft(toCash), plural(toCash.length, 'facture non payée', 'factures non payées'), true],
            ['devis', 'Devis en attente', sumNet(pending), plural(pending.length, 'devis', 'devis'), false],
          ] as const
        ).map(([t, label, v, c, green]) => {
          const on = tab === t
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              onClick={() => (on ? green && setDetail(d => !d) : (setTab(t), setDetail(false)))}
              className={cn('flex flex-col items-center gap-0.5 border-b-[3px] px-2 py-3 transition-colors', on ? (green ? 'border-kgreen bg-kgreen/10' : 'border-kgold bg-kgold/10') : 'border-transparent opacity-75')}
            >
              <span className={cn('text-sm font-semibold', on ? (green ? 'text-kgreen' : 'text-kgold') : 'text-muted-foreground')}>{label}</span>
              <span className={cn('flex items-center gap-1.5 text-2xl font-bold tracking-tight tabular-nums', green ? 'text-kgreen' : 'text-kgold')}>
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
            <span className="text-base font-bold tabular-nums">{money(facturé)}</span>
            <span className="text-[11px] text-muted-foreground">{who(nClientsAll)}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 border-x">
            <span className="text-xs text-muted-foreground">Versé</span>
            <span className="text-base font-bold text-kblue tabular-nums">{money(versé)}</span>
            <span className="text-[11px] text-muted-foreground">{who(nClientsPaid)}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs text-muted-foreground">Reste</span>
            <span className="text-base font-bold text-kgreen tabular-nums">{money(sumLeft(toCash))}</span>
            <span className="text-[11px] text-muted-foreground">{who(nClientsDue)}</span>
          </div>
        </div>
      )}

      {/* Mes infos de facture pas encore remplies */}
      {!profileSet && (
        <button type="button" onClick={goProfile} className="mx-4 mt-3 flex items-center gap-3 rounded-[14px] border-2 border-dashed border-kgold bg-kgold/5 p-3.5 text-left">
          <FileText className="size-6 shrink-0 text-kgold" />
          <span className="flex min-w-0 flex-col">
            <span className="text-[15px] font-bold">D'abord, mes infos de facture</span>
            <span className="text-[13px] text-muted-foreground">Mon logo, mon adresse, mes numéros : une seule fois, puis sur chaque facture.</span>
          </span>
        </button>
      )}

      {/* Les deux vues : par facture, par client */}
      <div role="tablist" aria-label="Vue" className="mx-4 mt-3 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {(
          [
            ['facture', tab === 'devis' ? 'Par devis' : 'Par facture'],
            ['client', 'Par client'],
          ] as const
        ).map(([v, label]) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn('h-[38px] rounded-[9px] text-sm transition-colors', view === v ? 'bg-foreground font-bold text-background shadow-sm' : 'font-semibold text-muted-foreground')}>
            {label}
          </button>
        ))}
      </div>

      {/* La recherche, puis « Nouveau » (nouveau client) juste après */}
      <div className="mx-4 mt-3 flex items-center gap-1">
        <label className="flex h-[46px] min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-muted px-3.5 text-muted-foreground">
          <Search className="size-[18px] shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={view === 'client' ? 'Chercher un client' : 'Chercher'}
            aria-label="Chercher"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          {search && (
            <button type="button" aria-label="Effacer la recherche" onClick={() => setSearch('')} className="flex size-7 items-center justify-center rounded-full hover:bg-background">
              <X className="size-4" />
            </button>
          )}
        </label>
        <button type="button" aria-label="Nouveau client" onClick={() => setAdding(true)} className="flex h-[46px] shrink-0 items-center gap-1.5 rounded-xl bg-kgold px-3 text-sm font-bold text-white active:scale-[0.98] dark:text-black">
          <Plus className="size-[18px]" strokeWidth={2.4} /> Nouveau
        </button>
      </div>

      <div className="px-3 pt-1">
        {view === 'facture' ? (
          list.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">{q ? 'Rien trouvé.' : tab === 'devis' ? 'Aucun devis en attente.' : 'Aucune facture à encaisser.'}</p>
          ) : (
            list.map((inv, i) => (
              <button key={inv.id} type="button" onClick={() => setOpenId(inv.id)} className={cn('flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-muted/40', i < list.length - 1 && 'border-b')}>
                <span className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">{initials(inv.client.name)}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base font-semibold">{inv.client.name}</span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    N° {inv.kind === 'devis' ? 'D-' : ''}
                    {shortNumber(inv.number)} · {dateShort(inv.date)}
                    <Chip s={state(inv)} />
                  </span>
                </span>
                <span className={cn('shrink-0 text-base font-bold tabular-nums', inv.kind === 'devis' ? 'text-kgold' : 'text-kgreen')}>{money(amountOf(inv))}</span>
              </button>
            ))
          )
        ) : (
          <>
            {clientRows.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">{q ? 'Personne ne s’appelle comme ça.' : 'Pas encore de client : touchez « Nouveau ».'}</p>}
            {clientRows.map((c, i) => clientRow(c, i === clientRows.length - 1))}
            {/* Les clients rangés : repliés, comme sur l'écran Clients */}
            {archivedRows.length > 0 && (
              <div className="mt-2">
                <button type="button" onClick={() => setShowArchived(o => !o)} className="flex h-12 w-full items-center justify-between px-2 text-sm font-semibold text-muted-foreground">
                  Rangés ({archivedRows.length})
                  {showArchived ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
                {showArchived && <div className="animate-in fade-in duration-200">{archivedRows.map((c, i) => clientRow(c, i === archivedRows.length - 1))}</div>}
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

      {client && (
        <ClientFiche
          client={client}
          onBack={() => setClientOpen(null)}
          onOpen={id => setOpenId(id)}
          onNew={kind => setEditor({ mode: 'new', kind, personId: client.personId })}
          onPay={() => setPaying({ clientKey: client.k, personId: client.personId, clientName: client.name })}
        />
      )}

      <PersonFormDialog type="partner" side="lui" noSex open={adding} onOpenChange={setAdding} onCreated={id => (setView('client'), setClientOpen(id))} />
      <PaymentDialog target={paying} onClose={() => setPaying(null)} />
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

// ——— La fiche d'un client (Factures), construite comme la fiche d'un client dans Kayé ———
// En haut : ←, son nom, son numéro (et ses infos de facture en petit), ⋮.
// Deux cartes, comme un client qui est aussi fournisseur : « À encaisser » et « Devis en cours ».
// On touche celle qu'on veut voir ; toucher encore « À encaisser » : Total facturé, Versé, Reste.
// L'historique : ses factures (+) et ses versements (−) ; ou ses devis en cours (et tous ses devis).
// En bas : Facture et Versement ; ou Devis.
function ClientFiche({ client, onBack, onOpen, onNew, onPay }: { client: ClientRow; onBack: () => void; onOpen: (id: string) => void; onNew: (k: 'facture' | 'devis') => void; onPay: () => void }) {
  const { persons } = useStore()
  const { left, state, paidOf } = useLeft()
  const person = client.personId ? persons.find(p => p.id === client.personId) : undefined
  const [side, setSide] = React.useState<'factures' | 'devis'>('factures')
  const [detail, setDetail] = React.useState(false)
  const [allQuotes, setAllQuotes] = React.useState(false)
  const [menu, setMenu] = React.useState(false)
  const byDate = <T extends { date: string; createdAt: string }>(a: T, b: T) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  const factures = client.list.filter(i => i.kind === 'facture')
  const devisAll = client.list.filter(i => i.kind === 'devis').sort(byDate)
  const devisEnCours = devisAll.filter(i => i.status === 'devis')
  const total = factures.reduce((a, i) => a + totals(i).net, 0)
  const versé = factures.reduce((a, i) => a + paidOf(i), 0)
  const reste = factures.reduce((a, i) => a + left(i), 0)
  const nDue = factures.filter(i => left(i) > 0).length
  const lastPay = [...client.pays].sort(byDate)[0]
  // L'historique : factures et versements mêlés, le plus récent en haut
  const history = [...factures.map(f => ({ kind: 'f' as const, date: f.date, createdAt: f.createdAt, f })), ...client.pays.map(p => ({ kind: 'p' as const, date: p.date, createdAt: p.createdAt, p }))].sort(byDate)
  const quotes = allQuotes ? devisAll : devisEnCours
  const infos = person ? billingLines(person).join(' · ') : client.details

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
        <span className={cn('flex items-center gap-1.5 text-2xl font-bold tabular-nums', g ? 'text-kgreen' : 'text-kgold')}>
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
    <div role="dialog" aria-label={client.name} className="fixed inset-0 z-40 overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
        <header className="flex items-center gap-2 px-3 pt-[calc(0.875rem+env(safe-area-inset-top))] pb-2">
          <button type="button" aria-label="Retour" onClick={onBack} className="flex size-11 items-center justify-center rounded-full hover:bg-muted">
            <ChevronLeft className="size-6" />
          </button>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-xl font-bold">{client.name}</span>
            {person?.phone && <span className="truncate text-[13px] text-muted-foreground">{person.phone}</span>}
            {infos && <span className="line-clamp-2 text-xs text-muted-foreground">{infos}</span>}
          </div>
          {person && (
            <button type="button" aria-label="Plus d'options" onClick={() => setMenu(true)} className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
              <MoreVertical className="size-5" />
            </button>
          )}
        </header>

        <div className="flex flex-1 flex-col gap-3 px-4 pt-2 pb-[calc(7rem+env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-2 gap-2.5">
            {card('factures')}
            {card('devis')}
          </div>
          {/* Toucher encore « À encaisser » : Total facturé, Versé, Reste */}
          {detail && side === 'factures' && <DetailBand total={total} paid={versé} rest={reste} tone="green" />}

          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold text-muted-foreground">{side === 'factures' ? 'Historique' : allQuotes ? 'Tous ses devis' : 'Ses devis en cours'}</span>
            {side === 'factures'
              ? lastPay && <span className="text-[13px] text-muted-foreground">Dernier versement le {dateShort(lastPay.date)}</span>
              : devisAll.length > devisEnCours.length && (
                  <button type="button" onClick={() => setAllQuotes(a => !a)} className="flex h-9 items-center rounded-[10px] border px-3 text-[13px] font-semibold text-muted-foreground hover:bg-muted">
                    {allQuotes ? 'En cours seulement' : `Tous ses devis (${devisAll.length})`}
                  </button>
                )}
          </div>

          <div className="flex flex-col">
            {side === 'factures' ? (
              history.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Aucune facture pour l'instant.</p>
              ) : (
                history.map((h, i) =>
                  h.kind === 'f' ? (
                    <DocLine key={h.f.id} inv={h.f} chip={state(h.f)} sign last={i === history.length - 1} onOpen={() => onOpen(h.f.id)} />
                  ) : (
                    <div key={h.p.id} className={cn('flex items-center gap-3 px-1 py-3', i < history.length - 1 && 'border-b border-border')}>
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-kblue/10 text-kblue">
                        <Banknote className="size-[18px]" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[15px] font-semibold">Versement</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {dateShort(h.p.date)}
                          {h.p.note ? ` · ${h.p.note}` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 text-[15px] font-bold text-kblue tabular-nums">− {money(h.p.amount)}</span>
                    </div>
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
    </div>
  )
}

// Une ligne de la fiche, comme une opération : icône, ce que c'est, quand, montant
function DocLine({ inv, chip, sign, last, onOpen }: { inv: Invoice; chip: ChipKey; sign?: boolean; last: boolean; onOpen: () => void }) {
  const devis = inv.kind === 'devis'
  const what = inv.objet || inv.lines.map(l => l.d).join(', ')
  return (
    <button type="button" onClick={onOpen} className={cn('flex items-center gap-3 px-1 py-3 text-left', !last && 'border-b border-border', inv.status === 'refuse' && 'opacity-50')}>
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
      <span className={cn('shrink-0 text-[15px] font-bold tabular-nums', devis && 'text-kgold', inv.status === 'refuse' && 'line-through')}>
        {sign ? '+ ' : ''}
        {money(totals(inv).net)}
      </span>
    </button>
  )
}

// ——— Une facture ouverte : l'aperçu, et ce qu'on peut en faire ———
function InvoiceSheet({ inv, onClose, onEdit }: { inv: Invoice | null; onClose: () => void; onEdit: (s: EditorStart) => void }) {
  const { profile, setStatus, remove, addPayment } = useInvoices()
  const { left, state, paidOf } = useLeft()
  const { modules, setSelectedPersonId, persons } = useStore()
  const [busy, setBusy] = React.useState(false)
  const [askDelete, setAskDelete] = React.useState(false)
  // Garde la dernière facture pendant la fermeture (pas de fenêtre vide qui se referme)
  const kept = React.useRef(inv)
  if (inv) kept.current = inv
  const v = inv ?? kept.current
  if (!v) return null
  const devis = v.kind === 'devis'
  const net = totals(v).net
  const rest = left(v)
  const done = !devis && rest <= 0
  const st = state(v)
  // Sur le papier : « PAYÉE » quand elle est soldée par les versements
  const paper = done ? { ...v, status: 'payee' as const } : v
  const person = v.client.personId ? persons.find(p => p.id === v.client.personId) : undefined
  const run = async (f: () => Promise<void>) => {
    setBusy(true)
    try {
      await f()
    } finally {
      setBusy(false)
    }
  }
  const previewW = Math.min(300, window.innerWidth - 72)

  return (
    <>
      <Dialog open={!!inv} onOpenChange={o => !o && onClose()}>
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
            <div className={cn('flex items-center justify-between rounded-[14px] border p-3.5', devis ? 'border-kgold/50 bg-kgold/5' : !done ? 'border-kgreen/40 bg-kgreen/5' : '')}>
              <span className="flex flex-col">
                <span className="text-[13px] text-muted-foreground">{devis ? 'Montant du devis' : done ? 'Payée' : 'Reste à encaisser'}</span>
                <span className={cn('text-[28px] leading-tight font-extrabold tabular-nums', devis ? 'text-kgold' : !done ? 'text-kgreen' : '')}>{money(devis || done ? net : rest)}</span>
                {!devis && paidOf(v) > 0 && !done && (
                  <span className="text-xs text-muted-foreground">
                    Déjà versé <span className="font-semibold text-kblue">{money(paidOf(v))}</span> sur {money(net)}
                  </span>
                )}
                {v.status === 'credit' && <span className="text-xs text-muted-foreground">Ajoutée au crédit de {v.client.name}</span>}
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
            {!devis && !done && (
              <div className={cn('grid gap-2', modules.personnes && v.status === 'non_payee' ? 'grid-cols-2' : 'grid-cols-1')}>
                <button type="button" onClick={() => addPayment({ clientKey: clientKeyOf(v), personId: v.client.personId, clientName: v.client.name, amount: rest, invoiceId: v.id, note: `Facture N° ${shortNumber(v.number)}` })} className="h-[52px] rounded-2xl bg-kgreen-solid text-base font-bold text-white">
                  {paidOf(v) > 0 ? `Il a payé le reste` : 'Il a payé'}
                </button>
                {modules.personnes && v.status === 'non_payee' && (
                  <button type="button" onClick={() => setStatus(v.id, 'credit')} className="h-[52px] rounded-2xl border-2 border-kgreen-solid text-[15px] font-bold text-kgreen">
                    Mettre à son crédit
                  </button>
                )}
              </div>
            )}
            {v.status === 'credit' && person && modules.personnes && (
              <button type="button" onClick={() => (onClose(), setSelectedPersonId(person.id))} className="h-[52px] rounded-2xl border-2 text-base font-bold">
                Voir son compte
              </button>
            )}

            <div className="grid grid-cols-3 gap-2 text-sm font-semibold">
              {v.status !== 'credit' && v.status !== 'accepte' && (
                <button type="button" onClick={() => onEdit({ mode: 'edit', base: v })} className="h-11 rounded-xl border">
                  Modifier
                </button>
              )}
              <button type="button" onClick={() => onEdit({ mode: 'duplicate', base: v })} className="h-11 rounded-xl border">
                Copier
              </button>
              <button type="button" onClick={() => setAskDelete(true)} className="h-11 rounded-xl border border-kred/40 text-kred">
                Supprimer
              </button>
            </div>
          </div>

          <div className="mt-2 flex shrink-0 gap-2.5">
            <button type="button" aria-label="Télécharger" disabled={busy} onClick={() => run(() => downloadInvoice(paper, profile))} className="flex h-[56px] w-[64px] items-center justify-center rounded-2xl border-2 disabled:opacity-40">
              <Download className="size-6" />
            </button>
            <button type="button" disabled={busy} onClick={() => run(() => shareInvoice(paper, profile))} className="h-[56px] flex-1 rounded-2xl text-lg font-bold text-white disabled:opacity-40" style={{ background: '#25d366' }}>
              {busy ? 'Préparation…' : devis && v.status === 'devis' ? 'Renvoyer' : 'Envoyer'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={askDelete} onOpenChange={setAskDelete}>
        <DialogContent>
          <div className="flex flex-col gap-4">
            <DialogHeader className="gap-1 p-0">
              <DialogTitle className="text-left">Supprimer {devis ? 'ce devis' : 'cette facture'} ?</DialogTitle>
              <DialogDescription className="text-left">
                {v.number} · {v.client.name}. {v.status === 'credit' ? 'Le crédit ajouté à son compte reste : annulez-le dans son compte si besoin.' : 'Elle ne pourra pas être retrouvée.'}
              </DialogDescription>
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
              Annuler
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
