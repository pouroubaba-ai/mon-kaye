import React from 'react'
import { Coins, HandCoins, Plus, Scale, UserMinus } from 'lucide-react'

import { useStore } from '@/data/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MovementHistory } from '@/components/movement-history'
import { PersonHeader } from '@/components/person-header'
import { BalanceCard } from '@/components/balance-card'
import { formatFCFA } from '@/lib/utils'

// Fiche employé : même présentation que la fiche d'une personne.
// - bandeau quand il y a à la fois un salaire dû et une avance : ce qui reste à payer, avance déduite ;
// - « Je lui dois » : le salaire du mois (déjà versé / reste) ;
// - « Avance à rendre » : l'avance (déjà remboursé / reste), avec la retenue prévue ;
// - un seul bouton pour enregistrer une opération ; le départ reste une action discrète en bas.

export const EmployeeDetailScreen: React.FC<{ employeeId: string }> = ({ employeeId }) => {
  const { persons, movements, openNewMovement, openDeparture, openMovementDetail } = useStore()

  const emp = persons.find(p => p.id === employeeId)
  if (!emp) return null

  const salary = emp.salary || 0
  const salaryDue = emp.currentSalaryDue || 0
  const advance = emp.advanceBalance || 0
  const active = emp.status === 'actif'
  const empMovements = movements.filter(m => m.personId === employeeId)
  const sumOf = (...types: string[]) =>
    empMovements.filter(m => types.includes(m.type) && !m.isCancelled).reduce((a, m) => a + m.amount, 0)

  // Salaire du mois : ce qui a déjà été versé sur le salaire en cours.
  const salaryPaid = Math.max(0, salary - salaryDue)
  // Avance : ce qui a déjà été remboursé (de sa poche ou par retenue).
  const advanceRepaid = sumOf('remboursement_direct', 'retenue_salaire')
  const net = salaryDue - advance

  return (
    <div className="flex flex-col gap-4">
      <PersonHeader person={emp} badge={<Badge variant={active ? 'outline' : 'secondary'}>{active ? 'Actif' : 'Parti'}</Badge>} />

      {salaryDue > 0 && advance > 0 && (
        <div
          className="flex items-center gap-3 rounded-xl border p-3"
          style={{
            background: `color-mix(in srgb, ${net >= 0 ? 'var(--color-debt)' : 'var(--color-credit)'} 12%, var(--card))`,
            borderColor: `color-mix(in srgb, ${net >= 0 ? 'var(--color-debt)' : 'var(--color-credit)'} 35%, transparent)`,
          }}
        >
          <Scale className={net >= 0 ? 'size-5 shrink-0 text-debt' : 'size-5 shrink-0 text-credit'} />
          <p className="min-w-0 flex-1 text-sm">
            {net > 0 && <>Avance déduite, <span className="font-semibold text-debt">vous lui devez {formatFCFA(net)}</span></>}
            {net < 0 && <>Salaire déduit, <span className="font-semibold text-credit">il vous doit {formatFCFA(-net)}</span></>}
            {net === 0 && <span className="font-semibold">Salaire et avance s'annulent</span>}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BalanceCard
          title="Je lui dois"
          Icon={Coins}
          tone="debt"
          remaining={salaryDue}
          paid={salaryPaid}
        />
        <BalanceCard
          title="Avance à rendre"
          Icon={HandCoins}
          tone="credit"
          remaining={advance}
          paid={advanceRepaid}
          note={
            emp.advanceDeductionPerPeriod && emp.advanceDeductionPerPeriod > 0
              ? `Retenue de ${formatFCFA(emp.advanceDeductionPerPeriod)} à chaque paie`
              : undefined
          }
        />
      </div>

      {active && (
        <Button size="lg" className="h-12" onClick={() => openNewMovement(emp.id)}>
          <Plus /> Enregistrer une opération
        </Button>
      )}

      <MovementHistory movements={empMovements} onOpen={openMovementDetail} />

      {active && (
        <Button variant="ghost" className="self-start text-destructive" onClick={() => openDeparture(emp.id)}>
          <UserMinus /> L'employé quitte la boutique
        </Button>
      )}
    </div>
  )
}
