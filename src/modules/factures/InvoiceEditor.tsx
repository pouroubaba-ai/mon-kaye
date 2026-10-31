// ——— Nouvelle facture (ou devis) : une page, comme un crédit ———
// 1. Pour qui ? La même liste que pour un crédit ; « Nouveau client » ouvre la même fenêtre que sur l'accueil.
// 2. Les produits : une ligne par produit (nom, prix × quantité), comme le détail d'un crédit.
// « Faire la facture » : elle est prête ; elle s'ouvre pour l'envoyer.
import React from 'react'
import { ChevronLeft, ChevronRight, Plus, Search, Trash2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useStore } from '@/data/store'
import { cn, formatPhone, matchesPerson, nameTaken, plain } from '@/lib/utils'
import { UnitPicker } from './LineDialog'
import { todayIso, useInvoices } from './store'
import type { Invoice, InvoiceClient, InvoiceKind, InvoiceLine } from './types'
import { money, totals, unitFor } from './view'

// Ce qu'on ouvre : une nouvelle, une modification, un devis accepté, ou une copie
export type EditorStart = { mode: 'new'; kind: InvoiceKind } | { mode: 'edit' | 'convert' | 'duplicate'; base: Invoice }

type Draft = { label: string; price: string; qty: string; u?: string; x?: string }
const emptyLine = (): Draft => ({ label: '', price: '', qty: '1' })
const num = (s: string) => parseInt(s, 10) || 0
const dec = (s: string) => parseFloat(s.replace(',', '.')) || 0
const decimal = (s: string) => {
  const m = s.replace('.', ',').replace(/[^\d,]/g, '').match(/^\d{0,5}(,\d{0,2})?/)
  return m ? m[0] : ''
}
const thousands = (s: string) => (s ? Number(s).toLocaleString('fr-FR').replace(/\s/g, ' ') : '')
const digits = (s: string) => s.split(/[.,]/)[0].replace(/\D/g, '').slice(0, 10)
const key = (s: string) => plain(s).replace(/\s+/g, ' ').trim()
const toDraft = (l: InvoiceLine): Draft => ({ label: l.d, price: String(l.p), qty: String(l.q).replace('.', ','), ...(l.u ? { u: l.u } : {}), ...(l.x ? { x: l.x } : {}) })

