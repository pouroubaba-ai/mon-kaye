import React from 'react'

import { useStore } from '@/data/store'
import { daysSince } from '@/data/payHistory'
import { payrollOf } from '@/data/payroll'
import { DaysCard, PersonPicker, type DayRow } from '@/components/overview-parts'

// Vue d'ensemble des employés (depuis « Leurs comptes » / « Mes comptes »).
// En haut : choix d'un employé (liste avec recherche) ; « Tous les employés » par défaut.
// side = « leurs » : avances à rendre ; « mes » : salaires dus (échéances passées).
// Chaque carte : jours depuis le dernier versement + montant encore dû.
export const EmployeesOverview: React.FC<{ side: 'leurs' | 'mes' }> = ({ side }) => {
  const { persons, movements, monthStates } = useStore()
  const employees = persons.filter(p => p.type === 'employee')
  const [who, setWho] = React.useState('tous')
  const selected = who === 'tous' ? employees : employees.filter(e => e.id === who)

  const advanceRows: DayRow[] = selected
    .filter(p => (p.advanceBalance || 0) > 0)
    .map(p => ({ id: p.id, name: p.name, days: daysSince(p.lastAdvanceRepaymentDate) ?? -1, amount: p.advanceBalance || 0, role: p.role,
      paid: payrollOf(p.id, movements, monthStates).advances.filter(a => a.etat === 'En cours').reduce((a, r) => a + r.rendu, 0) }))
    .sort((a, b) => b.days - a.days)

  const salaryRows: DayRow[] = selected
    .filter(p => p.status === 'actif' && (p.currentSalaryDue || 0) > 0)
    .map(p => ({ id: p.id, name: p.name, days: daysSince(p.lastSalaryPaymentDate) ?? -1, amount: p.currentSalaryDue || 0, role: p.role,
      paid: payrollOf(p.id, movements, monthStates).months.filter(m => m.reste > 0 && m.state !== 'en_cours').reduce((a, m) => a + m.verse, 0) }))
    .sort((a, b) => b.days - a.days)

  return (
    <div className="flex flex-col gap-4">
      <PersonPicker people={employees} value={who} onChange={setWho} allLabel="Tous les employés" searchPlaceholder="Nom ou numéro" emptyText="Aucun employé trouvé." />

      {side === 'leurs' && <DaysCard
        title="Avances à rendre"
        totalLabel="On me doit"
        showCount={who === 'tous'}
        rows={advanceRows}
        tone="credit"
        amountLabel="Avance à rendre"
        empty="Aucune avance en cours."
      />}
      {side === 'mes' && <DaysCard
        title="Salaires dus"
        totalLabel="Je dois"
        showCount={who === 'tous'}
        rows={salaryRows}
        tone="debt"
        amountLabel="Salaire que je dois"
        empty="Aucun salaire en retard."
      />}
    </div>
  )
}
