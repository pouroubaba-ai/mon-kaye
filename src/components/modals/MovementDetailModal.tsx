import React, { useState } from 'react'
import { useStore, excessOf, returnedOn, type ExcessChoice } from '@/data/store'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatFCFA } from '@/lib/utils'
import { 
  FileText, 
  Share2, 
  Ban, 
  Copy, 
  MessageCircle, 
  Calendar, 
  Coins, 
  Smartphone, 
  Camera,
  Undo2,
} from 'lucide-react'

export const MovementDetailModal: React.FC = () => {
  const { selectedMovement, closeMovementDetail, cancelMovement, addReturn, shop, persons, movements } = useStore()
  // Panneau ouvert en bas : rien, l'annulation (motif) ou le retour (montant).
  const [panel, setPanel] = useState<'none' | 'annuler' | 'retour'>('none')
  const [cancelReason, setCancelReason] = useState('')
  const [returnStr, setReturnStr] = useState('')
  // Trop versé : la question posée avant d'appliquer l'annulation ou le retour.
  const [excessAsk, setExcessAsk] = useState<{ amount: number; apply: (c: ExcessChoice) => void } | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  // Nouvelle opération affichée : on referme les panneaux en cours.
  React.useEffect(() => {
    setPanel('none')
    setCancelReason('')
    setReturnStr('')
    setExcessAsk(null)
  }, [selectedMovement?.id])

  if (!selectedMovement) return null
  const mov = movements.find(m => m.id === selectedMovement.id) ?? selectedMovement
  const isCredit = mov.type === 'il_a_pris_credit' || mov.type === 'j_ai_pris_credit'
  const side: 'lui' | 'moi' = mov.type === 'il_a_pris_credit' || mov.type === 'il_a_retourne' ? 'lui' : 'moi'
  const returns = isCredit ? movements.filter(m => m.linkedMovementId === mov.id && (m.type === 'il_a_retourne' || m.type === 'j_ai_retourne')) : []
  const returned = isCredit ? returnedOn(movements, mov.id) : 0
  const returnable = isCredit ? mov.amount - returned : 0
  const returnAmount = parseInt(returnStr, 10) || 0

  const person = persons.find(p => p.id === mov.personId)

  // Applique tout de suite, ou pose d'abord la question du trop versé.
  const runOrAsk = (reduce: number, apply: (c?: ExcessChoice) => void) => {
    const excess = person?.type === 'partner' ? excessOf(person, side, reduce) : 0
    if (excess > 0) setExcessAsk({ amount: excess, apply })
    else apply()
  }
  const finish = () => {
    setPanel('none')
    setCancelReason('')
    setReturnStr('')
    setExcessAsk(null)
  }
  const remainingDebt = person?.type === 'partner' ? ((person.owesMe || 0) - (person.iOweHim || 0)) : (person?.currentSalaryDue || 0)

  // Message formaté pour WhatsApp / SMS
  const receiptMessage = `${shop.name}\nReçu de versement du ${selectedMovement.date}\nClient / Employé : ${selectedMovement.personName}\nMontant versé : ${formatFCFA(selectedMovement.amount)}\nMoyen de paiement : ${selectedMovement.paymentMethod === 'mobile_money' ? 'Mobile Money' : 'Espèces'}${selectedMovement.reference ? ` (Réf : ${selectedMovement.reference})` : ''}\nSolde restant dû : ${formatFCFA(Math.max(0, remainingDebt))}\nMerci pour votre confiance !`

  const handleCopyReceipt = () => {
    navigator.clipboard.writeText(receiptMessage)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  const handleWhatsAppShare = () => {
    const encoded = encodeURIComponent(receiptMessage)
    window.open(`https://wa.me/?text=${encoded}`, '_blank')
  }

  const handleConfirmCancel = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cancelReason.trim()) return
    const reason = cancelReason.trim()
    runOrAsk(isCredit ? returnable : 0, c => {
      cancelMovement(mov.id, reason, c)
      finish()
    })
  }

  const handleConfirmReturn = (e: React.FormEvent) => {
    e.preventDefault()
    if (returnAmount <= 0 || returnAmount > returnable) return
    const amount = returnAmount
    runOrAsk(amount, c => {
      addReturn(mov.id, amount, c)
      finish()
    })
  }

  return (
    <Dialog open={!!selectedMovement} onOpenChange={open => !open && closeMovementDetail()} dirty={cancelReason.trim() !== '' || returnAmount > 0} dirtyKind="modification">
      <DialogContent className="max-w-md p-4 sm:p-6 rounded-2xl">
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Détail du mouvement
            </DialogTitle>
            {selectedMovement.isCancelled && (
              <Badge variant="destructive" className="text-xs">
                Annulé
              </Badge>
            )}
          </div>
          <DialogDescription className="text-xs">
            Identifiant sécurisé : {selectedMovement.id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          
          {/* Carte récapitulative du mouvement */}
          <div className={`p-4 rounded-xl border space-y-2 ${
            selectedMovement.isCancelled ? 'bg-destructive/5 border-destructive/30 line-through opacity-75' : 'bg-card'
          }`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-foreground text-sm">{selectedMovement.personName}</p>
                <p className="text-xs text-muted-foreground">{selectedMovement.label}</p>
              </div>
              <span className={`text-xl font-black ${mov.isCancelled ? 'text-destructive line-through' : 'text-foreground'}`}>
                {formatFCFA(mov.amount)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> {selectedMovement.date}
              </div>
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                {selectedMovement.paymentMethod === 'mobile_money' ? 'Mobile Money' : 'Espèces'}
              </div>
            </div>

            {selectedMovement.reference && (
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Réf transaction :</span> {selectedMovement.reference}
              </p>
            )}

            {selectedMovement.note && (
              <p className="text-xs bg-muted/30 p-2 rounded-lg italic">
                "{selectedMovement.note}"
              </p>
            )}

            {selectedMovement.receiptPhoto && (
              <div className="p-2.5 rounded-lg border bg-muted/20 flex items-center gap-2 text-xs text-foreground font-semibold">
                <Camera className="w-4 h-4 text-primary" />
                Photo du reçu / bordereau archivée
              </div>
            )}
          </div>

          {/* Crédit : les retours de marchandise déjà faits dessus */}
          {returns.length > 0 && (
            <div className="space-y-1.5 rounded-xl border p-3 text-xs">
              <p className="font-semibold text-foreground">Retours</p>
              {returns.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span>{r.date}{r.isCancelled ? ' · annulé' : ''}</span>
                  <span className={r.isCancelled ? 'line-through' : 'font-medium text-foreground'}>− {formatFCFA(r.amount)}</span>
                </div>
              ))}
              {!mov.isCancelled && (
                <div className="flex items-center justify-between gap-2 border-t pt-1.5 font-semibold text-foreground">
                  <span>Reste de ce crédit</span>
                  <span>{formatFCFA(returnable)}</span>
                </div>
              )}
            </div>
          )}

          {/* Si annulé : motif */}
          {selectedMovement.isCancelled && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl space-y-1 text-xs">
              <span className="font-bold text-destructive flex items-center gap-1">
                <Ban className="w-4 h-4" /> Motif d'annulation :
              </span>
              <p className="text-foreground">{selectedMovement.cancellationReason}</p>
              <span className="text-[10px] text-muted-foreground block">{selectedMovement.cancelledAt}</span>
            </div>
          )}

          {/* BOUTON ENVOYER UN REÇU (WHATSAPP / SMS) */}
          {!selectedMovement.isCancelled && (
            <div className="space-y-2 pt-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Partager la preuve au client :
              </span>
              
              <div className="p-3 bg-muted/20 border rounded-xl space-y-2 text-xs font-mono text-muted-foreground">
                <p className="whitespace-pre-line text-foreground/80">{receiptMessage}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleWhatsAppShare}
                  className="h-11 text-xs font-bold bg-[#25D366] hover:bg-[#20ba59] text-white flex items-center justify-center gap-1.5 rounded-xl shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  Envoyer WhatsApp
                </Button>

                <Button
                  variant="outline"
                  onClick={handleCopyReceipt}
                  className="h-11 text-xs font-bold flex items-center justify-center gap-1.5 rounded-xl"
                >
                  <Copy className="w-4 h-4" />
                  {copySuccess ? '✓ Copié !' : 'Copier le texte'}
                </Button>
              </div>
            </div>
          )}

          {/* ACTIONS : « Retour » (crédits) à côté de « Annuler ». Jamais de suppression. */}
          {!mov.isCancelled && (
            <div className="pt-2 border-t">
              {excessAsk ? (
                // Trop versé : la différence change de côté, sauf si elle a déjà été rendue.
                <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">
                      {side === 'lui' ? 'Il a trop versé' : "J'ai trop versé"} de {formatFCFA(excessAsk.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {side === 'lui'
                        ? 'Sans cette somme, ses versements dépassent ce qu\'il devait.'
                        : 'Sans cette somme, mes versements dépassent ce que je devais.'}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Button onClick={() => excessAsk.apply('plus_tard')}>
                      {side === 'lui' ? 'Je lui rends plus tard' : 'Il me rend plus tard'}
                    </Button>
                    <Button variant="outline" onClick={() => excessAsk.apply('deja_rendu')}>
                      {side === 'lui' ? 'Je lui ai déjà rendu' : "Il m'a déjà rendu"}
                    </Button>
                    <Button variant="ghost" onClick={finish}>
                      {panel === 'retour' ? 'Ne pas faire le retour' : 'Ne pas annuler'}
                    </Button>
                  </div>
                </div>
              ) : panel === 'retour' ? (
                <form onSubmit={handleConfirmReturn} className="space-y-2 rounded-xl border p-3">
                  <span className="block text-xs font-bold">Montant retourné</span>
                  <Input
                    autoFocus
                    inputMode="numeric"
                    placeholder={`Jusqu'à ${formatFCFA(returnable)}`}
                    value={returnStr ? Number(returnStr).toLocaleString('fr-FR').replace(/\s/g, ' ') : ''}
                    onChange={e => setReturnStr(e.target.value.replace(/\D/g, '').slice(0, 12))}
                    className="h-10"
                  />
                  {returnAmount > returnable && (
                    <p className="text-xs text-destructive">Pas plus de {formatFCFA(returnable)}</p>
                  )}
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={finish} className="flex-1 text-xs">
                      Fermer
                    </Button>
                    <Button type="submit" size="sm" className="flex-1 text-xs font-bold" disabled={returnAmount <= 0 || returnAmount > returnable}>
                      Valider le retour
                    </Button>
                  </div>
                </form>
              ) : panel === 'annuler' ? (
                <form onSubmit={handleConfirmCancel} className="space-y-2 p-3 border border-destructive/30 rounded-xl bg-destructive/5">
                  <span className="text-xs font-bold text-destructive block">
                    Motif obligatoire de l'annulation :
                  </span>
                  <Input
                    required
                    placeholder="Ex: Erreur sur le montant, doublon..."
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    className="h-9 text-xs"
                  />
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={finish} className="flex-1 text-xs">
                      Garder
                    </Button>
                    <Button type="submit" variant="destructive" size="sm" className="flex-1 text-xs font-bold">
                      Confirmer l'annulation
                    </Button>
                  </div>
                </form>
              ) : (
                <div className={isCredit && returnable > 0 ? 'grid grid-cols-2 gap-2' : 'grid'}>
                  {isCredit && returnable > 0 && (
                    <Button variant="outline" onClick={() => setPanel('retour')} className="h-10 text-xs">
                      <Undo2 className="w-4 h-4" /> Retour
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => setPanel('annuler')}
                    className="h-10 text-xs text-destructive hover:bg-destructive/10"
                  >
                    <Ban className="w-4 h-4" /> Annuler
                  </Button>
                </div>
              )}
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  )
}
