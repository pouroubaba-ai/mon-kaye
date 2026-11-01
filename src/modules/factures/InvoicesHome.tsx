// ——— Factures : l'accueil du module, et une facture ouverte ———
import React from 'react'
import { ChevronLeft, Download, FileText, Pencil, Plus, Search, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { HomeTop } from '@/components/screens/HomeScreen'
import { PersonFormDialog } from '@/components/person-header'
import { useStore } from '@/data/store'
import { cn, plain } from '@/lib/utils'
import { initials } from '@/modules/personnes/view'
import { InvoiceEditor, type EditorStart } from './InvoiceEditor'
import { PaperPreview, downloadInvoice, shareInvoice } from './InvoicePaper'
import { useInvoices } from './store'
import type { Invoice, InvoiceStatus } from './types'
import { billingLines, money, shortNumber, totals } from './view'

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
const Chip = ({ s }: { s: InvoiceStatus }) => <span className={cn('ml-1.5 inline-block rounded-full px-2 py-px align-[1px] text-[11px] font-bold', CHIP[s][1])}>{CHIP[s][0]}</span>
const unpaid = (i: Invoice) => i.kind === 'facture' && (i.status === 'non_payee' || i.status === 'credit')
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

const key = (s: string) => plain(s).replace(/\s+/g, ' ').trim()
// Le client d'une facture : sa fiche dans Kayé, sinon son nom
const clientKey = (i: Invoice) => i.client.personId ?? `nom:${key(i.client.name)}`
type View = 'facture' | 'client'
type ClientRow = { k: string; personId?: string; name: string; details?: string; list: Invoice[] }

export function InvoicesHome() {
  const { invoices, profileSet } = useInvoices()
  const { navigate, setSettingsView, persons } = useStore()
  const [tab, setTab] = React.useState<'factures' | 'devis'>('factures')
  const [view, setView] = React.useState<View>('facture')
  const [search, setSearch] = React.useState('')
  const [editor, setEditor] = React.useState<EditorStart | null>(null)
  const [openId, setOpenId] = React.useState<string | null>(null)
  const [clientOpen, setClientOpen] = React.useState<string | null>(null)
  const [adding, setAdding] = React.useState(false)

  const toCash = invoices.filter(unpaid)
  const pending = invoices.filter(i => i.kind === 'devis' && i.status === 'devis')
  const sum = (l: Invoice[]) => l.reduce((a, i) => a + totals(i).net, 0)
  const q = plain(search.trim())
  const shown = tab === 'devis' ? pending : toCash
  // Vue par facture : les factures non soldées (ou les devis en cours)
  const list = shown
    .filter(i => !q || plain(`${i.client.name} ${i.number} ${i.objet ?? ''}`).includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  // Vue par client : tous les clients, avec ce qu'ils doivent (ou leurs devis en cours)
  const clients = React.useMemo(() => {
    const m = new Map<string, ClientRow>()
    for (const p of persons) if (p.type === 'partner' && !p.archived) m.set(p.id, { k: p.id, personId: p.id, name: p.name, details: billingLines(p).join('\n'), list: [] })
    for (const i of invoices) {
      const k = clientKey(i)
      if (!m.has(k)) m.set(k, { k, name: i.client.name, details: i.client.lines.join('\n'), list: [] })
      m.get(k)!.list.push(i)
    }
    return [...m.values()]
  }, [persons, invoices])
  const isShown = (i: Invoice) => (tab === 'devis' ? i.kind === 'devis' && i.status === 'devis' : unpaid(i))
  const clientRows = clients
    .filter(c => !q || plain(c.name).includes(q))
    .map(c => ({ ...c, due: sum(c.list.filter(isShown)), n: c.list.filter(isShown).length }))
    .sort((a, b) => b.due - a.due || a.name.localeCompare(b.name, 'fr'))
  const opened = openId ? invoices.find(i => i.id === openId) ?? null : null
  const client = clientOpen ? clients.find(c => c.k === clientOpen) ?? null : null

  const goProfile = () => {
    navigate('reglages')
    setSettingsView('factures')
  }

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <HomeTop />

      {/* Les deux onglets : le montant est dans l'onglet */}
      <nav aria-label="Factures ou devis" className="grid grid-cols-2 border-b">
        {(
          [
            ['factures', 'À encaisser', sum(toCash), plural(toCash.length, 'facture non payée', 'factures non payées'), 'kgreen'],
            ['devis', 'Devis en attente', sum(pending), plural(pending.length, 'devis', 'devis'), 'kgold'],
          ] as const
        ).map(([t, label, v, c, color]) => {
          const on = tab === t
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              onClick={() => setTab(t)}
              className={cn('flex flex-col items-center gap-0.5 border-b-[3px] px-2 py-3 transition-colors', on ? (color === 'kgreen' ? 'border-kgreen bg-kgreen/10' : 'border-kgold bg-kgold/10') : 'border-transparent opacity-75')}
            >
              <span className={cn('text-sm font-semibold', on ? (color === 'kgreen' ? 'text-kgreen' : 'text-kgold') : 'text-muted-foreground')}>{label}</span>
              <span className={cn('text-2xl font-bold tracking-tight tabular-nums', color === 'kgreen' ? 'text-kgreen' : 'text-kgold')}>{money(v)}</span>
              <span className="text-xs text-muted-foreground">{c}</span>
            </button>
          )
        })}
      </nav>

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
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {q ? 'Rien trouvé.' : tab === 'devis' ? 'Aucun devis en attente.' : 'Aucune facture à encaisser.'}
            </p>
          ) : (
            list.map((inv, i) => <InvoiceRow key={inv.id} inv={inv} last={i === list.length - 1} onOpen={() => setOpenId(inv.id)} />)
          )
        ) : clientRows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">{q ? 'Personne ne s’appelle comme ça.' : 'Pas encore de client : touchez « Nouveau ».'}</p>
        ) : (
          clientRows.map((c, i) => (
            <button key={c.k} type="button" onClick={() => setClientOpen(c.k)} className={cn('flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-muted/40', i < clientRows.length - 1 && 'border-b')}>
              <span className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">{initials(c.name)}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-base font-semibold">{c.name}</span>
                <span className="truncate text-[13px] text-muted-foreground">
                  {c.n === 0 ? (tab === 'devis' ? 'Aucun devis en cours' : 'Rien à encaisser') : tab === 'devis' ? plural(c.n, 'devis en cours', 'devis en cours') : plural(c.n, 'facture non payée', 'factures non payées')}
                </span>
              </span>
              <span className={cn('shrink-0 text-base font-bold tabular-nums', c.due > 0 ? (tab === 'devis' ? 'text-kgold' : 'text-kgreen') : 'font-semibold text-muted-foreground')}>{money(c.due)}</span>
            </button>
          ))
        )}
      </div>

      {/* Les deux gros boutons : nouvelle facture, nouveau devis */}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto grid w-full max-w-xl grid-cols-2 gap-3 border-t bg-background px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <button type="button" aria-label="Nouvelle facture" onClick={() => setEditor({ mode: 'new', kind: 'facture' })} className="flex h-[60px] items-center justify-center gap-2 rounded-2xl bg-kgreen-solid text-lg font-bold text-white active:scale-[0.98]">
          <Plus className="size-[22px]" strokeWidth={2.6} /> Facture
        </button>
        <button type="button" aria-label="Nouveau devis" onClick={() => setEditor({ mode: 'new', kind: 'devis' })} className="flex h-[60px] items-center justify-center gap-2 rounded-2xl border-2 border-kgold text-lg font-bold text-kgold active:scale-[0.98]">
          <Plus className="size-[22px]" strokeWidth={2.6} /> Devis
        </button>
      </div>

      {client && <ClientFiche client={client} onBack={() => setClientOpen(null)} onOpen={id => setOpenId(id)} onNew={kind => setEditor({ mode: 'new', kind, personId: client.personId })} />}

      <PersonFormDialog type="partner" side="lui" noSex open={adding} onOpenChange={setAdding} onCreated={id => (setView('client'), setClientOpen(id))} />
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

