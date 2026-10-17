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
  Undo2,
} from 'lucide-react'

import { useStore } from '@/data/store'
import type { Movement } from '@/data/mockData'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn, formatFCFA } from '@/lib/utils'

// Saisie d'une opération en 3 écrans courts, une seule question par écran :
//   Qui ?  →  Quoi ?  →  Combien ?
// Ouverte depuis une fiche, la personne et l'opération sont déjà connues : on arrive
// directement sur « Combien ? ». Les options (note, photo, référence) restent repliées.

type Step = 'qui' | 'quoi' | 'combien'
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
}

const TITLES: Record<Step, string> = { qui: 'Qui ?', quoi: 'Quelle opération ?', combien: 'Combien ?' }

export const NewMovementModal: React.FC = () => {
  const { isNewMovementOpen, closeNewMovement, newMovementTargetPersonId, newMovementInitialType, persons, addMovement } =
    useStore()

  const [step, setStep] = useState<Step>('qui')
  const [personId, setPersonId] = useState('')
  const [type, setType] = useState<MType>('il_m_a_verse')
  const [amountStr, setAmountStr] = useState('0')
  const [payment, setPayment] = useState<'especes' | 'momo_mtn' | 'airtel_money'>('especes')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<'partner' | 'employee'>('partner')

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
  }, [isNewMovementOpen, newMovementTargetPersonId, newMovementInitialType])

  const person = persons.find(p => p.id === personId)
  const kind = person?.type === 'employee' ? 'employee' : 'partner'
  const op = OPS[kind].find(o => o.type === type)
  const amount = parseInt(amountStr, 10) || 0

  // Le compte que l'opération fait bouger, et son montant actuel.
  // Un versement (ou un remboursement) ne peut jamais dépasser ce qui est dû.
  type Balance = { label: string; value: number; tone: 'credit' | 'debt'; isPayment: boolean }
  const balanceFor = (t: MType): Balance | null => {
    if (!person) return null
    if (person.type === 'partner') {
      if (t === 'il_m_a_verse' || t === 'il_a_pris_credit')
        return { label: 'Il me doit', value: person.owesMe || 0, tone: 'credit', isPayment: t === 'il_m_a_verse' }
      return { label: 'Je lui dois', value: person.iOweHim || 0, tone: 'debt', isPayment: t === 'je_lui_ai_verse' }
    }
    if (t === 'je_lui_ai_verse') return { label: 'Salaire dû', value: person.currentSalaryDue || 0, tone: 'debt', isPayment: true }
    if (t === 'remboursement_direct') return { label: 'Avance à rendre', value: person.advanceBalance || 0, tone: 'credit', isPayment: true }
    return { label: 'Avance en cours', value: person.advanceBalance || 0, tone: 'credit', isPayment: false }
  }
  const balance = balanceFor(type)
  const tooMuch = !!balance?.isPayment && amount > balance.value
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
    if (step === 'combien') setStep('quoi')
    else if (step === 'quoi' && !newMovementTargetPersonId) setStep('qui')
  }

  const save = () => {
    if (!person || amount <= 0 || tooMuch) return
    addMovement({
      personId: person.id,
      personName: person.name,
      type,
      label: LABELS[type] ?? 'Opération',
      amount,
      paymentMethod: payment,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
      receiptPhoto: photo ? 'simulation_photo_recu.jpg' : undefined,
    })
    closeNewMovement()
  }

  const partnersList = persons.filter(p => p.type === 'partner')
  const employeesList = persons.filter(p => p.type === 'employee' && p.status === 'actif')
  const bothGroups = partnersList.length > 0 && employeesList.length > 0
  const activeGroup = bothGroups ? group : partnersList.length > 0 ? 'partner' : 'employee'
  const visible = (activeGroup === 'partner' ? partnersList : employeesList)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.phone || '').includes(search))

  const sub = (p: (typeof persons)[number]) => {
    if (p.type === 'employee') return p.role || 'Employé'
    const net = (p.owesMe || 0) - (p.iOweHim || 0)
    if (net > 0) return `Me doit ${formatFCFA(net)}`
    if (net < 0) return `Je lui dois ${formatFCFA(-net)}`
    return 'À jour'
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
      dirty={amount > 0 || note.trim() !== '' || reference.trim() !== '' || photo}
      dirtyKind="ajout"
    >
      <DialogContent fixedHeight>
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-1">
            {/* Ouverte depuis une fiche : la personne est fixée, pas de retour vers la liste des personnes */}
            {step !== 'qui' && !(step === 'quoi' && newMovementTargetPersonId) && (
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
              <Input placeholder={activeGroup === 'employee' ? 'Chercher un employé' : 'Chercher une personne'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
              {visible.length === 0 && <p className="p-3 text-sm text-muted-foreground">Personne trouvée.</p>}
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
            <div className="grid grid-cols-2 gap-3">
              {([
                { title: 'Il me doit', value: person.owesMe || 0, tone: 'credit' as const, ops: OPS.partner.filter(o => o.tone === 'credit') },
                { title: 'Je lui dois', value: person.iOweHim || 0, tone: 'debt' as const, ops: OPS.partner.filter(o => o.tone === 'debt') },
              ]).map(col => (
                <div key={col.title} className="flex flex-col gap-2">
                  <div className="px-1">
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
          </div>
        )}

        {step === 'quoi' && person && kind === 'employee' && (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            <p className="truncate py-0.5 text-sm leading-6 text-muted-foreground">{person.name}</p>
            <div className="flex flex-col divide-y rounded-lg border">
              {OPS[kind].map(o => (
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
                {person.name} · <span className={op?.tone === 'credit' ? 'text-credit' : 'text-debt'}>{op?.label}</span>
              </button>
              {balance && (
                <p className="text-sm">
                  <span className="text-muted-foreground">{balance.label} : </span>
                  <span className={cn('font-medium tabular-nums', balance.tone === 'credit' ? 'text-credit' : 'text-debt')}>
                    {formatFCFA(balance.value)}
                  </span>
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
            </div>

            {/* Pavé : les 4 rangées se partagent la hauteur disponible */}
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

            <div className="flex shrink-0 flex-col gap-3">
              <Tabs value={payment} onValueChange={v => setPayment(v as typeof payment)}>
                <TabsList className="w-full">
                  <TabsTrigger value="especes">Espèces</TabsTrigger>
                  <TabsTrigger value="momo_mtn">MTN MoMo</TabsTrigger>
                  <TabsTrigger value="airtel_money">Airtel</TabsTrigger>
                </TabsList>
              </Tabs>

              {showMore ? (
                <div className="flex flex-col gap-2">
                  {payment !== 'especes' && (
                    <Input placeholder="Numéro de transaction" value={reference} onChange={e => setReference(e.target.value)} />
                  )}
                  <Input placeholder="Note" value={note} onChange={e => setNote(e.target.value)} />
                  <Button type="button" variant={photo ? 'secondary' : 'outline'} onClick={() => setPhoto(!photo)}>
                    <Camera /> {photo ? 'Photo ajoutée' : 'Ajouter une photo'}
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="link" className="h-auto self-center text-muted-foreground" onClick={() => setShowMore(true)}>
                  Ajouter une note ou une photo
                </Button>
              )}

              <Button size="lg" className="h-12 text-base" disabled={amount <= 0 || tooMuch} onClick={save}>
                Enregistrer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
