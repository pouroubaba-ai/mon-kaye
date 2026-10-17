import React from 'react'
import { useStore } from '@/data/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatFCFA } from '@/lib/utils'
import { 
  ArrowLeft, 
  Briefcase, 
  Calendar, 
  Phone, 
  Coins, 
  HandCoins, 
  UserMinus, 
  Clock, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react'

export const EmployeeDetailScreen: React.FC<{ employeeId: string }> = ({ employeeId }) => {
  const { 
    persons, 
    movements, 
    setSelectedPersonId, 
    openNewMovement, 
    openDeparture, 
    openMovementDetail 
  } = useStore()

  const emp = persons.find(p => p.id === employeeId)
  if (!emp) return null

  const salaryDue = emp.currentSalaryDue || 0
  const advance = emp.advanceBalance || 0

  const empMovements = movements.filter(m => m.personId === employeeId)

  return (
    <div className="space-y-6 pb-24 md:pb-8">
      
      {/* Header avec retour */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedPersonId(null)}
          className="rounded-xl h-10 w-10 shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
              {emp.name}
            </h1>
            <Badge variant={emp.status === 'actif' ? 'default' : 'secondary'} className="text-xs shrink-0">
              {emp.status === 'actif' ? 'Actif' : 'Inactif / Parti'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
            <Phone className="w-3.5 h-3.5" /> {emp.phone} · {emp.role}
          </p>
        </div>
      </div>

      {/* FICHE SALAIRE & COMPTEURS DE L'EMPLOYÉ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Carte Salaire Convenu */}
        <Card className="border shadow-sm p-4 space-y-1 bg-card">
          <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
            <Coins className="w-3.5 h-3.5" /> Salaire mensuel
          </span>
          <div className="text-2xl font-extrabold text-foreground">
            {formatFCFA(emp.salary || 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            Échéance le {emp.dueDay} du mois · {emp.frequency}
          </p>
        </Card>

        {/* Compteur Ce que je lui dois (Salaire échu) */}
        <Card className="border shadow-sm p-4 space-y-1 bg-debt/5 border-debt/30">
          <span className="text-xs font-bold text-debt uppercase flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> Ce que je lui dois
          </span>
          <div className="text-2xl font-extrabold text-debt">
            {formatFCFA(salaryDue)}
          </div>
          <p className="text-xs text-muted-foreground">Salaire échu en attente de paiement</p>
        </Card>

        {/* Compteur Avance restante due par l'employé */}
        <Card className="border shadow-sm p-4 space-y-1 bg-credit/5 border-credit/30">
          <span className="text-xs font-bold text-credit uppercase flex items-center gap-1">
            <HandCoins className="w-3.5 h-3.5" /> Avance restante
          </span>
          <div className="text-2xl font-extrabold text-credit">
            {formatFCFA(advance)}
          </div>
          <p className="text-xs text-muted-foreground">
            {emp.advanceDeductionPerPeriod && emp.advanceDeductionPerPeriod > 0
              ? `Retenue prévue : ${formatFCFA(emp.advanceDeductionPerPeriod)} / paie`
              : 'Remboursement direct ou retenue à la paie'}
          </p>
        </Card>

      </div>

      {/* BOUTONS D'ACTION TACTILES EMPLOYÉ (MIN 48PX) */}
      {emp.status === 'actif' && (
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Actions sur la paie de l'employé :
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            
            {/* Verser le salaire */}
            <Button
              onClick={() => openNewMovement(emp.id, 'je_lui_ai_verse')}
              className="h-14 font-bold text-sm bg-debt text-white hover:bg-debt/90 shadow-sm flex items-center justify-center gap-2"
            >
              <Coins className="w-5 h-5" />
              Verser le salaire
            </Button>

            {/* Donner une avance */}
            <Button
              onClick={() => openNewMovement(emp.id, 'avance_salaire')}
              variant="outline"
              className="h-14 font-bold text-sm border-credit text-credit hover:bg-credit/10 shadow-sm flex items-center justify-center gap-2"
            >
              <HandCoins className="w-5 h-5" />
              Donner une avance
            </Button>

            {/* Il rembourse de sa poche */}
            <Button
              onClick={() => openNewMovement(emp.id, 'remboursement_direct')}
              variant="outline"
              className="h-14 font-bold text-sm hover:bg-accent shadow-sm flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5 text-credit" />
              Il rembourse (direct)
            </Button>

            {/* Assistant de départ */}
            <Button
              onClick={() => openDeparture(emp.id)}
              variant="outline"
              className="h-14 font-bold text-sm border-destructive/40 text-destructive hover:bg-destructive/10 shadow-sm flex items-center justify-center gap-2"
            >
              <UserMinus className="w-5 h-5" />
              Assistant de départ
            </Button>

          </div>
        </div>
      )}

      {/* HISTORIQUE DE L'EMPLOYÉ */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Historique des salaires et versements ({empMovements.length})
          </CardTitle>
          <span className="text-xs text-muted-foreground">Cliquez pour détail du reçu</span>
        </CardHeader>
        <CardContent className="space-y-2">
          {empMovements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucun versement enregistré pour l'instant.</p>
          ) : (
            empMovements.map(m => (
              <div
                key={m.id}
                onClick={() => openMovementDetail(m)}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  m.isCancelled ? 'bg-destructive/5 opacity-60 line-through' : 'bg-card hover:bg-muted/40'
                }`}
              >
                <div className="space-y-0.5 min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">{m.date}</span>
                    {m.isCancelled && (
                      <Badge variant="destructive" className="text-[10px] py-0 px-1.5 no-underline">
                        Annulé
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-bold text-foreground truncate">{m.label}</p>
                  {m.note && <p className="text-xs text-muted-foreground truncate">{m.note}</p>}
                </div>
                <div className="text-right shrink-0">
                  <span className="text-base font-extrabold text-foreground">
                    {formatFCFA(m.amount)}
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    {m.paymentMethod === 'airtel_money' ? 'Airtel Money' : m.paymentMethod === 'momo_mtn' ? 'MTN MoMo' : 'Espèces'}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

    </div>
  )
}
