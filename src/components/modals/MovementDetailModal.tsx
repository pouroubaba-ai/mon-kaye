import React, { useState } from 'react'
import { useStore } from '@/data/store'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
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
  Camera 
} from 'lucide-react'

export const MovementDetailModal: React.FC = () => {
  const { selectedMovement, closeMovementDetail, cancelMovement, shop, persons } = useStore()
  const [showCancelPrompt, setShowCancelPrompt] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)

  if (!selectedMovement) return null

  const person = persons.find(p => p.id === selectedMovement.personId)
  const remainingDebt = person?.type === 'partner' ? ((person.owesMe || 0) - (person.iOweHim || 0)) : (person?.currentSalaryDue || 0)

  // Message formaté pour WhatsApp / SMS
  const receiptMessage = `${shop.name}\nReçu de versement du ${selectedMovement.date}\nClient / Employé : ${selectedMovement.personName}\nMontant versé : ${formatFCFA(selectedMovement.amount)}\nMoyen de paiement : ${selectedMovement.paymentMethod === 'momo_mtn' ? 'MTN Mobile Money' : selectedMovement.paymentMethod === 'airtel_money' ? 'Airtel Money' : 'Espèces'}${selectedMovement.reference ? ` (Réf : ${selectedMovement.reference})` : ''}\nSolde restant dû : ${formatFCFA(Math.max(0, remainingDebt))}\nMerci pour votre confiance !`

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
    cancelMovement(selectedMovement.id, cancelReason.trim())
    setShowCancelPrompt(false)
    setCancelReason('')
  }

  return (
    <Dialog open={!!selectedMovement} onOpenChange={open => !open && closeMovementDetail()}>
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
              <span className="text-xl font-black text-foreground">
                {formatFCFA(selectedMovement.amount)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> {selectedMovement.date}
              </div>
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                {selectedMovement.paymentMethod === 'momo_mtn' ? 'MTN MoMo' : selectedMovement.paymentMethod === 'airtel_money' ? 'Airtel Money' : 'Espèces'}
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

          {/* ANNULATION DU MOUVEMENT (JAMAIS DE SUPPRESSION) */}
          {!selectedMovement.isCancelled && (
            <div className="pt-2 border-t">
              {!showCancelPrompt ? (
                <Button
                  variant="ghost"
                  onClick={() => setShowCancelPrompt(true)}
                  className="w-full text-xs text-destructive hover:bg-destructive/10 h-10"
                >
                  <Ban className="w-4 h-4 mr-1.5" />
                  Annuler ce mouvement (Erreur de saisie)
                </Button>
              ) : (
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCancelPrompt(false)}
                      className="flex-1 text-xs"
                    >
                      Retour
                    </Button>
                    <Button
                      type="submit"
                      variant="destructive"
                      size="sm"
                      className="flex-1 text-xs font-bold"
                    >
                      Confirmer l'annulation
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  )
}
