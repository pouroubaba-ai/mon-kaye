import React, { useEffect, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Camera,
  ChevronRight,
  Delete,
  Eye,
  HandCoins,
  Plus,
  Search,
  Table,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'

import { useStore } from '@/data/store'
import { currentPeriod, payrollOf, toTime } from '@/data/payroll'
import type { Movement, MovementItem } from '@/data/mockData'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import * as Center from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn, formatFCFA, matchesPerson, useKept, compressImage } from '@/lib/utils'

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
// Depuis les boutons de l'accueil : l'opération est déjà choisie, on demande seulement « à qui ? »
const DIRECT: Partial<Record<Movement['type'], { side: 'lui' | 'moi'; pay: boolean; title: string; ask: string; emp?: boolean }>> = {
  avance_salaire: { side: 'lui', pay: false, title: 'Avance', ask: 'à qui ?', emp: true },
  remboursement_direct: { side: 'lui', pay: true, title: 'Il rend', ask: 'qui ?', emp: true },
  il_a_pris_credit: { side: 'lui', pay: false, title: 'Crédit', ask: 'à qui ?' },
  il_m_a_verse: { side: 'lui', pay: true, title: 'Versement', ask: 'de qui ?' },
  j_ai_pris_credit: { side: 'moi', pay: false, title: 'Dette', ask: 'chez qui ?' },
  je_lui_ai_verse: { side: 'moi', pay: true, title: 'Versement', ask: 'à qui ?' },
}

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
  const [photo, setPhoto] = useState<string | null>(null) // photo jointe (image compressée)
  const photoInput = React.useRef<HTMLInputElement>(null)
  const [showMore, setShowMore] = useState(false)
  // Versé tout de suite au moment d'un crédit (ou d'une dette) : caché dans « Ajouter… », pour les cas où le client paie une partie
  const [paidNowOn, setPaidNowOn] = useState(false)
  const [paidNowStr, setPaidNowStr] = useState('0')
  const [target, setTarget] = useState<'amount' | 'paid'>('amount') // le montant que le pavé remplit
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
    setPhoto(null)
    setShowMore(false)
    setPaidNowOn(false)
    setPaidNowStr('0')
    setTarget('amount')
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
  const isCredit = person?.type === 'partner' && (type === 'il_a_pris_credit' || type === 'j_ai_pris_credit')
  const paidNow = isCredit && paidNowOn ? parseInt(paidNowStr, 10) || 0 : 0
  const hasItems = isAddition && !!items && items.length > 0
  const amount = hasItems ? items!.reduce((a, l) => a + l.total, 0) : parseInt(amountStr, 10) || 0
  const paidTooMuch = paidNow > 0 && paidNow > amount
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
        return { label: 'Client', value: person.owesMe || 0, tone: 'credit', isPayment: t === 'il_m_a_verse' }
      return { label: 'Fournisseur', value: person.iOweHim || 0, tone: 'debt', isPayment: t === 'je_lui_ai_verse' }
    }
    if (t === 'je_lui_ai_verse') {
      // Salaire dû : seulement les périodes arrivées à échéance. La période en cours ne se paie pas
      // encore : ce qui dépasse devient une avance (on le demande avant d'enregistrer).
      const pr = payrollOf(person.id, movements, monthStates)
      return { label: 'Salaire dû', value: pr.dueReste, tone: 'debt', isPayment: true }
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
  // Versement de salaire : ce qui dépasse le salaire dû part en avance (pas de blocage)
  const salaryPay = person?.type === 'employee' && type === 'je_lui_ai_verse'
  const toAdvance = salaryPay && balance ? Math.max(0, amount - balance.value) : 0
  const tooMuch = !salaryPay && !!balance?.isPayment && amount > balance.value
  // Question « pas encore dû → avance ? » : ce qui est versé sur le salaire dû, et ce qui part en avance
  const [askAdvance, setAskAdvance] = useState<{ due: number; adv: number } | null>(null)
  // L'œil devant le montant d'un compte : son détail (total, versé, retours, reste) ; côté Client ou Fournisseur
  const [showAccount, setShowAccount] = useState<'credit' | 'debt' | null>(null)
  const accountShown = useKept(showAccount)
  const advShown = useKept(askAdvance)
  // Versement de salaire qui dépasse « salaire moins retenue » : il prend sur la retenue d'avance du mois.
  const planned = person?.type === 'employee' && type === 'je_lui_ai_verse' ? payrollOf(person.id, movements, monthStates) : null
  // La période en cours ne se paie plus avant l'échéance : un versement ne touche jamais la retenue prévue
  const eatsRetenue = 0
  // Versement impossible quand rien n'est dû : le bouton est grisé à l'étape « Quelle opération ? ».
  const blocked = (t: MType) => {
    const b = balanceFor(t)
    if (person?.type === 'employee' && t === 'je_lui_ai_verse') return false // rien de dû : il partira en avance
    return !!b?.isPayment && b.value <= 0
  }

  const press = (k: string) => {
    const set = target === 'paid' ? setPaidNowStr : setAmountStr
    if (k === 'del') return set(s => (s.length <= 1 ? '0' : s.slice(0, -1)))
    if (k === '000' || k === '00') return set(s => (s === '0' ? '0' : (s + k).slice(0, 9)))
    set(s => (s === '0' ? k : (s + k).slice(0, 9)))
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
    else if (step === 'combien') {
      // Retour à « Quelle opération ? » : le montant saisi (ou son détail) est effacé
      setAmountStr('0')
      setItems(null)
      setPaidNowOn(false)
      setPaidNowStr('0')
      setTarget('amount')
      // Ouvert depuis l'accueil (« Crédit », « Versement »…) : on revient à « à qui ? »
      setStep(newMovementInitialType && !newMovementTargetPersonId ? 'qui' : 'quoi')
    }
    else if (step === 'quoi' && !newMovementTargetPersonId) setStep('qui')
  }

  const save = () => {
    if (!person || amount <= 0 || tooMuch) return
    if (toAdvance > 0) {
      // Pas encore dû : la part du salaire dû est versée, le reste est enregistré comme une avance
      const due = amount - toAdvance
      if (due > 0)
        addMovement({ personId: person.id, personName: person.name, type: 'je_lui_ai_verse', label: LABELS.je_lui_ai_verse ?? 'Salaire versé', amount: due, paymentMethod: payment, note: note.trim() || undefined })
      addMovement({
        personId: person.id,
        personName: person.name,
        type: 'avance_salaire',
        label: 'Avance sur salaire',
        amount: toAdvance,
        paymentMethod: payment,
        note: 'Versé avant l’échéance du salaire : enregistré comme une avance',
      })
      closeNewMovement()
      return
    }
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
      receiptPhoto: photo ?? undefined,
      items: hasItems ? items! : undefined,
    })
    // Une partie versée tout de suite : un versement à part, le même jour, pour que l'historique reste juste
    if (isCredit && paidNow > 0)
      addMovement({
        personId: person.id,
        personName: person.name,
        type: type === 'il_a_pris_credit' ? 'il_m_a_verse' : 'je_lui_ai_verse',
        label: LABELS[type === 'il_a_pris_credit' ? 'il_m_a_verse' : 'je_lui_ai_verse'] ?? 'Versement',
        amount: paidNow,
        paymentMethod: payment,
        note: 'Versé au moment du crédit',
      })
    closeNewMovement()
  }

  // Un module coupé n'est pas proposé
  const partnersList = modules.personnes ? persons.filter(p => p.type === 'partner') : []
  const employeesList = modules.employes ? persons.filter(p => p.type === 'employee' && p.status === 'actif') : []
  const bothGroups = partnersList.length > 0 && employeesList.length > 0
  const activeGroup = bothGroups ? group : partnersList.length > 0 ? 'partner' : 'employee'
  // Ouvert depuis l'accueil avec une opération déjà choisie : seulement les partenaires concernés
  const directSide = !newMovementTargetPersonId && newMovementInitialType ? (DIRECT[newMovementInitialType] ?? null) : null
  const sideAmount = (p: (typeof persons)[number]) => (directSide?.emp ? p.advanceBalance || 0 : directSide?.side === 'lui' ? p.owesMe || 0 : p.iOweHim || 0)
  const visible = directSide
    ? (directSide.emp ? employeesList : partnersList)
        .filter(p => matchesPerson(p, search) && (search.trim() !== '' || !p.archived) && (!directSide.pay || sideAmount(p) > 0))
        .sort((a, b) => sideAmount(b) - sideAmount(a) || a.name.localeCompare(b.name, 'fr'))
    : (activeGroup === 'partner' ? partnersList : employeesList).filter(p => matchesPerson(p, search))

  // Sous le nom : « Client 830 078 000 » (montant en vert), « Fournisseur 25 000 » (montant en orange) (un côté à zéro n'est pas affiché)
  const sub = (p: (typeof persons)[number]) => {
    if (p.type === 'employee') return p.role || 'Employé'
    // Les deux à la fois : sans « FCFA » pour que la ligne tienne sur un téléphone
    const both = !!p.owesMe && !!p.iOweHim
    const amt = (v: number) => (both ? formatFCFA(v).replace(/\s?FCFA$/, '') : formatFCFA(v))
    if (!p.owesMe && !p.iOweHim) return 'À jour'
    return (
      <>
        {!!p.owesMe && <>Client <span className="text-credit">{amt(p.owesMe)}</span></>}
        {both && ' · '}
        {!!p.iOweHim && <>Fournisseur <span className="text-debt">{amt(p.iOweHim)}</span></>}
      </>
    )
  }

  return (
    <Dialog
      open={isNewMovementOpen}
      onOpenChange={o => !o && closeNewMovement()}
      dirty={amount > 0 || note.trim() !== '' || reference.trim() !== '' || !!photo || hasItems || motif.trim() !== '' || (step === 'detail' && draftSum > 0)}
      dirtyKind="ajout"
    >
      <DialogContent fixedHeight>
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-1">
            {/* Ouverte depuis une fiche : la personne est fixée, pas de retour vers la liste des personnes */}
            {step !== 'qui' && !(step === 'quoi' && newMovementTargetPersonId) && !(step === 'combien' && (PAY_ADJUST.has(newMovementInitialType ?? '') || (!!newMovementTargetPersonId && !!newMovementInitialType))) && (
              <Button variant="ghost" size="icon" className="-ml-2" onClick={back} aria-label="Retour">
                <ArrowLeft />
              </Button>
            )}
            <DialogTitle className="text-lg font-semibold">
              {step === 'qui' && directSide ? (
                <>
                  {directSide.title} <span className="font-medium text-muted-foreground">— {directSide.ask}</span>
                </>
              ) : (
                TITLES[step]
              )}
            </DialogTitle>
          </div>
          <DialogDescription className="sr-only">Enregistrer une opération</DialogDescription>
        </DialogHeader>

        {/* 1. Qui ? */}
        {step === 'qui' && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {bothGroups && !directSide && (
              <Tabs value={activeGroup} onValueChange={v => { setGroup(v as 'partner' | 'employee'); setSearch('') }}>
                <TabsList className="w-full">
                  <TabsTrigger value="partner">Partenaires</TabsTrigger>
                  <TabsTrigger value="employee">Employés</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={directSide ? (directSide.emp ? 'Chercher un employé' : directSide.side === 'lui' ? 'Chercher un client' : 'Chercher un fournisseur') : activeGroup === 'employee' ? 'Chercher un employé' : 'Chercher un partenaire'} value={search} onChange={e => setSearch(e.target.value)} className="pr-10 pl-9" />
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
                    if (directSide && newMovementInitialType) {
                      setType(newMovementInitialType)
                      setStep('combien')
                      return
                    }
                    setType(p.type === 'employee' ? 'je_lui_ai_verse' : 'il_m_a_verse')
                    setStep('quoi')
                  }}
                  className="flex items-center gap-3 p-3 text-left hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {directSide ? (
                        sideAmount(p) > 0 ? (
                          <span className={directSide.side === 'lui' ? 'text-kgreen' : 'text-kred'}>{formatFCFA(sideAmount(p))}</span>
                        ) : (
                          'À jour'
                        )
                      ) : (
                        sub(p)
                      )}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
              {visible.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">
                  {directSide?.pay && !search.trim() ? (directSide.emp ? 'Aucune avance à rendre.' : directSide.side === 'lui' ? 'Personne ne vous doit rien.' : 'Vous ne devez rien à personne.') : 'Personne ne s’appelle comme ça.'}
                </p>
              )}
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
                <TabsTrigger value="credit"><ArrowDownLeft className="text-credit" /> Client</TabsTrigger>
                <TabsTrigger value="debt"><ArrowUpRight className="text-debt" /> Fournisseur</TabsTrigger>
              </TabsList>
            </Tabs>
            {([
              { title: 'Client', value: person.owesMe || 0, tone: 'credit' as const, ops: OPS.partner.filter(o => o.tone === 'credit') },
              { title: 'Fournisseur', value: person.iOweHim || 0, tone: 'debt' as const, ops: OPS.partner.filter(o => o.tone === 'debt') },
            ]).filter(col => col.tone === opSide).map(col => (
              <div key={col.title} className="grid grid-cols-2 gap-2">
                <div className="col-span-2 px-1">
                  <p className="text-xs text-muted-foreground">{col.title}</p>
                  <p className={cn('flex items-center text-base font-semibold tabular-nums', col.tone === 'credit' ? 'text-credit' : 'text-debt')}>
                    {formatFCFA(col.value)}
                    <button
                      type="button"
                      aria-label="Voir le détail du compte"
                      onClick={() => setShowAccount(col.tone)}
                      className="ml-1.5 inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Eye className="size-4" />
                    </button>
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
                  {person.type === 'partner' && (
                    <button
                      type="button"
                      aria-label="Voir le détail du compte"
                      onClick={() => setShowAccount(balance.tone)}
                      className="ml-1.5 inline-flex size-7 translate-y-0.5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Eye className="size-4" />
                    </button>
                  )}
                  {planned && planned.plannedRetenue > 0 && balance.value > 0 && (
                    <span className="block text-xs text-muted-foreground tabular-nums">dont {formatFCFA(planned.plannedRetenue)} retenus pour l'avance</span>
                  )}
                </p>
              )}
            </div>

            <div className="shrink-0 text-center">
              <button type="button" onClick={() => setTarget('amount')} className={cn('rounded-lg px-2', paidNowOn && target === 'amount' && 'bg-muted')}>
              <span className={cn('text-4xl font-semibold tabular-nums tracking-tight', tooMuch && 'text-destructive', paidNowOn && target !== 'amount' && 'text-muted-foreground')}>
                {formatFCFA(amount).replace(/\s?FCFA$/, '')}
              </span>
              <span className="ml-2 text-base text-muted-foreground">FCFA</span>
              </button>
              {/* Versé maintenant : on touche ce montant pour le taper avec le même pavé */}
              {paidNowOn && (
                <div className="mt-1 flex flex-col items-center gap-0.5 text-sm">
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setTarget('paid')}
                      className={cn('rounded-md px-2 py-0.5 tabular-nums', target === 'paid' ? 'bg-muted text-foreground' : 'text-muted-foreground')}
                    >
                      Versé maintenant : <span className="font-semibold">{formatFCFA(paidNow)}</span>
                    </button>
                    <button
                      type="button"
                      aria-label="Enlever le versement"
                      onClick={() => {
                        setPaidNowOn(false)
                        setPaidNowStr('0')
                        setTarget('amount')
                      }}
                      className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                  {paidTooMuch ? (
                    <span className="text-xs text-destructive">Pas plus que le crédit</span>
                  ) : (
                    <span className="text-xs text-muted-foreground tabular-nums">Reste à crédit : {formatFCFA(amount - paidNow)}</span>
                  )}
                </div>
              )}
              {tooMuch && balance && (
                <p className="mt-1 text-xs text-destructive">Pas plus de {formatFCFA(balance.value)}</p>
              )}
              {eatsRetenue > 0 && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">− {formatFCFA(eatsRetenue)} sur la retenue d'avance</p>
              )}
            </div>

            {/* Avec un détail : le montant vient du tableau, le pavé laisse la place aux lignes */}
            {hasItems && target !== 'paid' ? (
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
            /* Pavé, comme une calculatrice : les 4 rangées se partagent la hauteur disponible.
               1 2 3 ⌫ / 4 5 6 00 / 7 8 9 000 (sur deux rangées) / 0 (large) */
            <div className="grid min-h-44 flex-1 grid-cols-4 grid-rows-4 gap-1">
              {['1', '2', '3', 'del', '4', '5', '6', '00', '7', '8', '9', '000', '0'].map(k => (
                <Button
                  key={k}
                  type="button"
                  variant="ghost"
                  className={cn('h-full min-h-10 touch-none text-2xl font-normal select-none', k === '000' && 'row-span-2', k === '0' && 'col-span-3')}
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
                  {/* Toucher le bouton : le téléphone propose de prendre une photo ou d'en choisir une dans la galerie */}
                  <input
                    ref={photoInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async e => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (!f) return
                      try {
                        setPhoto(await compressImage(f))
                      } catch {
                        /* image illisible : rien n'est joint */
                      }
                    }}
                  />
                  {photo ? (
                    <div className="relative">
                      <img src={photo} alt="Photo jointe" className="max-h-40 w-full rounded-lg border object-cover" />
                      <Button type="button" size="icon" variant="secondary" aria-label="Enlever la photo" className="absolute top-2 right-2 size-8 rounded-full" onClick={() => setPhoto(null)}>
                        <X />
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" onClick={() => photoInput.current?.click()}>
                      <Camera /> Ajouter une photo
                    </Button>
                  )}
                  {isCredit && !paidNowOn && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setPaidNowOn(true)
                        setTarget('paid')
                      }}
                    >
                      <HandCoins /> Versé maintenant
                    </Button>
                  )}
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

              <Button size="lg" className="h-12 text-base" disabled={amount <= 0 || tooMuch || paidTooMuch} onClick={() => {
                if (toAdvance > 0) setAskAdvance({ due: amount - toAdvance, adv: toAdvance })
                else if (eatsRetenue > 0) {
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

      {/* L'œil devant le montant du compte : total pris, versé, retours et reste, au centre de l'écran */}
      {person && person.type === 'partner' && (() => {
        const side = (showAccount ?? accountShown) !== 'debt'
        const reste = side ? person.owesMe || 0 : person.iOweHim || 0
        const t = side ? { credit: 'il_a_pris_credit', pay: 'il_m_a_verse', ret: 'il_a_retourne' } : { credit: 'j_ai_pris_credit', pay: 'je_lui_ai_verse', ret: 'j_ai_retourne' }
        const mine = (type: string) => movements.filter(m => m.personId === person.id && m.type === type && !m.isCancelled)
        const sum = (type: string) => mine(type).reduce((a, m) => a + m.amount, 0)
        // Date de la dernière opération de ce type, par rapport à aujourd'hui (« aujourd'hui », « hier », « il y a 5 j », « jamais »)
        const ago = (type: string) => {
          const last = mine(type).map(m => toTime(m.date)).sort((x, y) => y - x)[0]
          if (last === undefined) return 'jamais'
          const n = Math.round((new Date(new Date().toDateString()).getTime() - last) / 86_400_000)
          return n <= 0 ? "aujourd'hui" : n === 1 ? 'hier' : `il y a ${n} j`
        }
        // Total = reste + versé + retours, comme sur les cartes (un ancien solde sans opération compte aussi)
        const rows: [string, number, string][] = [
          ['Total', reste + sum(t.pay) + sum(t.ret), ago(t.credit)],
          ['Versé', sum(t.pay), ago(t.pay)],
          ...(sum(t.ret) > 0 ? ([['Retours', sum(t.ret), ago(t.ret)]] as [string, number, string][]) : []),
        ]
        return (
          <Center.Dialog open={showAccount !== null} onOpenChange={o => !o && setShowAccount(null)}>
            <Center.DialogContent className="w-[calc(100%-2rem)] max-w-sm gap-4">
              <Center.DialogHeader className="text-left">
                <Center.DialogTitle>{side ? 'Client' : 'Fournisseur'}</Center.DialogTitle>
                <Center.DialogDescription>{person.name}</Center.DialogDescription>
              </Center.DialogHeader>
              <div className="flex flex-col divide-y rounded-lg border text-sm">
                {rows.map(([label, v, when]) => (
                  <div key={label} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="flex flex-col">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="text-xs text-muted-foreground/70">{when}</span>
                    </span>
                    <span className="font-medium tabular-nums">{formatFCFA(v)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="font-medium">Reste</span>
                  <span className={cn('font-semibold tabular-nums', side ? 'text-credit' : 'text-debt')}>{formatFCFA(reste)}</span>
                </div>
              </div>
            </Center.DialogContent>
          </Center.Dialog>
        )
      })()}

      {/* Salaire pas encore dû : on ne peut pas payer une période avant son échéance. Ce qui dépasse devient une avance. */}
      <Dialog open={askAdvance !== null} onOpenChange={o => !o && setAskAdvance(null)}>
        <DialogContent>
          <div className="flex flex-col gap-4">
            <DialogHeader className="gap-1 p-0">
              <DialogTitle className="text-left">{advShown && advShown.due > 0 ? `Vous lui devez seulement ${formatFCFA(advShown.due)}` : 'Vous ne lui devez encore rien'}</DialogTitle>
              <DialogDescription className="text-left">
                Le salaire de la période en cours n'est dû qu'à son échéance.{' '}
                {advShown && advShown.due > 0
                  ? `${formatFCFA(advShown.due)} iront sur son salaire dû, et ${formatFCFA(advShown.adv)} seront enregistrés comme une avance.`
                  : `Ces ${formatFCFA(advShown?.adv ?? 0)} seront enregistrés comme une avance.`}
              </DialogDescription>
            </DialogHeader>
            <Button size="lg" className="h-12" onClick={() => { setAskAdvance(null); save() }}>
              Continuer
            </Button>
            <Button variant="outline" size="lg" className="h-12" onClick={() => setAskAdvance(null)}>
              Revenir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
