import React from 'react'
import { ArrowLeft, Coins, HandCoins, Phone, Undo2, UserMinus } from 'lucide-react'

import { useStore } from '@/data/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { MovementHistory } from '@/components/movement-history'
import { formatFCFA } from '@/lib/utils'

// Fiche employé (modèles shadcn : section-cards + Card).
// Chaque compteur porte ses actions ; le départ est une action secondaire, en bas.

export const EmployeeDetailScreen: React.FC<{ employeeId: string }> = ({ employeeId }) => {
  const { persons, movements, setSelectedPersonId, openNewMovement, openDeparture, openMovementDetail } = useStore()

  const emp = persons.find(p => p.id === employeeId)
  if (!emp) return null

  const salaryDue = emp.currentSalaryDue || 0
  const advance = emp.advanceBalance || 0
  const active = emp.status === 'actif'
  const empMovements = movements.filter(m => m.personId === employeeId)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2">
        <Button variant="ghost" size="icon" onClick={() => setSelectedPersonId(null)} aria-label="Retour">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight">{emp.name}</h1>
            <Badge variant={active ? 'outline' : 'secondary'}>{active ? 'Actif' : 'Parti'}</Badge>
          </div>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Phone className="size-3.5" /> {emp.phone}
          </p>
          {emp.role && <p className="truncate text-sm text-muted-foreground">{emp.role}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Coins className="size-4 text-debt" /> Je lui dois
            </CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums text-debt">{formatFCFA(salaryDue)}</CardTitle>
            <CardAction>
              <Badge variant="outline">Le {emp.dueDay} du mois</Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-stretch gap-2">
            <p className="text-sm text-muted-foreground">Salaire : {formatFCFA(emp.salary || 0)} par mois</p>
            {active && (
              <Button onClick={() => openNewMovement(emp.id, 'je_lui_ai_verse')}>
                <Coins /> Verser le salaire
              </Button>
            )}
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <HandCoins className="size-4 text-credit" /> Avance à rendre
            </CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums text-credit">{formatFCFA(advance)}</CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-stretch gap-2">
            <p className="text-sm text-muted-foreground">
              {emp.advanceDeductionPerPeriod && emp.advanceDeductionPerPeriod > 0
                ? `Retenue de ${formatFCFA(emp.advanceDeductionPerPeriod)} à chaque paie`
                : 'Aucune retenue prévue'}
            </p>
            {active && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={() => openNewMovement(emp.id, 'avance_salaire')}>
                  <HandCoins /> Donner une avance
                </Button>
                <Button variant="outline" onClick={() => openNewMovement(emp.id, 'remboursement_direct')}>
                  <Undo2 /> Il rembourse
                </Button>
              </div>
            )}
          </CardFooter>
        </Card>
      </div>

      <MovementHistory movements={empMovements} onOpen={openMovementDetail} />

      {active && (
        <Button variant="ghost" className="self-start text-destructive" onClick={() => openDeparture(emp.id)}>
          <UserMinus /> L'employé quitte la boutique
        </Button>
      )}
    </div>
  )
}
