// ——— Factures : l'accueil du module, et une facture ouverte ———
import React from 'react'
import { Download, FileText, Plus, Search, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { HomeTop } from '@/components/screens/HomeScreen'
import { useStore } from '@/data/store'
import { cn, plain } from '@/lib/utils'
import { initials } from '@/modules/personnes/view'
import { InvoiceEditor, type EditorStart } from './InvoiceEditor'
import { PaperPreview, downloadInvoice, shareInvoice } from './InvoicePaper'
import { useInvoices } from './store'
import type { Invoice, InvoiceStatus } from './types'
import { money, shortNumber, totals } from './view'

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

export function InvoicesHome() {
  const { invoices, profileSet } = useInvoices()
  const { navigate, setSettingsView } = useStore()
  const [tab, setTab] = React.useState<'factures' | 'devis'>('factures')
  const [search, setSearch] = React.useState('')
  const [editor, setEditor] = React.useState<EditorStart | null>(null)
  const [openId, setOpenId] = React.useState<string | null>(null)

  const toCash = invoices.filter(unpaid)
  const pending = invoices.filter(i => i.kind === 'devis' && i.status === 'devis')
  const sum = (l: Invoice[]) => l.reduce((a, i) => a + totals(i).net, 0)
  const q = plain(search.trim())
  const list = invoices
    .filter(i => (i.kind === 'devis') === (tab === 'devis'))
    .filter(i => !q || plain(`${i.client.name} ${i.number} ${i.objet ?? ''}`).includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const opened = openId ? invoices.find(i => i.id === openId) ?? null : null

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

      <div className="mx-4 mt-3">
        <label className="flex h-[46px] items-center gap-2.5 rounded-xl bg-muted px-3.5 text-muted-foreground">
          <Search className="size-[18px] shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'devis' ? 'Chercher un devis, un client' : 'Chercher une facture, un client'}
            aria-label="Chercher"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          {search && (
            <button type="button" aria-label="Effacer la recherche" onClick={() => setSearch('')} className="flex size-7 items-center justify-center rounded-full hover:bg-background">
              <X className="size-4" />
            </button>
          )}
        </label>
      </div>

      <div className="px-3 pt-1">
        {list.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {q ? 'Rien trouvé.' : tab === 'devis' ? 'Aucun devis pour l’instant. Touchez « Devis » en bas pour en faire un.' : 'Aucune facture pour l’instant. Touchez « Facture » en bas pour en faire une.'}
          </p>
        ) : (
          list.map((inv, i) => {
            const open = unpaid(inv) || inv.status === 'devis'
            return (
              <button
                key={inv.id}
                type="button"
                onClick={() => setOpenId(inv.id)}
                className={cn('flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-muted/40', i < list.length - 1 && 'border-b')}
              >
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
          })
        )}
      </div>

      {/* Les deux gros boutons */}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto grid w-full max-w-xl grid-cols-2 gap-3 border-t bg-background px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <button type="button" aria-label="Nouvelle facture" onClick={() => setEditor({ mode: 'new', kind: 'facture' })} className="flex h-[60px] items-center justify-center gap-2 rounded-2xl bg-kgreen-solid text-lg font-bold text-white active:scale-[0.98]">
          <Plus className="size-[22px]" strokeWidth={2.6} /> Facture
        </button>
        <button type="button" aria-label="Nouveau devis" onClick={() => setEditor({ mode: 'new', kind: 'devis' })} className="flex h-[60px] items-center justify-center gap-2 rounded-2xl border-2 border-kgold text-lg font-bold text-kgold active:scale-[0.98]">
          <Plus className="size-[22px]" strokeWidth={2.6} /> Devis
        </button>
      </div>

      <InvoiceSheet inv={opened} onClose={() => setOpenId(null)} onEdit={s => (setOpenId(null), setEditor(s))} />
      <InvoiceEditor
        start={editor}
        onClose={() => setEditor(null)}
        onSaved={inv => {
          setTab(inv.kind === 'devis' ? 'devis' : 'factures')
          setSearch('')
        }}
      />
    </div>
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
