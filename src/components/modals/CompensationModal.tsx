import React from 'react'
import { useStore } from '@/data/store'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { formatFCFA, useKept } from '@/lib/utils'
import { Scale, ArrowRight, Check } from 'lucide-react'

export const CompensationModal: React.FC = () => {
  const { isCompensationOpen, closeCompensation, compensationTargetPartnerId, persons, applyCompensation } = useStore()
  // Pendant la fermeture, le contenu reste affiché (pas de disparition d'un coup)
  const keptId = useKept(compensationTargetPartnerId)
  const partner = persons.find(p => p.id === keptId)

  if (!partner) return null

  const owesMe = partner.owesMe || 0
  const iOweHim = partner.iOweHim || 0
  const compAmount = Math.min(owesMe, iOweHim)

  const newOwesMe = owesMe - compAmount
  const newIOweHim = iOweHim - compAmount

  return (
    <Dialog open={isCompensationOpen} onOpenChange={open => !open && closeCompensation()}>
      <DialogContent className="max-w-md p-4 sm:p-6 rounded-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Scale className="w-6 h-6 text-primary" />
            Compenser les dettes croisées
          </DialogTitle>
          <DialogDescription className="text-xs">
            Cette opération annule mutuellement les dettes à hauteur du plus petit montant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 bg-muted/20 rounded-xl border space-y-2 text-xs">
            <p className="font-bold text-foreground text-sm">
              Partenaire : {partner.name}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-credit/10 border border-credit/20">
                <span className="text-muted-foreground block text-[11px]">Client actuel :</span>
                <span className="font-bold text-credit text-sm">{formatFCFA(owesMe)}</span>
              </div>
              <div className="p-2 rounded-lg bg-debt/10 border border-debt/20">
                <span className="text-muted-foreground block text-[11px]">Fournisseur actuel :</span>
                <span className="font-bold text-debt text-sm">{formatFCFA(iOweHim)}</span>
              </div>
            </div>
          </div>

          <div className="text-center py-2 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Montant à annuler dans les deux sens :
            </span>
            <div className="text-2xl sm:text-3xl font-black text-primary">
              {formatFCFA(compAmount)}
            </div>
          </div>

          {/* Situation après compensation */}
          <div className="p-3 bg-card rounded-xl border space-y-1.5 text-xs">
            <span className="font-bold text-foreground block">
              Situation après compensation :
            </span>
            <div className="flex justify-between items-center text-credit">
              <span>Nouveau « Client » :</span>
              <span className="font-bold">{formatFCFA(newOwesMe)}</span>
            </div>
            <div className="flex justify-between items-center text-debt">
              <span>Nouveau « Fournisseur » :</span>
              <span className="font-bold">{formatFCFA(newIOweHim)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground pt-1 border-t">
              Deux mouvements liés seront visibles dans l'historique pour justifier l'opération en cas de vérification.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={closeCompensation} className="flex-1 h-12 text-xs">
              Annuler
            </Button>
            <Button
              onClick={() => applyCompensation(partner.id)}
              className="flex-1 h-12 text-sm font-bold gap-1.5"
            >
              <Check className="w-4 h-4" />
              Appliquer la compensation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
