import React, { useState } from 'react'
import { useStore } from '@/data/store'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatFCFA } from '@/lib/utils'
import { UserMinus, AlertTriangle, ShieldCheck, Check } from 'lucide-react'

export const DepartureModal: React.FC = () => {
  const { isDepartureOpen, closeDeparture, departureTargetEmployeeId, persons, processDeparture } = useStore()
  const emp = persons.find(p => p.id === departureTargetEmployeeId)

  // Options
  const [salaryChoice, setSalaryChoice] = useState<'mois_complet' | 'prorata' | 'fixe'>('prorata')
  const [prorataDays, setProrataDays] = useState('18')
  const [customFixedSalary, setCustomFixedSalary] = useState('50000')
  const [advanceChoice, setAdvanceChoice] = useState<'retenir' | 'dette' | 'abandonner'>('retenir')
  const [abandonNote, setAbandonNote] = useState('')

  // À chaque ouverture, on repart des choix par défaut.
  React.useEffect(() => {
    if (!isDepartureOpen) return
    setSalaryChoice('prorata')
    setProrataDays('18')
    setCustomFixedSalary('50000')
    setAdvanceChoice('retenir')
    setAbandonNote('')
  }, [isDepartureOpen])
  const dirty =
    salaryChoice !== 'prorata' ||
    prorataDays !== '18' ||
    customFixedSalary !== '50000' ||
    advanceChoice !== 'retenir' ||
    abandonNote.trim() !== ''

  if (!emp) return null

  const salary = emp.salary || 0
  const advance = emp.advanceBalance || 0

  // Calculate settlement salary
  let calculatedSalary = salary
  if (salaryChoice === 'prorata') {
    const days = parseInt(prorataDays, 10) || 0
    calculatedSalary = Math.round((days / 30) * salary)
  } else if (salaryChoice === 'fixe') {
    calculatedSalary = parseInt(customFixedSalary, 10) || 0
  }

  // Net amount to pay after advance treatment
  let finalNetToPay = calculatedSalary
  if (advanceChoice === 'retenir') {
    finalNetToPay = Math.max(0, calculatedSalary - advance)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    processDeparture(
      emp.id,
      salaryChoice,
      calculatedSalary,
      advanceChoice,
      abandonNote
    )
  }

  return (
    <Dialog open={isDepartureOpen} onOpenChange={open => !open && closeDeparture()} dirty={dirty} dirtyKind="modification">
      <DialogContent className="max-w-lg p-4 sm:p-6 max-h-[95vh] overflow-y-auto rounded-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-destructive">
            <UserMinus className="w-6 h-6" />
            Assistant de départ : {emp.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Règlement des comptes de clôture. Aucun nouveau salaire ne sera créé après ce départ.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* ÉTAPE 1 : COMMENT SOLDER LA PÉRIODE EN COURS */}
          <div className="space-y-2 p-3 rounded-xl border bg-card">
            <span className="text-xs font-bold text-foreground block uppercase">
              1. Salaire de la période en cours
            </span>
            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer hover:bg-muted/30">
                <input
                  type="radio"
                  name="salaryOption"
                  checked={salaryChoice === 'mois_complet'}
                  onChange={() => setSalaryChoice('mois_complet')}
                />
                <div className="flex-1 flex justify-between">
                  <span>Mois complet normal</span>
                  <span className="font-bold">{formatFCFA(salary)}</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer hover:bg-muted/30">
                <input
                  type="radio"
                  name="salaryOption"
                  checked={salaryChoice === 'prorata'}
                  onChange={() => setSalaryChoice('prorata')}
                />
                <div className="flex-1 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="font-semibold">Au prorata des jours travaillés (Recommandé)</span>
                    <span className="font-bold text-primary">{formatFCFA(calculatedSalary)}</span>
                  </div>
                  {salaryChoice === 'prorata' && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] text-muted-foreground">Jours travaillés sur 30 :</span>
                      <Input
                        type="number"
                        min="1"
                        max="30"
                        value={prorataDays}
                        onChange={e => setProrataDays(e.target.value)}
                        className="w-16 h-8 text-xs text-center"
                      />
                    </div>
                  )}
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer hover:bg-muted/30">
                <input
                  type="radio"
                  name="salaryOption"
                  checked={salaryChoice === 'fixe'}
                  onChange={() => setSalaryChoice('fixe')}
                />
                <div className="flex-1 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Montant fixe convenu</span>
                    <span className="font-bold">{formatFCFA(calculatedSalary)}</span>
                  </div>
                  {salaryChoice === 'fixe' && (
                    <Input
                      type="number"
                      value={customFixedSalary}
                      onChange={e => setCustomFixedSalary(e.target.value)}
                      className="h-8 text-xs"
                      placeholder="Montant convenu en FCFA"
                    />
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* ÉTAPE 2 : TRAITEMENT DE L'AVANCE RESTANTE */}
          <div className="space-y-2 p-3 rounded-xl border bg-card">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-foreground uppercase block">
                2. Avance restante non remboursée
              </span>
              <Badge variant="outline" className="text-xs text-credit border-credit/30">
                {formatFCFA(advance)}
              </Badge>
            </div>

            {advance > 0 ? (
              <div className="space-y-2 text-xs">
                {/* Choix 1 (Recommandé par défaut) */}
                <label className="flex items-center gap-2.5 p-2.5 rounded-lg border-2 border-primary/30 bg-primary/5 cursor-pointer">
                  <input
                    type="radio"
                    name="advanceOption"
                    checked={advanceChoice === 'retenir'}
                    onChange={() => setAdvanceChoice('retenir')}
                  />
                  <div className="flex-1">
                    <span className="font-bold text-foreground block">
                      Retenir sur le montant final (Choix par défaut recommandé)
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      Déduit automatiquement {formatFCFA(advance)} du solde à lui verser.
                    </span>
                  </div>
                </label>

                {/* Choix 2 */}
                <label className="flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer hover:bg-muted/30">
                  <input
                    type="radio"
                    name="advanceOption"
                    checked={advanceChoice === 'dette'}
                    onChange={() => setAdvanceChoice('dette')}
                  />
                  <div className="flex-1">
                    <span className="font-bold text-foreground block">
                      Garder comme dette de l'employé
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      Il continuera à vous devoir {formatFCFA(advance)} hors du cadre du salaire.
                    </span>
                  </div>
                </label>

                {/* Choix 3 */}
                <label className="flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer hover:bg-muted/30">
                  <input
                    type="radio"
                    name="advanceOption"
                    checked={advanceChoice === 'abandonner'}
                    onChange={() => setAdvanceChoice('abandonner')}
                  />
                  <div className="flex-1 space-y-1">
                    <span className="font-bold text-foreground block">
                      Abandonner l'avance restante
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      Cadeau ou accord amiable. Note explicative obligatoire.
                    </span>
                    {advanceChoice === 'abandonner' && (
                      <Input
                        required
                        placeholder="Motif d'abandon obligatoire..."
                        value={abandonNote}
                        onChange={e => setAbandonNote(e.target.value)}
                        className="h-8 text-xs mt-1"
                      />
                    )}
                  </div>
                </label>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 py-1">
                <Check className="w-4 h-4 text-credit" />
                Cet employé n'a aucune avance en cours.
              </p>
            )}
          </div>

          {/* RÉCAPITULATIF FINAL */}
          <div className="p-3.5 rounded-xl border bg-muted/30 space-y-2 text-xs">
            <span className="font-bold text-foreground block text-sm">
              Récapitulatif du versement de solde :
            </span>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Salaire calculé :</span>
              <span className="font-semibold">{formatFCFA(calculatedSalary)}</span>
            </div>
            {advanceChoice === 'retenir' && advance > 0 && (
              <div className="flex justify-between text-credit font-semibold">
                <span>Retenue avance :</span>
                <span>- {formatFCFA(advance)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t text-sm font-black text-foreground">
              <span>Net à lui verser maintenant :</span>
              <span className="text-base text-debt">{formatFCFA(finalNetToPay)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeDeparture}
              className="flex-1 h-12 text-xs"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              className="flex-1 h-12 text-sm font-bold bg-destructive text-white hover:bg-destructive/90"
            >
              Valider le départ définitif
            </Button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  )
}
