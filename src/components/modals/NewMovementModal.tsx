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
    { type: 'il_m_a_verse', label: "Il m'a versé", Icon: ArrowDownLeft, tone: 'credit' },
    { type: 'il_a_pris_credit', label: 'Il a pris à crédit', Icon: Plus, tone: 'credit' },
    { type: 'je_lui_ai_verse', label: 'Je lui ai versé', Icon: ArrowUpRight, tone: 'debt' },
    { type: 'j_ai_pris_credit', label: "J'ai pris à crédit", Icon: Plus, tone: 'debt' },
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

  // Versement plus grand que ce qui était dû : le reste devient une avance (une ligne, pas un pavé).
  let surplus = 0
  if (person?.type === 'partner') {
    if (type === 'il_m_a_verse') surplus = amount - (person.owesMe || 0)
    if (type === 'je_lui_ai_verse') surplus = amount - (person.iOweHim || 0)
  }

  const press = (k: string) => {
    if (k === 'del') return setAmountStr(s => (s.length <= 1 ? '0' : s.slice(0, -1)))
    if (k === '000') return setAmountStr(s => (s === '0' ? '0' : (s + '000').slice(0, 9)))
    setAmountStr(s => (s === '0' ? k : (s + k).slice(0, 9)))
  }

  const back = () => {
    if (step === 'combien') setStep('quoi')
    else if (step === 'quoi') setStep('qui')
  }

  const save = () => {
    if (!person || amount <= 0) return
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
    const tone = p.type === 'employee' ? ((p.currentSalaryDue || 0) > 0 ? 'debt' : null) : net > 0 ? 'credit' : net < 0 ? 'debt' : null
    if (!tone) return null
    const Icon = tone === 'credit' ? ArrowDownLeft : ArrowUpRight
    return (
      <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-md bg-muted', tone === 'credit' ? 'text-credit' : 'text-debt')}>
        <Icon className="size-3.5" />
      </span>
    )
  }

  return (
    <Dialog open={isNewMovementOpen} onOpenChange={o => !o && closeNewMovement()}>
      <DialogContent fixedHeight>
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-1">
            {step !== 'qui' && (
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
        {step === 'quoi' && person && (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            <p className="truncate text-sm text-muted-foreground">{person.name}</p>
            <div className="flex flex-col divide-y rounded-lg border">
              {OPS[kind].map(o => (
                <button
                  key={o.type}
                  type="button"
                  onClick={() => {
                    setType(o.type)
                    setStep('combien')
                  }}
                  className="flex items-center gap-3 p-4 text-left hover:bg-muted/50"
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
          <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            <button type="button" onClick={() => setStep('quoi')} className="truncate text-left text-sm text-muted-foreground">
              {person.name} · <span className={op?.tone === 'credit' ? 'text-credit' : 'text-debt'}>{op?.label}</span>
            </button>

            <div className="py-2 text-center">
              <span className="text-5xl font-semibold tabular-nums tracking-tight">{formatFCFA(amount).replace(/\s?FCFA$/, '')}</span>
              <span className="ml-2 text-lg text-muted-foreground">FCFA</span>
              {surplus > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">{formatFCFA(surplus)} de plus que dû : gardé comme avance.</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'].map(k => (
                <Button key={k} type="button" variant="ghost" className="h-14 text-2xl font-normal" onClick={() => press(k)} aria-label={k === 'del' ? 'Effacer' : k}>
                  {k === 'del' ? <Delete className="size-6" /> : k}
                </Button>
              ))}
            </div>

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

          </div>
            <Button size="lg" className="h-12 shrink-0 text-base" disabled={amount <= 0} onClick={save}>
              Enregistrer
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