function InvoiceRow({ inv, last, onOpen }: { inv: Invoice; last: boolean; onOpen: () => void }) {
  const open = unpaid(inv) || inv.status === 'devis'
  return (
    <button type="button" onClick={onOpen} className={cn('flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-muted/40', !last && 'border-b')}>
      <span className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">{initials(inv.client.name)}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base font-semibold">{inv.client.name}</span>
        <span className="truncate text-[13px] text-muted-foreground">
          N° {inv.kind === 'devis' ? 'D-' : ''}
          {shortNumber(inv.number)} · {dateShort(inv.date)}
          <Chip s={inv.status} />
        </span>
      </span>
      <span className={cn('shrink-0 text-base tabular-nums', open ? (inv.kind === 'devis' ? 'font-bold text-kgold' : 'font-bold text-kgreen') : 'font-semibold text-muted-foreground', inv.status === 'refuse' && 'line-through')}>
        {money(totals(inv).net)}
      </span>
    </button>
  )
}

// ——— La fiche d'un client (Factures) : comme la fiche d'un client dans Kayé ———
// En haut : son nom, son numéro, et le stylo pour changer ses infos. Puis ses infos pour les factures,
// la grande carte « À encaisser », ses factures / ses devis en cours (et tous ses devis), et en bas Facture / Devis.
const BILLING_LABELS = [
  ['forme', 'Forme juridique'],
  ['rccm', 'RCCM'],
  ['niu', 'NIU'],
  ['adresse', 'Adresse'],
  ['ville', 'Ville'],
  ['email', 'E-mail'],
] as const
function ClientFiche({ client, onBack, onOpen, onNew }: { client: ClientRow; onBack: () => void; onOpen: (id: string) => void; onNew: (k: 'facture' | 'devis') => void }) {
  const { persons } = useStore()
  const person = client.personId ? persons.find(p => p.id === client.personId) : undefined
  const [tab, setTab] = React.useState<'factures' | 'devis'>('factures')
  const [allQuotes, setAllQuotes] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const byDate = (a: Invoice, b: Invoice) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  const factures = client.list.filter(i => i.kind === 'facture').sort((a, b) => Number(unpaid(b)) - Number(unpaid(a)) || byDate(a, b))
  const devisAll = client.list.filter(i => i.kind === 'devis').sort(byDate)
  const devisEnCours = devisAll.filter(i => i.status === 'devis')
  const nonPayees = factures.filter(unpaid)
  const due = nonPayees.reduce((a, i) => a + totals(i).net, 0)
  const list = tab === 'factures' ? factures : allQuotes ? devisAll : devisEnCours
  // Ses infos : chacune avec son nom (les anciennes, écrites d'un bloc, ligne par ligne)
  const infos: [string, string][] = person?.billing
    ? BILLING_LABELS.flatMap(([k, label]) => (person.billing?.[k]?.trim() ? [[label, person.billing[k]!.trim()] as [string, string]] : []))
    : (client.details ?? '').split('\n').filter(l => l.trim()).map(l => ['', l.trim()] as [string, string])
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
  return (
    <div role="dialog" aria-label={client.name} className="fixed inset-0 z-40 overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
        {/* Le haut, comme la fiche d'un client : ←, le nom et le numéro, le stylo */}
        <header className="flex items-center gap-2 px-3 pt-[calc(0.875rem+env(safe-area-inset-top))] pb-2">
          <button type="button" aria-label="Retour" onClick={onBack} className="flex size-11 items-center justify-center rounded-full hover:bg-muted">
            <ChevronLeft className="size-6" />
          </button>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-xl font-bold">{client.name}</span>
            {person?.phone && <span className="truncate text-[13px] text-muted-foreground">{person.phone}</span>}
          </div>
          {person && (
            <button type="button" aria-label="Modifier ses infos" onClick={() => setEditing(true)} className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
              <Pencil className="size-5" />
            </button>
          )}
        </header>

        <div className="flex flex-1 flex-col gap-3 px-4 pt-2 pb-[calc(7rem+env(safe-area-inset-bottom))]">
          {/* La grande carte : ce qu'il doit sur ses factures */}
          <div className="flex flex-col gap-1.5 rounded-[18px] border border-kgreen/30 bg-gradient-to-br from-kgreen/20 to-card to-70% p-[18px]">
            <span className="text-sm text-muted-foreground">À encaisser</span>
            <span className="text-[34px] leading-tight font-bold tracking-tight text-kgreen tabular-nums">
              {money(due)} <span className="text-base font-medium text-muted-foreground">FCFA</span>
            </span>
            <span className="text-[13px] text-muted-foreground">{nonPayees.length === 0 ? 'Aucune facture non payée' : plural(nonPayees.length, 'facture non payée', 'factures non payées')}</span>
          </div>

          {/* Ses infos pour les factures */}
          <div className="rounded-[18px] border bg-card">
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <span className="text-xs tracking-[0.08em] text-muted-foreground uppercase">Ses infos de facture</span>
              {person && (
                <button type="button" onClick={() => setEditing(true)} className="h-8 rounded-full px-2 text-sm font-semibold text-kgold">
                  {infos.length ? 'Modifier' : 'Ajouter'}
                </button>
              )}
            </div>
            {infos.length === 0 ? (
              <p className="px-4 pb-3.5 text-sm text-muted-foreground">Pas encore d'infos (forme juridique, RCCM, adresse…).</p>
            ) : (
              <div className="flex flex-col px-4 pb-1.5">
                {infos.map(([label, value], i) => (
                  <div key={i} className={cn('flex items-baseline justify-between gap-3 py-2.5', i < infos.length - 1 && 'border-b')}>
                    {label && <span className="shrink-0 text-[13px] text-muted-foreground">{label}</span>}
                    <span className={cn('min-w-0 text-[15px] font-semibold break-words', label ? 'text-right' : '')}>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ses factures / ses devis en cours */}
          <div role="tablist" aria-label="Factures ou devis" className="mt-1 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(
              [
                ['factures', `Factures (${factures.length})`],
                ['devis', `Devis en cours (${devisEnCours.length})`],
              ] as const
            ).map(([t, label]) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('h-[38px] rounded-[9px] text-sm transition-colors', tab === t ? 'bg-foreground font-bold text-background shadow-sm' : 'font-semibold text-muted-foreground')}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-col">
            {list.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{tab === 'factures' ? 'Aucune facture pour ce client.' : allQuotes ? 'Aucun devis pour ce client.' : 'Aucun devis en cours.'}</p>}
            {list.map((inv, i) => (
              <DocLine key={inv.id} inv={inv} last={i === list.length - 1} onOpen={() => onOpen(inv.id)} />
            ))}
            {tab === 'devis' && devisAll.length > devisEnCours.length && (
              <button type="button" onClick={() => setAllQuotes(a => !a)} className="mt-2 flex h-11 items-center justify-center rounded-xl border text-sm font-semibold text-muted-foreground">
                {allQuotes ? 'Seulement les devis en cours' : `Voir tous ses devis (${devisAll.length})`}
              </button>
            )}
          </div>
        </div>

        {person && (
          <div className="fixed inset-x-0 bottom-0 z-30 mx-auto grid w-full max-w-xl grid-cols-2 gap-3 border-t bg-background px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <button type="button" onClick={() => onNew('facture')} className="flex h-[60px] items-center justify-center gap-2 rounded-2xl bg-kgreen-solid text-lg font-bold text-white active:scale-[0.98]">
              <Plus className="size-[22px]" strokeWidth={2.6} /> Facture
            </button>
            <button type="button" onClick={() => onNew('devis')} className="flex h-[60px] items-center justify-center gap-2 rounded-2xl border-2 border-kgold text-lg font-bold text-kgold active:scale-[0.98]">
              <Plus className="size-[22px]" strokeWidth={2.6} /> Devis
            </button>
          </div>
        )}
      </div>
      {person && <PersonFormDialog person={person} noSex open={editing} onOpenChange={setEditing} />}
    </div>
  )
}

// Une ligne de la fiche : comme une opération (icône, ce que c'est, quand, montant)
function DocLine({ inv, last, onOpen }: { inv: Invoice; last: boolean; onOpen: () => void }) {
  const devis = inv.kind === 'devis'
  const open = unpaid(inv) || inv.status === 'devis'
  const what = inv.objet || inv.lines.map(l => l.d).join(', ')
  return (
    <button type="button" onClick={onOpen} className={cn('flex items-center gap-3 px-1 py-3 text-left', !last && 'border-b border-border', inv.status === 'refuse' && 'opacity-50')}>
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-[10px]', devis ? 'bg-kgold/15 text-kgold' : open ? 'bg-kgreen/15 text-kgreen' : 'bg-muted text-muted-foreground')}>
        <FileText className="size-[18px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1 text-[15px] font-semibold">
          <span className="truncate">
            {devis ? 'Devis' : 'Facture'} N° {shortNumber(inv.number)}
          </span>
          <Chip s={inv.status} />
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {dateShort(inv.date)}
          {what ? ` · ${what}` : ''}
        </span>
      </span>
      <span className={cn('shrink-0 text-[15px] font-bold tabular-nums', open ? (devis ? 'text-kgold' : 'text-kgreen') : 'text-muted-foreground', inv.status === 'refuse' && 'line-through')}>{money(totals(inv).net)}</span>
    </button>
  )
}

// ——— Une facture ouverte : l'aperçu, et ce qu'on peut en faire ———
function InvoiceSheet({ inv, onClose, onEdit }: { inv: Invoice | null; onClose: () => void; onEdit: (s: EditorStart) => void }) {
  const { profile, setStatus, remove } = useInvoices()
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
            <div className={cn('flex items-center justify-between rounded-[14px] border p-3.5', devis ? 'border-kgold/50 bg-kgold/5' : unpaid(v) ? 'border-kgreen/40 bg-kgreen/5' : '')}>
              <span className="flex flex-col">
                <span className="text-[13px] text-muted-foreground">{devis ? 'Montant du devis' : v.status === 'payee' ? 'Payée' : 'À encaisser'}</span>
                <span className={cn('text-[28px] leading-tight font-extrabold tabular-nums', devis ? 'text-kgold' : unpaid(v) ? 'text-kgreen' : '')}>{money(net)}</span>
                {v.status === 'credit' && <span className="text-xs text-muted-foreground">Ajoutée au crédit de {v.client.name}</span>}
                {v.fromQuote && <span className="text-xs text-muted-foreground">Faite à partir du devis {v.fromQuote}</span>}
              </span>
              <Chip s={v.status} />
            </div>

            <PaperPreview inv={v} profile={profile} width={previewW} />

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
            {v.status === 'non_payee' && (
              <div className={cn('grid gap-2', modules.personnes ? 'grid-cols-2' : 'grid-cols-1')}>
                <button type="button" onClick={() => setStatus(v.id, 'payee')} className="h-[52px] rounded-2xl bg-kgreen-solid text-base font-bold text-white">
                  Il a payé
                </button>
                {modules.personnes && (
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
            <button type="button" aria-label="Télécharger" disabled={busy} onClick={() => run(() => downloadInvoice(v, profile))} className="flex h-[56px] w-[64px] items-center justify-center rounded-2xl border-2 disabled:opacity-40">
              <Download className="size-6" />
            </button>
            <button type="button" disabled={busy} onClick={() => run(() => shareInvoice(v, profile))} className="h-[56px] flex-1 rounded-2xl text-lg font-bold text-white disabled:opacity-40" style={{ background: '#25d366' }}>
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
