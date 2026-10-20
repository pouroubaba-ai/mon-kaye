import React, { useEffect, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Camera,
  ChevronRight,
  Coins,
  Delete,
  HandCoins,
  Plus,
  Search,
  Table,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'

import { useStore } from '@/data/store'
import { currentPeriod, payrollOf } from '@/data/payroll'
import type { Movement, MovementItem } from '@/data/mockData'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn, formatFCFA, matchesPerson } from '@/lib/utils'

// Saisie d'une opération en 3 écrans courts, une seule question par écran :
//   Qui ?  →  Quoi ?  →  Combien ?
// Ouverte depuis une fiche, la personne et l'opération sont déjà connues : on arrive
// directement sur « Combien ? ». Les options (note, photo, référence) restent repliées.

type Step = 'qui' | 'quoi' | 'combien' | 'detail'
type MType = Movement['type']

const OPS: Record<'partner' | 'employee', { type: MType; label: string; Icon: React.ComponentType<{ className?: string }>; tone: 'credit' | 'debt' }[]> = {
  partner: [
    // Ajouts en haut, versements en bas.
    { type: 'il_a_pris_credit', label: 'Crédit', Icon: Plus, tone: 'credit' },
    { type: 'il_m_a_verse', label: 'Il verse', Icon: ArrowDownLeft, tone: 'credit' },
    { type: 'j_ai_pris_credit', label: 'Dette', Icon: Plus, tone: 'debt' },
    { type: 'je_lui_ai_verse', label: 'Je verse', Icon: ArrowUpRight, tone: 'debt' },
  ],
  employee: [
    { type: 'je_lui_ai_verse', label: 'Verser le salaire', Icon: Coins, tone: 'debt' },
    { type: 'avance_salaire', label: 'Donner une avance', Icon: HandCoins, tone: 'credit' },
    { type: 'remboursement_direct', label: 'Il rembourse son avance', Icon: Undo2, tone: 'credit' },
  ],
}

const LABELS: Record<string, string> = {
  il_m_a_verse: 'Versement reçu',
  je_lui_ai_verse: 'Versement fait',
  il_a_pris_credit: 'A pris à crédit',
  j_ai_pris_credit: "J'ai pris à crédit",
  avance_salaire: 'Avance sur salaire',
  remboursement_direct: "Remboursement d'avance",
  ajout_salaire: 'Ajout au salaire',
  retenue_manuelle: 'Retenue',
}

// Ajout et retenue du mois en cours (ouverts depuis la fiche d'un mois) : un motif, pas de moyen de paiement.
const PAY_ADJUST = new Set<string>(['ajout_salaire', 'retenue_manuelle'])
const MOTIF_HINT: Record<string, string> = {
  ajout_salaire: 'Motif (ex. prime, heures en plus)',
  retenue_manuelle: 'Motif (ex. casse, manquant de caisse)',
}

const TITLES: Record<Step, string> = { qui: 'Qui ?', quoi: 'Quelle opération ?', combien: 'Combien ?', detail: 'Détail' }

// Ligne du tableau en cours de saisie (chiffres gardés en texte, sans espaces).
type DraftLine = { label: string; price: string; qty: string; total: string }
const emptyLine = (): DraftLine => ({ label: '', price: '', qty: '1', total: '' })
const num = (s: string) => parseInt(s, 10) || 0
// Quantité : on accepte « 1,5 » ou « 1.5 » (kilos, litres…). Les prix restent entiers (pas de centimes en FCFA).
const dec = (s: string) => parseFloat(s.replace(',', '.')) || 0
const decimal = (s: string) => {
  const m = s.replace('.', ',').replace(/[^\d,]/g, '').match(/^\d{0,4}(,\d{0,2})?/)
  return m ? m[0] : ''
}
// Prix : ce qui suit une virgule est ignoré (pas de centimes), au lieu de coller les chiffres
const intPart = (s: string) => s.split(/[.,]/)[0]
// Affichage en milliers pendant la saisie : 20000 → « 20 000 ».
const thousands = (s: string) => (s ? Number(s).toLocaleString('fr-FR').replace(/\s/g, ' ') : '')
const digits = (s: string) => s.replace(/\D/g, '').slice(0, 9)
const lineTotal = (l: DraftLine, calc: boolean) => (calc ? Math.round(num(l.price) * dec(l.qty)) : num(l.total))