export function InvoiceEditor({ start, onClose, onSaved }: { start: EditorStart | null; onClose: () => void; onSaved?: (inv: Invoice) => void }) {
  const { persons, addPerson, updatePerson } = useStore()
  const { invoices, create, update } = useInvoices()
  const open = !!start
  const base = start && start.mode !== 'new' ? start.base : null
  const kind: InvoiceKind = !start ? 'facture' : start.mode === 'new' ? start.kind : start.mode === 'convert' ? 'facture' : start.base.kind
  const devis = kind === 'devis'

  const [step, setStep] = React.useState<'qui' | 'client' | 'produits'>('qui')
  const [personId, setPersonId] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  // Le client : nouveau (sur la page, pas dans une fenêtre) ou ses infos à changer
  const [form, setForm] = React.useState<{ id?: string; name: string; sex?: 'h' | 'f'; phone: string; details: string }>({ name: '', phone: '', details: '' })
  const [lines, setLines] = React.useState<Draft[]>([emptyLine()])
  const [tva, setTva] = React.useState(false)
  const [unitOf, setUnitOf] = React.useState<number | null>(null)
  const [askLeave, setAskLeave] = React.useState(false)
  const linesRef = React.useRef<HTMLDivElement>(null)

  // À l'ouverture : vide, ou rempli à partir de la facture / du devis de départ
  React.useEffect(() => {
    if (!start) return
    const b = start.mode === 'new' ? null : start.base
    const pid = b ? (b.client.personId ?? persons.find(p => p.type === 'partner' && key(p.name) === key(b.client.name))?.id ?? null) : null
    setPersonId(pid)
    setStep(b && pid ? 'produits' : 'qui')
    setSearch('')
    setLines(b ? b.lines.map(toDraft) : [emptyLine()])
    setTva(b?.tva ?? false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start])

  const person = personId ? persons.find(p => p.id === personId) : undefined
  const clients = persons.filter(p => p.type === 'partner' && !p.archived).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  const visible = search.trim() ? clients.filter(p => matchesPerson(p, search)) : clients

  const openClient = (id?: string) => {
    const p = id ? persons.find(x => x.id === id) : undefined
    setForm(p ? { id: p.id, name: p.name, sex: p.sex, phone: p.phone ?? '', details: p.details ?? '' } : { name: search.trim(), phone: '', details: '' })
    setStep('client')
  }
  const taken = nameTaken(persons, form.name, form.id)
  const formOk = form.name.trim() !== '' && !taken
  const saveClient = () => {
    if (!formOk) return
    const data = { name: form.name.trim(), phone: formatPhone(form.phone), ...(form.sex ? { sex: form.sex } : {}), details: form.details.split('\n').map(l => l.trim()).filter(Boolean).join('\n') }
    if (form.id) updatePerson(form.id, data)
    else setPersonId(addPerson({ type: 'partner', ...data }))
    setStep('produits')
  }

  const setLine = (i: number, c: Partial<Draft>) => setLines(ls => ls.map((l, j) => (j === i ? { ...l, ...c } : l)))
  const lineSum = (l: Draft) => Math.round(num(l.price) * dec(l.qty))
  const filled = lines.filter(l => l.label.trim() || num(l.price) > 0)
  const ok = !!person && filled.length > 0 && filled.every(l => l.label.trim() && num(l.price) > 0 && dec(l.qty) > 0)
  const finalLines: InvoiceLine[] = filled.map(l => ({ d: l.label.trim(), ...(l.x ? { x: l.x } : {}), q: dec(l.qty), ...(l.u ? { u: l.u } : {}), p: num(l.price) }))
  const { net } = totals({ lines: finalLines, tva })
  const dirty = !!personId || filled.length > 0

  // Entrée passe au champ suivant ; sur le dernier, une nouvelle ligne
  const nextOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const fields = Array.from(linesRef.current?.querySelectorAll<HTMLInputElement>('input[data-line-field]') ?? [])
    const next = fields[fields.indexOf(e.currentTarget) + 1]
    if (next) next.focus()
    else {
      setLines(ls => [...ls, emptyLine()])
      setTimeout(() => linesRef.current?.querySelectorAll<HTMLInputElement>('input[data-line-field]')[fields.length]?.focus(), 50)
    }
  }

  const done = () => {
    if (!ok || !person) return
    // Les infos du client (adresse, RCCM…) : celles de sa fiche, données une seule fois
    const last = invoices.find(i => i.client.personId === person.id || key(i.client.name) === key(person.name))
    const saved = (person.details ?? '').split('\n').map(l => l.trim()).filter(Boolean)
    const client: InvoiceClient = { personId: person.id, name: person.name, lines: saved.length ? saved : (last?.client.lines ?? []), ...(person.phone ? { phone: person.phone } : {}) }
    let inv: Invoice
    if (start?.mode === 'edit' && base) {
      inv = { ...base, client, lines: finalLines, tva }
      update(inv)
    } else {
      inv = create({
        kind,
        client,
        ...(base?.objet ? { objet: base.objet } : {}),
        lines: finalLines,
        tva,
        status: devis ? 'devis' : 'non_payee',
        ...(start?.mode === 'convert' && base ? { fromQuote: base.number } : {}),
        date: todayIso(),
      })
    }
    onSaved?.(inv)
    onClose()
  }

  const title = start?.mode === 'edit' ? `Modifier ${devis ? 'le devis' : 'la facture'}` : start?.mode === 'convert' ? 'Facture du devis' : devis ? 'Nouveau devis' : 'Nouvelle facture'

  // Retour : à l'étape d'avant, ou quitter (en demandant si quelque chose a été saisi)
  const back = () => {
    if (step === 'client') return setStep(form.id ? 'produits' : 'qui')
    if (step === 'produits' && start?.mode === 'new') return setStep('qui')
    if (dirty) setAskLeave(true)
    else onClose()
  }
  // Le bouton retour du téléphone fait pareil : l'app envoie « Échap » à la fenêtre ouverte (cette page) ;
  // une petite fenêtre ouverte par-dessus (nouveau client, unité…) se ferme d'abord, seule
  const backRef = React.useRef(back)
  backRef.current = back
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelectorAll('[role="dialog"]').length > 1) return
      backRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  React.useEffect(() => {
    if (open) window.scrollTo({ top: 0, behavior: 'instant' })
  }, [open, step])

  if (!open) return null
  return (
    <>
      <div role="dialog" aria-label={title} className="fixed inset-0 z-40 overflow-y-auto bg-background">
        <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
          <header className="sticky top-0 z-10 flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-1 border-b bg-background px-2 pt-[env(safe-area-inset-top)]">
            <button type="button" aria-label="Retour" onClick={back} className="flex size-11 items-center justify-center rounded-full hover:bg-muted">
              <ChevronLeft className="size-6" />
            </button>
            <span className="flex min-w-0 flex-col">
              <h1 className="truncate text-lg leading-tight font-semibold">{step === 'qui' ? 'Pour qui ?' : step === 'client' ? (form.id ? 'Ses infos' : 'Nouveau client') : title}</h1>
              {step === 'produits' && <span className="truncate text-[13px] text-muted-foreground">{person?.name}</span>}
            </span>
          </header>
          <div className="flex flex-1 flex-col px-4 pt-3">
          {/* 1. Pour qui ? */}
          {step === 'qui' && (
            <div className="flex flex-1 flex-col gap-3">
              {/* Recherche, et « Nouveau » sur la même ligne */}
              <div className="flex items-center gap-1">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Chercher un client" value={search} onChange={e => setSearch(e.target.value)} className="h-[46px] pr-10 pl-9" />
                  {search && (
                    <button type="button" aria-label="Effacer la recherche" onClick={() => setSearch('')} className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                <button type="button" aria-label="Nouveau client" onClick={() => openClient()} className="flex h-[46px] shrink-0 items-center gap-1.5 rounded-xl border-2 border-dashed border-kgold px-3 text-sm font-semibold text-muted-foreground hover:bg-kgold/5">
                  <Plus className="size-[18px]" strokeWidth={2.4} /> Nouveau
                </button>
              </div>
              <div className="pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                <div className="flex flex-col divide-y rounded-lg border">
                  {visible.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPersonId(p.id)
                        setStep('produits')
                      }}
                      className="flex items-center gap-3 p-3 text-left hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.phone || 'Client'}</p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                  {visible.length === 0 && <p className="p-3 text-sm text-muted-foreground">{search.trim() ? 'Personne ne s’appelle comme ça.' : 'Pas encore de client : touchez « Nouveau client ».'}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Le client : sur la page, une seule fois (gardé dans sa fiche) */}
          {step === 'client' && (
            <form
              className="flex flex-1 flex-col gap-4"
              onSubmit={e => {
                e.preventDefault()
                saveClient()
              }}
            >
              <label className="flex flex-col gap-2">
                <span className="text-[13px] text-muted-foreground">Nom</span>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} aria-invalid={!!taken} className="h-12 rounded-xl border bg-background px-3.5 text-base outline-none focus-visible:border-ring" />
                {taken && <span className="text-xs text-destructive">{taken}</span>}
              </label>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Homme ou femme">
                {(
                  [
                    ['h', 'Homme'],
                    ['f', 'Femme'],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={form.sex === v}
                    onClick={() => setForm(f => ({ ...f, sex: f.sex === v ? undefined : v }))}
                    className={form.sex === v ? 'h-11 rounded-full border-[1.5px] border-kgold bg-kgold text-sm font-bold text-white dark:text-black' : 'h-11 rounded-full border text-sm font-semibold text-muted-foreground'}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="flex flex-col gap-2">
                <span className="text-[13px] text-muted-foreground">Numéro</span>
                <input type="tel" inputMode="tel" placeholder="+242 06 …" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="h-12 rounded-xl border bg-background px-3.5 text-base outline-none focus-visible:border-ring" />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[13px] text-muted-foreground">Ses infos pour les factures (facultatif)</span>
                <textarea
                  rows={4}
                  value={form.details}
                  onChange={e => setForm(f => ({ ...f, details: e.target.value }))}
                  placeholder={'Une info par ligne :\nAdresse, quartier\nRCCM, NIU…'}
                  className="resize-none rounded-xl border bg-background px-3.5 py-3 text-base leading-snug outline-none focus-visible:border-ring"
                />
              </label>
              <div className="flex-1" />
              <div className="sticky bottom-0 -mx-4 border-t bg-background px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
                <button type="submit" disabled={!formOk} className="h-[56px] w-full rounded-2xl bg-kgreen-solid text-lg font-bold text-white disabled:opacity-40">
                  {form.id ? 'Enregistrer' : 'Suivant'}
                </button>
              </div>
            </form>
          )}

          {/* 2. Les produits : une ligne par produit */}
          {step === 'produits' && (
            <div className="flex flex-1 flex-col gap-3">
              {/* Le client : ses infos, gardées dans sa fiche (données une seule fois) */}
              {person && (
                <div className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold">{person.name}</span>
                    {(person.details ?? '').trim() ? (
                      <span className="text-xs leading-snug whitespace-pre-line text-muted-foreground">{person.details}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Pas d'adresse ni de RCCM pour la facture</span>
                    )}
                  </span>
                  <button type="button" onClick={() => openClient(person.id)} className="h-8 shrink-0 rounded-full px-2 text-sm font-semibold text-kgold">
                    {(person.details ?? '').trim() ? 'Modifier' : 'Ajouter'}
                  </button>
                </div>
              )}
              <div ref={linesRef} className="flex flex-1 flex-col gap-1.5">
                {lines.map((l, i) => (
                  <div key={i} className="flex flex-col gap-1 rounded-lg border px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Input data-line-field enterKeyHint="next" onKeyDown={nextOnEnter} placeholder={`Produit ${i + 1}`} aria-label="Produit" value={l.label} onChange={e => setLine(i, { label: e.target.value })} className="h-9 min-w-0 flex-1 px-2 text-sm" />
                      <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground" aria-label="Supprimer la ligne" onClick={() => setLines(ls => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [emptyLine()]))}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Input
                        data-line-field
                        enterKeyHint="next"
                        onKeyDown={nextOnEnter}
                        onFocus={e => e.currentTarget.select()}
                        inputMode="numeric"
                        placeholder="Prix"
                        aria-label="Prix"
                        value={thousands(l.price)}
                        onChange={e => setLine(i, { price: digits(e.target.value) })}
                        className="h-8 w-[6.5rem] shrink-0 px-2 text-right text-sm"
                      />
                      <span className="text-xs text-muted-foreground">×</span>
                      <Input
                        data-line-field
                        enterKeyHint="next"
                        onKeyDown={nextOnEnter}
                        onFocus={e => e.currentTarget.select()}
                        inputMode="decimal"
                        placeholder="Qté"
                        aria-label="Quantité"
                        value={l.qty}
                        onChange={e => setLine(i, { qty: decimal(e.target.value) })}
                        className="h-8 w-12 shrink-0 px-1 text-center text-sm"
                      />
                      {/* L'unité (jour, sac, m²…) : facultative */}
                      <button
                        type="button"
                        onClick={() => setUnitOf(i)}
                        className={cn('h-8 max-w-[5.5rem] shrink-0 truncate rounded-md px-2 text-xs font-semibold', l.u ? 'bg-kgold text-white dark:text-black' : 'border border-dashed text-muted-foreground')}
                      >
                        {l.u ? unitFor(l.u, dec(l.qty)) : 'unité'}
                      </button>
                      <span className="min-w-0 flex-1 truncate text-right text-sm font-semibold tabular-nums">{lineSum(l) > 0 ? money(lineSum(l)) : ''}</span>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="ghost" className="self-start" onClick={() => setLines(ls => [...ls, emptyLine()])}>
                  <Plus /> Ajouter une ligne
                </Button>
              </div>

              <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t bg-background px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>TVA 18 %</span>
                  <Switch checked={tva} onCheckedChange={setTva} aria-label="TVA 18 %" className="data-[state=checked]:bg-kgreen-solid" />
                </label>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">{devis ? 'Montant du devis' : 'Net à payer'}</span>
                  <span className="text-2xl font-bold tabular-nums">{money(net)} FCFA</span>
                </div>
                <button type="button" disabled={!ok} onClick={done} className="h-[56px] rounded-2xl bg-kgreen-solid text-lg font-bold text-white disabled:opacity-40">
                  {start?.mode === 'edit' ? 'Enregistrer' : devis ? 'Faire le devis' : 'Faire la facture'}
                </button>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      <Dialog open={askLeave} onOpenChange={setAskLeave}>
        <DialogContent>
          <div className="flex flex-col gap-4">
            <DialogHeader className="gap-1 p-0">
              <DialogTitle className="text-left">Abandonner {devis ? 'ce devis' : 'cette facture'} ?</DialogTitle>
              <DialogDescription className="text-left">Ce que vous avez saisi ne sera pas enregistré.</DialogDescription>
            </DialogHeader>
            <Button size="lg" className="h-12" onClick={() => setAskLeave(false)}>
              Continuer
            </Button>
            <Button variant="outline" size="lg" className="h-12" onClick={() => (setAskLeave(false), onClose())}>
              Abandonner
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <UnitPicker open={unitOf !== null} onOpenChange={o => !o && setUnitOf(null)} value={unitOf !== null ? lines[unitOf]?.u : undefined} onPick={u => (unitOf !== null && setLine(unitOf, { u }), setUnitOf(null))} />
    </>
  )
}
