// ——— Nouvelle facture (ou devis) en 3 étapes ———
// 1. Pour qui ?  2. Ce que je facture (lignes, TVA au choix)  3. La facture : payée ou plus tard, puis l'envoyer.
import React from 'react'
import { Check, ChevronRight, Download, Plus, Search, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { Switch } from '@/components/ui/switch'
import { useStore } from '@/data/store'
import { cn, plain } from '@/lib/utils'
import { initials } from '@/modules/personnes/view'
import { LineDialog } from './LineDialog'
import { PaperPreview, downloadInvoice, shareInvoice } from './InvoicePaper'
import { todayIso, useInvoices } from './store'
import type { Invoice, InvoiceClient, InvoiceKind, InvoiceLine, InvoiceStatus } from './types'
import { lineTotal, money, numberOf, qtyLabel, totals } from './view'

// Ce qu'on ouvre : une nouvelle, une modification, un devis accepté, ou une copie
export type EditorStart = { mode: 'new'; kind: InvoiceKind } | { mode: 'edit' | 'convert' | 'duplicate'; base: Invoice }

const input = 'h-12 w-full rounded-xl border bg-background px-3.5 text-base outline-none focus:border-kgold'
const key = (s: string) => plain(s).replace(/\s+/g, ' ').trim()
const WA = '#25d366'

export function InvoiceEditor({ start, onClose, onSaved }: { start: EditorStart | null; onClose: () => void; onSaved?: (inv: Invoice) => void }) {
  const { persons, modules } = useStore()
  const { invoices, profile, create, update } = useInvoices()
  const open = !!start
  const base = start && start.mode !== 'new' ? start.base : null
  const kind: InvoiceKind = !start ? 'facture' : start.mode === 'new' ? start.kind : start.mode === 'convert' ? 'facture' : start.base.kind
  const devis = kind === 'devis'

  const [step, setStep] = React.useState(1)
  const [client, setClient] = React.useState<InvoiceClient | null>(null)
  const [isNew, setIsNew] = React.useState(false)
  const [details, setDetails] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [objet, setObjet] = React.useState('')
  const [date, setDate] = React.useState(todayIso())
  const [lines, setLines] = React.useState<InvoiceLine[]>([])
  const [tva, setTva] = React.useState(false)
  const [paid, setPaid] = React.useState<'payee' | 'plus_tard' | null>(null)
  const [toCredit, setToCredit] = React.useState(true)
  const [editing, setEditing] = React.useState<number | 'new' | null>(null)
  const [busy, setBusy] = React.useState(false)

  // À l'ouverture : vide, ou rempli à partir de la facture / du devis de départ
  React.useEffect(() => {
    if (!start) return
    const b = start.mode === 'new' ? null : start.base
    setStep(b ? 2 : 1)
    setClient(b ? b.client : null)
    setIsNew(false)
    setDetails(b ? b.client.lines.join('\n') : '')
    setSearch('')
    setObjet(b?.objet ?? '')
    setDate(start.mode === 'edit' ? start.base.date : todayIso())
    setLines(b ? b.lines : [])
    setTva(b?.tva ?? false)
    setPaid(start.mode === 'edit' && start.base.kind === 'facture' ? (start.base.status === 'payee' ? 'payee' : 'plus_tard') : null)
    setToCredit(true)
  }, [start])

  // Les clients : ceux de Kayé, et ceux des factures déjà faites (avec leurs infos)
  const known = React.useMemo(() => {
    const m = new Map<string, InvoiceClient>()
    for (const inv of [...invoices].reverse()) m.set(key(inv.client.name), inv.client)
    for (const p of persons) {
      if (p.type !== 'partner' || p.archived) continue
      const k = key(p.name)
      const prev = m.get(k)
      m.set(k, { personId: p.id, name: p.name, lines: prev?.lines ?? [], phone: prev?.phone ?? p.phone })
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }, [invoices, persons])
  const shown = search.trim() ? known.filter(c => key(c.name).includes(key(search)) || c.lines.some(l => key(l).includes(key(search)))) : known

  const finalClient: InvoiceClient | null = client
    ? { ...client, name: client.name.trim(), lines: details.split('\n').map(s => s.trim()).filter(Boolean), ...(client.phone?.trim() ? { phone: client.phone.trim() } : { phone: undefined }) }
    : null
  const status: InvoiceStatus = devis ? (base && start?.mode === 'edit' ? base.status : 'devis') : paid === 'payee' ? 'payee' : paid === 'plus_tard' && toCredit && modules.personnes ? 'credit' : 'non_payee'
  // L'aperçu : la facture telle qu'elle sera
  const preview: Invoice | null = finalClient
    ? {
        id: base?.id ?? 'apercu',
        kind,
        number: start?.mode === 'edit' ? base!.number : numberOf(profile, kind),
        date,
        client: finalClient,
        ...(objet.trim() ? { objet: objet.trim() } : {}),
        lines,
        tva,
        status,
        ...(start?.mode === 'convert' ? { fromQuote: base!.number } : {}),
        createdAt: base && start?.mode === 'edit' ? base.createdAt : new Date().toISOString(),
      }
    : null
  const { net } = totals({ lines, tva })
  const dirty = !!client || lines.length > 0
  const canNext = step === 1 ? !!finalClient?.name : step === 2 ? lines.length > 0 : devis || paid !== null

  const save = (): Invoice => {
    const p = preview!
    if (start?.mode === 'edit') {
      update({ ...base!, ...p, id: base!.id, number: base!.number })
      return p
    }
    const { id: _id, number: _n, createdAt: _c, ...draft } = p
    void _id, _n, _c
    return create(draft)
  }
  const finish = async (how: 'share' | 'download' | 'none') => {
    if (!canNext || busy) return
    setBusy(true)
    try {
      const inv = save()
      if (how === 'share') await shareInvoice(inv, profile)
      if (how === 'download') await downloadInvoice(inv, profile)
      onSaved?.(inv)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const title = start?.mode === 'edit' ? `Modifier ${devis ? 'le devis' : 'la facture'}` : start?.mode === 'convert' ? 'Facture du devis' : devis ? 'Nouveau devis' : 'Nouvelle facture'
  const sub = ['Pour qui ?', finalClient?.name || 'Ce que je facture', 'Vérifie et envoie'][step - 1]
  const previewW = Math.min(300, (typeof window !== 'undefined' ? window.innerWidth : 390) - 72)

  return (
    <>
      <Dialog open={open} onOpenChange={o => !o && onClose()} dirty={dirty && !busy} dirtyKind={start?.mode === 'edit' ? 'modification' : 'ajout'}>
        <DialogContent fixedHeight>
          <DialogHeader className="text-left">
            <DialogTitle className="text-left text-xl">{step === 3 && preview ? preview.number : title}</DialogTitle>
            <DialogDescription className="text-left">
              Étape {step} sur 3 · {sub}
            </DialogDescription>
          </DialogHeader>
          {/* Les 3 étapes ; toucher une étape faite y revient */}
          <div className="mt-1 mb-3 flex gap-1.5">
            {[1, 2, 3].map(s => (
              <button key={s} type="button" aria-label={`Étape ${s}`} disabled={s > step} onClick={() => setStep(s)} className={cn('h-1 flex-1 rounded-full', s <= step ? 'bg-kgold' : 'bg-muted')} />
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-2 [&>*]:shrink-0">
            {step === 1 &&
              (client ? (
                // Le client choisi : ses infos sur la facture
                <div className="flex flex-col gap-3.5">
                  <div className="flex items-center gap-3 rounded-[14px] bg-kgold/15 p-3 ring-2 ring-kgold">
                    <span className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-kgold text-sm font-bold text-white dark:text-black">{isNew && !client.name.trim() ? <Plus className="size-5" /> : initials(client.name)}</span>
                    {isNew ? (
                      <input value={client.name} onChange={e => setClient({ ...client, name: e.target.value })} placeholder="Nom du client" aria-label="Nom du client" className="h-11 min-w-0 flex-1 rounded-lg border bg-background px-3 text-base font-semibold outline-none focus:border-kgold" />
                    ) : (
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-base font-bold">{client.name}</span>
                        <span className="text-xs text-muted-foreground">{client.personId ? 'Dans mes clients' : 'Déjà facturé'}</span>
                      </span>
                    )}
                    <button type="button" onClick={() => (setClient(null), setIsNew(false), setDetails(''))} className="h-9 shrink-0 rounded-full px-3 text-sm font-semibold text-kgold">
                      Changer
                    </button>
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] text-muted-foreground">Ses infos sur la facture (facultatif)</span>
                    <textarea
                      value={details}
                      onChange={e => setDetails(e.target.value)}
                      rows={4}
                      placeholder={'Une info par ligne :\nSARL, RCCM…\nAdresse, quartier\nVille'}
                      className="w-full resize-none rounded-xl border bg-background px-3.5 py-3 text-[15px] leading-snug outline-none focus:border-kgold"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] text-muted-foreground">Son numéro (facultatif)</span>
                    <input type="tel" inputMode="tel" value={client.phone ?? ''} onChange={e => setClient({ ...client, phone: e.target.value })} placeholder="06 …" className={input} />
                  </label>
                </div>
              ) : (
                <div className="flex flex-col">
                  <label className="flex h-[46px] items-center gap-2.5 rounded-xl bg-muted px-3.5 text-muted-foreground">
                    <Search className="size-[18px] shrink-0" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Chercher un client" aria-label="Chercher un client" className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground" />
                    {search && (
                      <button type="button" aria-label="Effacer la recherche" onClick={() => setSearch('')} className="flex size-7 items-center justify-center rounded-full">
                        <X className="size-4" />
                      </button>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={() => (setClient({ name: search.trim(), lines: [] }), setIsNew(true), setDetails(''))}
                    className="mt-2 mb-2.5 flex h-[50px] items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-kgold text-[15px] font-semibold text-muted-foreground"
                  >
                    <Plus className="size-5" /> Nouveau client
                  </button>
                  {shown.length > 0 && (
                    <div className="overflow-hidden rounded-[14px] border">
                      {shown.map((c, i) => (
                        <button
                          key={c.personId ?? c.name}
                          type="button"
                          onClick={() => (setClient(c), setIsNew(false), setDetails(c.lines.join('\n')))}
                          className={cn('flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left', i < shown.length - 1 && 'border-b')}
                        >
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-[15px] font-semibold">{c.name}</span>
                            <span className="truncate text-xs text-muted-foreground">{c.lines[0] ?? c.phone ?? ' '}</span>
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

            {step === 2 && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-[13px] text-muted-foreground">Objet (facultatif)</span>
                    <input value={objet} onChange={e => setObjet(e.target.value)} placeholder="Ex : Location d'une pelle" className={cn(input, 'text-[15px]')} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] text-muted-foreground">Date</span>
                    <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} className={cn(input, 'w-[148px] px-2.5 text-[15px]')} />
                  </label>
                </div>
                <span className="-mb-1 text-[13px] text-muted-foreground">Ce que je {devis ? 'propose' : 'facture'}</span>
                {lines.length > 0 && (
                  <div className="overflow-hidden rounded-[14px] border">
                    {lines.map((l, i) => (
                      <button key={i} type="button" onClick={() => setEditing(i)} className={cn('flex w-full flex-col gap-0.5 px-3.5 py-3 text-left', i < lines.length - 1 && 'border-b')}>
                        <span className="flex w-full items-baseline justify-between gap-2">
                          <span className="min-w-0 truncate text-[15px] font-semibold">{l.d}</span>
                          <span className="shrink-0 font-bold tabular-nums">{money(lineTotal(l))}</span>
                        </span>
                        {l.x && <span className="truncate text-xs text-muted-foreground italic">{l.x}</span>}
                        <span className="text-[13px] text-muted-foreground">
                          {String(l.q).replace('.', ',')} {l.u && <span className="text-kgold">{qtyLabel(l).split(' ').slice(1).join(' ')}</span>} × {money(l.p)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => setEditing('new')} className="flex h-[48px] items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-kgold text-[15px] font-semibold text-muted-foreground">
                  <Plus className="size-5" /> Ajouter une ligne
                </button>
                <div className="overflow-hidden rounded-[14px] border">
                  <label className="flex items-center justify-between gap-3 border-b px-3.5 py-2.5">
                    <span className="flex flex-col">
                      <span className="text-[15px] font-semibold">TVA 18 %</span>
                      <span className="text-xs text-muted-foreground">À cocher si {devis ? 'le devis' : 'la facture'} doit l'avoir</span>
                    </span>
                    <Switch checked={tva} onCheckedChange={setTva} aria-label="TVA 18 %" className="data-[state=checked]:bg-kgreen-solid" />
                  </label>
                  <div className="flex items-center justify-between px-3.5 py-3">
                    <span className="font-bold">{devis ? 'Montant' : 'Net à payer'}</span>
                    <span className="text-xl font-extrabold tabular-nums">{money(net)} FCFA</span>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && preview && (
              <div className="flex flex-col">
                {!devis && (
                  <>
                    <span className="mb-1.5 text-[13px] text-muted-foreground">Le client a payé ?</span>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ['payee', 'Payée', 'maintenant'],
                          ['plus_tard', 'Il paie plus tard', modules.personnes && toCredit ? 'ajouté à son crédit' : 'pas encore payée'],
                        ] as const
                      ).map(([v, t, s]) => (
                        <button
                          key={v}
                          type="button"
                          aria-pressed={paid === v}
                          disabled={start?.mode === 'edit' && base?.status === 'credit'}
                          onClick={() => setPaid(v)}
                          className={cn('flex h-[56px] flex-col items-center justify-center rounded-[14px] border text-sm leading-tight font-bold', paid === v && 'border-kgold bg-kgold text-white dark:text-black')}
                        >
                          {t}
                          <small className={cn('text-[11px] font-medium', paid === v ? 'opacity-80' : 'text-muted-foreground')}>{s}</small>
                        </button>
                      ))}
                    </div>
                    {paid === 'plus_tard' && modules.personnes && start?.mode !== 'edit' && (
                      <label className="mt-2 flex items-center justify-between gap-3 rounded-[14px] border px-3.5 py-2.5 animate-in fade-in duration-200">
                        <span className="flex flex-col">
                          <span className="text-sm font-semibold">Ajouter à son crédit</span>
                          <span className="text-xs text-muted-foreground">{money(net)} sur le compte de {finalClient?.name} dans Kayé</span>
                        </span>
                        <Switch checked={toCredit} onCheckedChange={setToCredit} aria-label="Ajouter à son crédit" className="data-[state=checked]:bg-kgreen-solid" />
                      </label>
                    )}
                  </>
                )}
                <div className={devis ? '' : 'mt-4'}>
                  <PaperPreview inv={preview} profile={profile} width={previewW} />
                </div>
              </div>
            )}
          </div>

          {/* En bas : Suivant, puis à la fin Télécharger / Envoyer */}
          {step < 3 ? (
            <button type="button" disabled={!canNext} onClick={() => setStep(step + 1)} className="mt-2 h-[56px] shrink-0 rounded-2xl bg-foreground text-lg font-bold text-background disabled:opacity-40">
              {step === 1 ? 'Suivant' : devis ? 'Voir le devis' : 'Voir la facture'}
            </button>
          ) : (
            <div className="mt-2 flex shrink-0 flex-col gap-2">
              <div className="flex gap-2.5">
                <button type="button" aria-label="Enregistrer et télécharger" disabled={!canNext || busy} onClick={() => finish('download')} className="flex h-[56px] w-[64px] items-center justify-center rounded-2xl border-2 disabled:opacity-40">
                  <Download className="size-6" />
                </button>
                <button type="button" disabled={!canNext || busy} onClick={() => finish('share')} className="flex h-[56px] flex-1 items-center justify-center gap-2 rounded-2xl text-lg font-bold text-white disabled:opacity-40" style={{ background: WA }}>
                  {busy ? 'Préparation…' : 'Enregistrer et envoyer'}
                </button>
              </div>
              <button type="button" disabled={!canNext || busy} onClick={() => finish('none')} className="flex h-10 items-center justify-center gap-1.5 text-sm font-semibold text-muted-foreground disabled:opacity-40">
                <Check className="size-4" /> Enregistrer seulement
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <LineDialog
        open={editing !== null}
        onOpenChange={o => !o && setEditing(null)}
        line={typeof editing === 'number' ? lines[editing] : null}
        onSave={l => {
          setLines(prev => (typeof editing === 'number' ? prev.map((x, i) => (i === editing ? l : x)) : [...prev, l]))
          setEditing(null)
        }}
        onDelete={() => {
          setLines(prev => prev.filter((_, i) => i !== editing))
          setEditing(null)
        }}
      />
    </>
  )
}
