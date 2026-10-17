import React, { useState, useEffect } from 'react'
import { useStore } from '@/data/store'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatFCFA } from '@/lib/utils'
import type { Movement } from '@/data/mockData'
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Coins, 
  HandCoins, 
  Smartphone, 
  CheckCircle2, 
  AlertTriangle, 
  Camera, 
  X 
} from 'lucide-react'

const OPERATION_LABELS: Record<string, string> = {
  il_m_a_verse: "Il m'a versé",
  il_a_pris_credit: 'Il a pris à crédit',
  je_lui_ai_verse: 'Je lui ai versé',
  j_ai_pris_credit: "J'ai pris à crédit",
  avance_salaire: 'Donner une avance',
  remboursement_direct: 'Il rembourse son avance de sa poche',
}

export const NewMovementModal: React.FC = () => {
  const { 
    isNewMovementOpen, 
    closeNewMovement, 
    newMovementTargetPersonId, 
    newMovementInitialType, 
    persons, 
    addMovement 
  } = useStore()

  const [selectedPersonId, setSelectedPersonId] = useState<string>('')
  const [movementType, setMovementType] = useState<Movement['type']>('il_m_a_verse')
  const [amountStr, setAmountStr] = useState<string>('0')
  const [paymentMethod, setPaymentMethod] = useState<'especes' | 'momo_mtn' | 'airtel_money'>('especes')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [hasReceiptPhoto, setHasReceiptPhoto] = useState(false)
  const [surplusConfirmed, setSurplusConfirmed] = useState(false)
  const [showChoices, setShowChoices] = useState(true)

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isNewMovementOpen) {
      const targetId = newMovementTargetPersonId || (persons[0]?.id || '')
      setSelectedPersonId(targetId)
      
      const person = persons.find(p => p.id === targetId)
      if (newMovementInitialType) {
        setMovementType(newMovementInitialType)
      } else if (person?.type === 'employee') {
        setMovementType('je_lui_ai_verse')
      } else {
        setMovementType('il_m_a_verse')
      }
      
      setAmountStr('0')
      setPaymentMethod('especes')
      setReference('')
      setNote('')
      setHasReceiptPhoto(false)
      setSurplusConfirmed(false)
      // Ouvert depuis une fiche avec l'opération déjà choisie : on ne redemande ni la personne ni l'opération.
      setShowChoices(!(newMovementTargetPersonId && newMovementInitialType))
    }
  }, [isNewMovementOpen, newMovementTargetPersonId, newMovementInitialType, persons])

  const currentPerson = persons.find(p => p.id === selectedPersonId)
  const numericAmount = parseInt(amountStr, 10) || 0

  // Keyboard handlers
  const handleDigit = (digit: string) => {
    if (amountStr === '0') {
      setAmountStr(digit)
    } else if (amountStr.length < 9) {
      setAmountStr(amountStr + digit)
    }
  }

  const handleQuickAdd = (addVal: number) => {
    const current = parseInt(amountStr, 10) || 0
    setAmountStr(String(current + addVal))
  }

  const handleClear = () => {
    setAmountStr('0')
  }

  const handleDelete = () => {
    if (amountStr.length <= 1) {
      setAmountStr('0')
    } else {
      setAmountStr(amountStr.slice(0, -1))
    }
  }

  // Check surplus condition
  let surplusAmount = 0
  if (currentPerson?.type === 'partner') {
    if (movementType === 'il_m_a_verse' && numericAmount > (currentPerson.owesMe || 0)) {
      surplusAmount = numericAmount - (currentPerson.owesMe || 0)
    } else if (movementType === 'je_lui_ai_verse' && numericAmount > (currentPerson.iOweHim || 0)) {
      surplusAmount = numericAmount - (currentPerson.iOweHim || 0)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPerson || numericAmount <= 0) return

    // If there is a surplus and not yet acknowledged
    if (surplusAmount > 0 && !surplusConfirmed) {
      setSurplusConfirmed(true)
      return
    }

    let defaultLabel = 'Versement'
    if (movementType === 'il_m_a_verse') defaultLabel = 'Versement reçu de sa part'
    else if (movementType === 'je_lui_ai_verse') defaultLabel = 'Versement effectué à son profit'
    else if (movementType === 'il_a_pris_credit') defaultLabel = 'A pris de la marchandise à crédit'
    else if (movementType === 'j_ai_pris_credit') defaultLabel = 'Marchandise prise à crédit'
    else if (movementType === 'avance_salaire') defaultLabel = 'Avance accordée sur salaire'
    else if (movementType === 'remboursement_direct') defaultLabel = 'Remboursement direct de sa poche'

    addMovement({
      personId: currentPerson.id,
      personName: currentPerson.name,
      type: movementType,
      label: defaultLabel,
      amount: numericAmount,
      paymentMethod,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
      receiptPhoto: hasReceiptPhoto ? 'simulation_photo_recu.jpg' : undefined,
    })

    closeNewMovement()
  }

  return (
    <Dialog open={isNewMovementOpen} onOpenChange={openNewMovement => !openNewMovement && closeNewMovement()}>
      <DialogContent className="max-w-lg p-4 sm:p-6 max-h-[95vh] overflow-y-auto rounded-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Coins className="w-6 h-6 text-primary" />
            Enregistrer une opération
          </DialogTitle>
          <DialogDescription className="text-xs">
            Saisie rapide en 3 gestes adaptée au rythme de la boutique
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {!showChoices && currentPerson && (
            <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{currentPerson.name}</p>
                <p className="text-sm text-muted-foreground">{OPERATION_LABELS[movementType] ?? movementType}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowChoices(true)}>
                Modifier
              </Button>
            </div>
          )}
          {showChoices && (
            <>
          {/* Étape 1 : Choix de la Personne */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">1. Concerne qui ?</Label>
            <select
              value={selectedPersonId}
              onChange={e => {
                setSelectedPersonId(e.target.value)
                const p = persons.find(x => x.id === e.target.value)
                if (p?.type === 'employee') {
                  setMovementType('je_lui_ai_verse')
                } else {
                  setMovementType('il_m_a_verse')
                }
              }}
              className="w-full h-11 px-3 rounded-xl border bg-card text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <optgroup label="Partenaires & Clients">
                {persons.filter(p => p.type === 'partner').map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Doit : {formatFCFA(p.owesMe || 0)} | Je dois : {formatFCFA(p.iOweHim || 0)})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Employés du commerce">
                {persons.filter(p => p.type === 'employee' && p.status === 'actif').map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role} · Sal. dû : {formatFCFA(p.currentSalaryDue || 0)})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Étape 2 : Sens du mouvement (Les mots du commerçant) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">2. Quelle est l'opération ?</Label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {currentPerson?.type === 'partner' ? (
                <>
                  <button
                    type="button"
                    onClick={() => { setMovementType('il_m_a_verse'); setSurplusConfirmed(false); }}
                    className={`p-3 rounded-xl border-2 font-bold flex items-center justify-between transition-all ${
                      movementType === 'il_m_a_verse'
                        ? 'border-credit bg-credit/15 text-credit shadow-sm'
                        : 'border-border/60 hover:bg-muted/40 text-foreground'
                    }`}
                  >
                    <span>Il m'a versé</span>
                    <ArrowDownLeft className="w-4 h-4 text-credit" />
                  </button>

                  <button
                    type="button"
                    onClick={() => { setMovementType('il_a_pris_credit'); setSurplusConfirmed(false); }}
                    className={`p-3 rounded-xl border-2 font-bold flex items-center justify-between transition-all ${
                      movementType === 'il_a_pris_credit'
                        ? 'border-credit bg-credit/15 text-credit shadow-sm'
                        : 'border-border/60 hover:bg-muted/40 text-foreground'
                    }`}
                  >
                    <span>Il a pris à crédit</span>
                    <ArrowUpRight className="w-4 h-4 text-credit" />
                  </button>

                  <button
                    type="button"
                    onClick={() => { setMovementType('je_lui_ai_verse'); setSurplusConfirmed(false); }}
                    className={`p-3 rounded-xl border-2 font-bold flex items-center justify-between transition-all ${
                      movementType === 'je_lui_ai_verse'
                        ? 'border-debt bg-debt/15 text-debt shadow-sm'
                        : 'border-border/60 hover:bg-muted/40 text-foreground'
                    }`}
                  >
                    <span>Je lui ai versé</span>
                    <ArrowUpRight className="w-4 h-4 text-debt" />
                  </button>

                  <button
                    type="button"
                    onClick={() => { setMovementType('j_ai_pris_credit'); setSurplusConfirmed(false); }}
                    className={`p-3 rounded-xl border-2 font-bold flex items-center justify-between transition-all ${
                      movementType === 'j_ai_pris_credit'
                        ? 'border-debt bg-debt/15 text-debt shadow-sm'
                        : 'border-border/60 hover:bg-muted/40 text-foreground'
                    }`}
                  >
                    <span>J'ai pris à crédit</span>
                    <ArrowDownLeft className="w-4 h-4 text-debt" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setMovementType('je_lui_ai_verse')}
                    className={`p-3 rounded-xl border-2 font-bold flex items-center justify-between transition-all ${
                      movementType === 'je_lui_ai_verse'
                        ? 'border-debt bg-debt/15 text-debt shadow-sm'
                        : 'border-border/60 hover:bg-muted/40 text-foreground'
                    }`}
                  >
                    <span>Verser salaire</span>
                    <Coins className="w-4 h-4 text-debt" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setMovementType('avance_salaire')}
                    className={`p-3 rounded-xl border-2 font-bold flex items-center justify-between transition-all ${
                      movementType === 'avance_salaire'
                        ? 'border-credit bg-credit/15 text-credit shadow-sm'
                        : 'border-border/60 hover:bg-muted/40 text-foreground'
                    }`}
                  >
                    <span>Donner une avance</span>
                    <HandCoins className="w-4 h-4 text-credit" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setMovementType('remboursement_direct')}
                    className={`col-span-2 p-3 rounded-xl border-2 font-bold flex items-center justify-between transition-all ${
                      movementType === 'remboursement_direct'
                        ? 'border-credit bg-credit/15 text-credit shadow-sm'
                        : 'border-border/60 hover:bg-muted/40 text-foreground'
                    }`}
                  >
                    <span>Il rembourse son avance de sa poche</span>
                    <CheckCircle2 className="w-4 h-4 text-credit" />
                  </button>
                </>
              )}
            </div>
          </div>

            </>
          )}

          {/* Étape 3 : Grand Affichage du Montant & Pavé Numérique Géant */}
          <div className="space-y-2 bg-muted/20 p-3 rounded-2xl border">
            <Label className="text-xs font-semibold block text-center">3. Combien en FCFA ?</Label>
            
            <div className="text-center py-2 bg-card rounded-xl border shadow-inner">
              <span className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                {formatFCFA(numericAmount)}
              </span>
            </div>

            {/* Boutons Rapides */}
            <div className="grid grid-cols-4 gap-1.5 text-xs">
              <Button type="button" variant="outline" size="sm" onClick={() => handleQuickAdd(1000)} className="h-9 font-bold">
                +1 000
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => handleQuickAdd(5000)} className="h-9 font-bold">
                +5 000
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => handleQuickAdd(10000)} className="h-9 font-bold">
                +10 000
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => handleQuickAdd(50000)} className="h-9 font-bold">
                +50 000
              </Button>
            </div>

            {/* Pavé Tactile Géant */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDigit(d)}
                  className="h-12 rounded-xl border bg-card text-xl font-bold flex items-center justify-center hover:bg-muted active:scale-95 text-foreground shadow-sm"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="h-12 rounded-xl border bg-muted/40 text-xs font-bold flex items-center justify-center hover:bg-muted active:scale-95 text-muted-foreground"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="h-12 rounded-xl border bg-card text-xl font-bold flex items-center justify-center hover:bg-muted active:scale-95 text-foreground shadow-sm"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="h-12 rounded-xl border bg-muted/40 text-xs font-bold flex items-center justify-center hover:bg-muted active:scale-95 text-muted-foreground"
              >
                ←
              </button>
            </div>
          </div>

          {/* Alerte Surplus si dépassement de dette */}
          {surplusAmount > 0 && (
            <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Attention : ce versement dépasse le compte dû de {formatFCFA(surplusAmount)}
              </div>
              <p className="text-muted-foreground">
                Le surplus passera automatiquement comme une avance sur les opérations futures.
              </p>
            </div>
          )}

          {/* Moyen de Paiement (Espèces / Mobile Money) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Moyen de paiement (facultatif)</Label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPaymentMethod('especes')}
                className={`p-2.5 rounded-xl border font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  paymentMethod === 'especes' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                Espèces
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('momo_mtn')}
                className={`p-2.5 rounded-xl border font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  paymentMethod === 'momo_mtn' ? 'border-amber-500 bg-amber-500 text-black font-bold' : 'border-border bg-card'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                MTN MoMo
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('airtel_money')}
                className={`p-2.5 rounded-xl border font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  paymentMethod === 'airtel_money' ? 'border-red-600 bg-red-600 text-white font-bold' : 'border-border bg-card'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Airtel Money
              </button>
            </div>

            {paymentMethod !== 'especes' && (
              <Input
                placeholder="N° de transaction ou référence (ex: MTN-99120)..."
                value={reference}
                onChange={e => setReference(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            )}
          </div>

          {/* Note & Pièce Jointe facultatives */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <Input
              placeholder="Note facultative (ex: 2 sacs de riz)..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className="h-10 text-xs rounded-xl"
            />
            <Button
              type="button"
              variant={hasReceiptPhoto ? 'secondary' : 'outline'}
              onClick={() => setHasReceiptPhoto(!hasReceiptPhoto)}
              className="h-10 text-xs gap-1.5 rounded-xl"
            >
              <Camera className="w-3.5 h-3.5" />
              {hasReceiptPhoto ? '✓ Photo du reçu jointe' : '+ Joindre photo reçu'}
            </Button>
          </div>

          {/* Bouton de validation géant */}
          <Button
            type="submit"
            disabled={numericAmount <= 0}
            className="w-full h-14 text-base font-extrabold rounded-xl shadow-md active:scale-[0.99] transition-all"
          >
            {surplusAmount > 0 && !surplusConfirmed
              ? 'Confirmer le surplus et enregistrer'
              : "Enregistrer l'opération"}
          </Button>

        </form>
      </DialogContent>
    </Dialog>
  )
}