export const NewMovementModal: React.FC = () => {
  const { isNewMovementOpen, closeNewMovement, newMovementTargetPersonId, newMovementInitialType, newMovementSide, persons, addMovement, movements, monthStates, modules } =
    useStore()

  const [step, setStep] = useState<Step>('qui')
  // Versement qui prend sur la retenue d'avance : on demande de confirmer dans une fenêtre à part
  // Les deux montants sont figés à l'ouverture : la phrase ne change pas pendant que la fenêtre se ferme
  const [confirmRetenue, setConfirmRetenue] = useState<{ from: number; to: number } | null>(null)
  const [confirmShown, setConfirmShown] = useState({ from: 0, to: 0 })
  const [personId, setPersonId] = useState('')
  const [type, setType] = useState<MType>('il_m_a_verse')
  const [amountStr, setAmountStr] = useState('0')
  const [payment, setPayment] = useState<'especes' | 'mobile_money'>('especes')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<'partner' | 'employee'>('partner')
  // Détail en tableau (crédit ou dette seulement) : les lignes confirmées, et le brouillon en cours.
  // Compte affiché à l'étape « Quelle opération ? » (onglets Son compte / Mon compte).
  const [opSide, setOpSide] = useState<'credit' | 'debt'>('credit')
  const [motif, setMotif] = useState('')
  const [items, setItems] = useState<MovementItem[] | null>(null)
  const [draft, setDraft] = useState<DraftLine[]>([])
  const [draftCalc, setDraftCalc] = useState(true)

  useEffect(() => {
    if (!isNewMovementOpen) return
    setPersonId(newMovementTargetPersonId || '')
    if (newMovementInitialType) setType(newMovementInitialType)
    setStep(newMovementTargetPersonId ? (newMovementInitialType ? 'combien' : 'quoi') : 'qui')
    setAmountStr('0')
    setPayment('especes')
    setReference('')
    setNote('')
    setPhoto(false)
    setShowMore(false)
    setSearch('')
    setGroup('partner')
    setItems(null)
    setOpSide(newMovementSide ?? 'credit')
    setMotif('')
  }, [isNewMovementOpen, newMovementTargetPersonId, newMovementInitialType, newMovementSide])

  const person = persons.find(p => p.id === personId)
  const kind = person?.type === 'employee' ? 'employee' : 'partner'
  const op = OPS[kind].find(o => o.type === type)
  // Le tableau n'existe que pour un crédit ou une dette ; avec un tableau, le montant vient de ses lignes.
  const isAdjust = PAY_ADJUST.has(type)
  const isAddition = type === 'il_a_pris_credit' || type === 'j_ai_pris_credit' || isAdjust
  const hasItems = isAddition && !!items && items.length > 0
  const amount = hasItems ? items!.reduce((a, l) => a + l.total, 0) : parseInt(amountStr, 10) || 0
  const draftSum = draft.reduce((a, l) => a + lineTotal(l, draftCalc), 0)

  const openDetail = () => {
    if (hasItems) {
      const calc = items!.some(l => l.price !== undefined)
      setDraftCalc(calc)
      setDraft(items!.map(l => ({ label: l.label, price: String(l.price ?? ''), qty: String(l.qty ?? 1).replace('.', ','), total: String(l.total) })))
    } else {
      setDraftCalc(true)
      setDraft([emptyLine()])
    }
    setStep('detail')
  }
  const confirmDetail = () => {
    const lines: MovementItem[] = draft
      .map(l => ({ l, t: lineTotal(l, draftCalc) }))
      .filter(({ t }) => t > 0)
      .map(({ l, t }) =>
        draftCalc
          ? { label: l.label.trim() || 'Article', price: num(l.price), qty: dec(l.qty), total: t }
          : { label: l.label.trim() || 'Article', total: t }
      )
    setItems(lines.length ? lines : null)
    setStep('combien')
  }
  const removeDetail = () => {
    setItems(null)
    setAmountStr('0')
    setStep('combien')
  }
  const setLine = (i: number, patch: Partial<DraftLine>) => setDraft(d => d.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  // Entrée : champ suivant ; sur le tout dernier champ, nouvelle ligne et curseur sur son libellé.
  const linesRef = React.useRef<HTMLDivElement>(null)
  const focusNewLine = React.useRef(false)
  const nextOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const fields = Array.from(linesRef.current?.querySelectorAll<HTMLInputElement>('input[data-line-field]') ?? [])
    const next = fields[fields.indexOf(e.currentTarget) + 1]
    if (next) next.focus()
    else {
      focusNewLine.current = true
      setDraft(d => [...d, emptyLine()])
    }
  }
  React.useEffect(() => {
    if (!focusNewLine.current) return
    focusNewLine.current = false
    const fields = linesRef.current?.querySelectorAll<HTMLInputElement>('input[aria-label="Libellé"]')
    fields?.[fields.length - 1]?.focus()
  }, [draft.length])

  // Le compte que l'opération fait bouger, et son montant actuel.
  // Un versement (ou un remboursement) ne peut jamais dépasser ce qui est dû.
  type Balance = { label: string; value: number; tone: 'credit' | 'debt'; isPayment: boolean }
  const balanceFor = (t: MType): Balance | null => {
    if (!person) return null
    if (person.type === 'partner') {
      if (t === 'il_m_a_verse' || t === 'il_a_pris_credit')
        return { label: 'Son compte', value: person.owesMe || 0, tone: 'credit', isPayment: t === 'il_m_a_verse' }
      return { label: 'Mon compte', value: person.iOweHim || 0, tone: 'debt', isPayment: t === 'je_lui_ai_verse' }
    }
    if (t === 'je_lui_ai_verse') {
      // Salaire dû, retenue d'avance prévue comprise : on peut verser jusqu'au salaire entier.
      const pr = payrollOf(person.id, movements, monthStates)
      return { label: 'Salaire dû', value: pr.totalReste + pr.plannedRetenue, tone: 'debt', isPayment: true }
    }
    if (PAY_ADJUST.has(t)) {
      // Ajout ou retenue du mois en cours : on montre ce qu'il reste à payer ce mois-ci ; une retenue ne peut pas le dépasser.
      const cur = payrollOf(person.id, movements, monthStates).months.find(m => m.period === currentPeriod(person.id))
      return { label: 'À payer cette période', value: cur?.aPayer ?? 0, tone: 'debt', isPayment: t === 'retenue_manuelle' }
    }
    if (t === 'remboursement_direct') return { label: 'Avance à rendre', value: person.advanceBalance || 0, tone: 'credit', isPayment: true }
    return { label: 'Avance en cours', value: person.advanceBalance || 0, tone: 'credit', isPayment: false }
  }
  const balance = balanceFor(type)
  const tooMuch = !!balance?.isPayment && amount > balance.value
  // Versement de salaire qui dépasse « salaire moins retenue » : il prend sur la retenue d'avance du mois.
  const planned = person?.type === 'employee' && type === 'je_lui_ai_verse' ? payrollOf(person.id, movements, monthStates) : null
  const eatsRetenue = planned && planned.plannedRetenue > 0 && !tooMuch ? Math.min(planned.plannedRetenue, Math.max(0, amount - planned.totalReste)) : 0
  // Versement impossible quand rien n'est dû : le bouton est grisé à l'étape « Quelle opération ? ».
  const blocked = (t: MType) => {
    const b = balanceFor(t)
    return !!b?.isPayment && b.value <= 0
  }

  const press = (k: string) => {
    if (k === 'del') return setAmountStr(s => (s.length <= 1 ? '0' : s.slice(0, -1)))
    if (k === '000') return setAmountStr(s => (s === '0' ? '0' : (s + '000').slice(0, 9)))
    setAmountStr(s => (s === '0' ? k : (s + k).slice(0, 9)))
  }

  // Clavier d'ordinateur sur l'écran « Combien ? » (sans détail ni saisie dans un champ) : chiffres et effacement
  React.useEffect(() => {
    if (!isNewMovementOpen || step !== 'combien' || hasItems) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (/^[0-9]$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('del')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Touche d'effacement : appui court = efface un chiffre, appui long (0,5 s) = vide tout le montant.
  const holdTimer = React.useRef<number | null>(null)
  const heldLong = React.useRef(false)
  const startHold = () => {
    heldLong.current = false
    holdTimer.current = window.setTimeout(() => {
      heldLong.current = true
      setAmountStr('0')
    }, 500)
  }
  const stopHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current)
    holdTimer.current = null
  }

  const back = () => {
    if (step === 'detail') setStep('combien')
    else if (step === 'combien') setStep('quoi')
    else if (step === 'quoi' && !newMovementTargetPersonId) setStep('qui')
  }

  const save = () => {
    if (!person || amount <= 0 || tooMuch) return
    addMovement({
      personId: person.id,
      personName: person.name,
      type,
      label: isAdjust ? `${LABELS[type]}${motif.trim() ? ` : ${motif.trim()}` : ''}` : (LABELS[type] ?? 'Opération'),
      amount,
      paymentMethod: isAdjust ? undefined : payment,
      period: isAdjust ? currentPeriod(personId) : undefined,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
      receiptPhoto: photo ? 'simulation_photo_recu.jpg' : undefined,
      items: hasItems ? items! : undefined,
    })
    closeNewMovement()
  }

  // Un module coupé n'est pas proposé
  const partnersList = modules.personnes ? persons.filter(p => p.type === 'partner') : []
  const employeesList = modules.employes ? persons.filter(p => p.type === 'employee' && p.status === 'actif') : []
  const bothGroups = partnersList.length > 0 && employeesList.length > 0
  const activeGroup = bothGroups ? group : partnersList.length > 0 ? 'partner' : 'employee'
  const visible = (activeGroup === 'partner' ? partnersList : employeesList)
    .filter(p => matchesPerson(p, search))

  const sub = (p: (typeof persons)[number]) => {
    if (p.type === 'employee') return p.role || 'Employé'
    // Les deux comptes séparément, comme sur sa fiche (jamais leur différence)
    // Les deux à la fois : sans « FCFA » pour que la ligne tienne sur un téléphone
    const both = !!p.owesMe && !!p.iOweHim
    const amt = (v: number) => (both ? formatFCFA(v).replace(/\s?FCFA$/, '') : formatFCFA(v))
    const parts = [
      p.owesMe ? `Son compte : ${amt(p.owesMe)}` : '',
      p.iOweHim ? `Mon compte : ${amt(p.iOweHim)}` : '',
    ].filter(Boolean)
    return parts.length ? parts.join(' · ') : 'À jour'
  }

  // Mini icône : flèche verte (on me doit) ou orange (je dois), comme sur le tableau de bord.
  const icon = (p: (typeof persons)[number]) => {
    const net = (p.owesMe || 0) - (p.iOweHim || 0)
    if (p.type === 'employee') return null
    const tone = net > 0 ? 'credit' : net < 0 ? 'debt' : null
    if (!tone) return null
    const Icon = tone === 'credit' ? ArrowDownLeft : ArrowUpRight
    return (
      <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-md bg-muted', tone === 'credit' ? 'text-credit' : 'text-debt')}>
        <Icon className="size-3.5" />
      </span>
    )
  }

  return (
    <Dialog
      open={isNewMovementOpen}
      onOpenChange={o => !o && closeNewMovement()}
      dirty={amount > 0 || note.trim() !== '' || reference.trim() !== '' || photo || hasItems || motif.trim() !== '' || (step === 'detail' && draftSum > 0)}
      dirtyKind="ajout"
    >
      <DialogContent fixedHeight>
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-1">
            {/* Ouverte depuis une fiche : la personne est fixée, pas de retour vers la liste des personnes */}
            {step !== 'qui' && !(step === 'quoi' && newMovementTargetPersonId) && !(step === 'combien' && PAY_ADJUST.has(newMovementInitialType ?? '')) && (
              <Button variant="ghost" size="icon" className="-ml-2" onClick={back} aria-label="Retour">
                <ArrowLeft />
              </Button>
            )}
            <DialogTitle className="text-lg font-semibold">{TITLES[step]}</DialogTitle>
          </div>
          <DialogDescription className="sr-only">Enregistrer une opération</DialogDescription>
        </DialogHeader>

        {/* 1. Qui ? */}
        {step === 'qui' && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {bothGroups && (
              <Tabs value={activeGroup} onValueChange={v => { setGroup(v as 'partner' | 'employee'); setSearch('') }}>
                <TabsList className="w-full">
                  <TabsTrigger value="partner">Personnes</TabsTrigger>
                  <TabsTrigger value="employee">Employés</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={activeGroup === 'employee' ? 'Chercher un employé' : 'Chercher une personne'} value={search} onChange={e => setSearch(e.target.value)} className="pr-10 pl-9" />
              {search && (
                <button
                  type="button"
                  aria-label="Effacer la recherche"
                  onClick={() => setSearch('')}
                  className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col divide-y rounded-lg border">
              {visible.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPersonId(p.id)
                    setType(p.type === 'employee' ? 'je_lui_ai_verse' : 'il_m_a_verse')
                    setStep('quoi')
                  }}
                  className="flex items-center gap-3 p-3 text-left hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{sub(p)}</p>
                  </div>
                  {icon(p)}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
              {visible.length === 0 && <p className="p-3 text-sm text-muted-foreground">Aucune personne trouvée.</p>}
            </div>
            </div>
          </div>
        )}

        {/* 2. Quoi ? */}
        {step === 'quoi' && person && kind === 'partner' && (
          // Personnes : même disposition que la fiche. Deux colonnes, chacune sous son compteur,
          // avec les deux gros boutons qui le font bouger. On regarde où va l'argent, on touche.
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            <p className="truncate py-0.5 text-sm leading-6 text-muted-foreground">{person.name}</p>
            {/* Un seul compte à la fois : onglets « Son compte / Mon compte » (comme la fiche),
                puis son montant et ses deux boutons côte à côte. */}
            <Tabs value={opSide} onValueChange={v => setOpSide(v as 'credit' | 'debt')}>
              <TabsList className="w-full">
                <TabsTrigger value="credit"><ArrowDownLeft className="text-credit" /> Son compte</TabsTrigger>
                <TabsTrigger value="debt"><ArrowUpRight className="text-debt" /> Mon compte</TabsTrigger>
              </TabsList>
            </Tabs>
            {([
              { title: 'Son compte', value: person.owesMe || 0, tone: 'credit' as const, ops: OPS.partner.filter(o => o.tone === 'credit') },
              { title: 'Mon compte', value: person.iOweHim || 0, tone: 'debt' as const, ops: OPS.partner.filter(o => o.tone === 'debt') },
            ]).filter(col => col.tone === opSide).map(col => (
              <div key={col.title} className="grid grid-cols-2 gap-2">
                <div className="col-span-2 px-1">
                  <p className="text-xs text-muted-foreground">{col.title}</p>
                  <p className={cn('text-base font-semibold tabular-nums', col.tone === 'credit' ? 'text-credit' : 'text-debt')}>
                    {formatFCFA(col.value)}
                  </p>
                </div>
                {col.ops.map(o => (
                  <button
                    key={o.type}
                    type="button"
                    disabled={blocked(o.type)}
                    onClick={() => {
                      setType(o.type)
                      setStep('combien')
                    }}
                    className="flex min-h-24 flex-col items-start justify-between gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
                  >
                    <div className={cn('flex size-9 items-center justify-center rounded-lg bg-muted', o.tone === 'credit' ? 'text-credit' : 'text-debt')}>
                      <o.Icon className="size-5" />
                    </div>
                    <span className="text-sm font-medium leading-tight">{o.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {step === 'quoi' && person && kind === 'employee' && (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            <p className="truncate py-0.5 text-sm leading-6 text-muted-foreground">{person.name}</p>
            <div className="flex flex-col divide-y rounded-lg border">
              {/* Employé parti : plus d'avance nouvelle, seulement régler ce qui reste */}
              {OPS[kind].filter(o => !(person.status === 'inactif' && o.type === 'avance_salaire')).map(o => (
                <button
                  key={o.type}
                  type="button"
                  onClick={() => {
                    setType(o.type)
                    setStep('combien')
                  }}
                  disabled={blocked(o.type)}
                  className="flex items-center gap-3 p-4 text-left hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-40"
                >
                  <div className={cn('flex size-9 items-center justify-center rounded-lg bg-muted', o.tone === 'credit' ? 'text-credit' : 'text-debt')}>
                    <o.Icon className="size-5" />
                  </div>
                  <span className="flex-1 font-medium">{o.label}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. Combien ? */}
        {step === 'combien' && person && (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            <div className="flex shrink-0 flex-col gap-1">
              <button type="button" onClick={() => setStep('quoi')} className="truncate py-0.5 text-left text-sm leading-6 text-muted-foreground">
                {person.name} · <span className={op?.tone === 'credit' || type === 'ajout_salaire' ? 'text-credit' : 'text-debt'}>{op?.label ?? LABELS[type]}</span>
              </button>
              {balance && (
                <p className="text-sm">
                  <span className="text-muted-foreground">{balance.label} : </span>
                  <span className={cn('font-medium tabular-nums', balance.tone === 'credit' ? 'text-credit' : 'text-debt')}>
                    {formatFCFA(balance.value)}
                  </span>
                  {planned && planned.plannedRetenue > 0 && (
                    <span className="block text-xs text-muted-foreground tabular-nums">dont {formatFCFA(planned.plannedRetenue)} retenus pour l'avance</span>
                  )}
                </p>
              )}
            </div>

            <div className="shrink-0 text-center">
              <span className={cn('text-4xl font-semibold tabular-nums tracking-tight', tooMuch && 'text-destructive')}>
                {formatFCFA(amount).replace(/\s?FCFA$/, '')}
              </span>
              <span className="ml-2 text-base text-muted-foreground">FCFA</span>
              {tooMuch && balance && (
                <p className="mt-1 text-xs text-destructive">Pas plus de {formatFCFA(balance.value)}</p>
              )}
              {eatsRetenue > 0 && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">− {formatFCFA(eatsRetenue)} sur la retenue d'avance</p>
              )}
            </div>

            {/* Avec un détail : le montant vient du tableau, le pavé laisse la place aux lignes */}
            {hasItems ? (
              <div className="flex min-h-44 flex-1 flex-col gap-2 overflow-hidden rounded-xl border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Détail · {items!.length} {items!.length > 1 ? 'lignes' : 'ligne'}
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={openDetail}>
                    <Table /> Modifier
                  </Button>
                </div>
                <div className="min-h-0 flex-1 divide-y overflow-y-auto text-sm">
                  {items!.map((l, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-3 py-1.5">
                      <span className="min-w-0 truncate">
                        {l.label}
                        {l.price !== undefined && (
                          <span className="text-xs text-muted-foreground"> · {formatFCFA(l.price)} × {l.qty}</span>
                        )}
                      </span>
                      <span className="shrink-0 tabular-nums">{formatFCFA(l.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
            /* Pavé : les 4 rangées se partagent la hauteur disponible */
            <div className="grid min-h-44 flex-1 grid-cols-3 grid-rows-4 gap-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'].map(k => (
                <Button
                  key={k}
                  type="button"
                  variant="ghost"
                  className="h-full min-h-10 touch-none text-2xl font-normal select-none"
                  onClick={() => {
                    if (k === 'del' && heldLong.current) {
                      heldLong.current = false
                      return
                    }
                    press(k)
                  }}
                  onPointerDown={k === 'del' ? startHold : undefined}
                  onPointerUp={k === 'del' ? stopHold : undefined}
                  onPointerLeave={k === 'del' ? stopHold : undefined}
                  onContextMenu={k === 'del' ? e => e.preventDefault() : undefined}
                  aria-label={k === 'del' ? 'Effacer (appui long : tout effacer)' : k}
                >
                  {k === 'del' ? <Delete className="size-6" /> : k}
                </Button>
              ))}
            </div>
            )}

            <div className="flex shrink-0 flex-col gap-3">
              {isAdjust && (
                <Input placeholder={MOTIF_HINT[type]} value={motif} onChange={e => setMotif(e.target.value)} />
              )}
              {!isAdjust && (
              <Tabs value={payment} onValueChange={v => setPayment(v as typeof payment)}>
                <TabsList className="w-full">
                  <TabsTrigger value="especes">Espèces</TabsTrigger>
                  {/* Un seul choix « Mobile Money » : les opérateurs changent selon le pays. */}
                  <TabsTrigger value="mobile_money">Mobile Money</TabsTrigger>
                </TabsList>
              </Tabs>
              )}

              {showMore ? (
                <div className="flex flex-col gap-2">
                  {payment !== 'especes' && (
                    <Input placeholder="Numéro de transaction" value={reference} onChange={e => setReference(e.target.value)} />
                  )}
                  <Textarea rows={1} placeholder="Note" value={note} onChange={e => setNote(e.target.value)} className="max-h-32 min-h-8 py-1.5" />
                  <Button type="button" variant={photo ? 'secondary' : 'outline'} onClick={() => setPhoto(!photo)}>
                    <Camera /> {photo ? 'Photo ajoutée' : 'Ajouter une photo'}
                  </Button>
                  {/* Détail ligne par ligne : seulement pour un crédit ou une dette */}
                  {isAddition && !hasItems && (
                    <Button type="button" variant="outline" onClick={openDetail}>
                      <Table /> Ajouter un détail
                    </Button>
                  )}
                </div>
              ) : (
                <Button type="button" variant="link" className="h-auto self-center text-muted-foreground" onClick={() => setShowMore(true)}>
                  {isAddition ? 'Ajouter une note, une photo ou un détail' : 'Ajouter une note ou une photo'}
                </Button>
              )}

              <Button size="lg" className="h-12 text-base" disabled={amount <= 0 || tooMuch} onClick={() => {
                if (eatsRetenue > 0) {
                  const v = { from: planned?.plannedRetenue ?? 0, to: (planned?.plannedRetenue ?? 0) - eatsRetenue }
                  setConfirmShown(v)
                  setConfirmRetenue(v)
                } else save()
              }}>
                Enregistrer
              </Button>
            </div>
          </div>
        )}

        {/* 4. Détail en tableau : une carte par ligne, le total en bas */}
        {step === 'detail' && person && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <label className="flex shrink-0 items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm">
              <span>
                Calculer avec prix et quantité
                <span className="block text-xs text-muted-foreground">
                  {draftCalc ? 'Libellé, prix, quantité' : 'Libellé et total de la ligne'}
                </span>
              </span>
              <Switch checked={draftCalc} onCheckedChange={setDraftCalc} />
            </label>

            {/* Lignes compactes : tout sur une rangée (libellé, prix, quantité ou total, poubelle).
                Entrée passe au champ suivant ; sur le dernier champ, une nouvelle ligne s'ouvre. */}
            <div ref={linesRef} className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
              {draft.map((l, i) => (
                <div key={i} className="flex flex-col gap-0.5 rounded-lg border px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <Input
                      data-line-field
                      enterKeyHint="next"
                      onKeyDown={nextOnEnter}
                      placeholder={`Article ${i + 1}`}
                      aria-label="Libellé"
                      value={l.label}
                      onChange={e => setLine(i, { label: e.target.value })}
                      className="h-8 min-w-0 flex-1 px-2 text-sm"
                    />
                    {draftCalc ? (
                      <>
                        <Input
                          data-line-field
                          enterKeyHint="next"
                          onKeyDown={nextOnEnter}
                          onFocus={e => e.currentTarget.select()}
                          inputMode="numeric"
                          placeholder="Prix"
                          aria-label="Prix"
                          value={thousands(l.price)}
                          onChange={e => setLine(i, { price: digits(intPart(e.target.value)) })}
                          className="h-8 w-[4.75rem] shrink-0 px-2 text-right text-sm"
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
                          className="h-8 w-11 shrink-0 px-1 text-center text-sm"
                        />
                      </>
                    ) : (
                      <Input
                        data-line-field
                        enterKeyHint="next"
                        onKeyDown={nextOnEnter}
                        onFocus={e => e.currentTarget.select()}
                        inputMode="numeric"
                        placeholder="Total"
                        aria-label="Total de la ligne"
                        value={thousands(l.total)}
                        onChange={e => setLine(i, { total: digits(intPart(e.target.value)) })}
                        className="h-8 w-24 shrink-0 px-2 text-right text-sm"
                      />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground"
                      aria-label="Supprimer la ligne"
                      onClick={() => setDraft(d => (d.length > 1 ? d.filter((_, j) => j !== i) : [emptyLine()]))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  {draftCalc && lineTotal(l, true) > 0 && (
                    <span className="pr-10 text-right text-xs text-muted-foreground tabular-nums">= {formatFCFA(lineTotal(l, true))}</span>
                  )}
                </div>
              ))}
              <Button type="button" variant="ghost" className="self-start" onClick={() => setDraft(d => [...d, emptyLine()])}>
                <Plus /> Ajouter une ligne
              </Button>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t pt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-2xl font-semibold tabular-nums">{formatFCFA(draftSum)}</span>
              </div>
              <div className={cn('grid gap-2', hasItems ? 'grid-cols-2' : 'grid-cols-1')}>
                {hasItems && (
                  <Button type="button" variant="ghost" className="h-12 text-destructive" onClick={removeDetail}>
                    Supprimer le détail
                  </Button>
                )}
                <Button size="lg" className="h-12 text-base" disabled={draftSum <= 0} onClick={confirmDetail}>
                  Confirmer
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>

      <Dialog open={confirmRetenue !== null} onOpenChange={o => !o && setConfirmRetenue(null)}>
        <DialogContent>
          <div className="flex flex-col gap-4">
            <DialogHeader className="gap-1 p-0">
              <DialogTitle className="text-left">Toucher à la retenue d'avance ?</DialogTitle>
              <DialogDescription className="text-left">
                Ce mois-ci, il rendra {formatFCFA(confirmShown.to)} au lieu de {formatFCFA(confirmShown.from)}.
              </DialogDescription>
            </DialogHeader>
            <Button size="lg" className="h-12" onClick={() => { setConfirmRetenue(null); save() }}>
              Continuer
            </Button>
            <Button variant="outline" size="lg" className="h-12" onClick={() => setConfirmRetenue(null)}>
              Revenir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
