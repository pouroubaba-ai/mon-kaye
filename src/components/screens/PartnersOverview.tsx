import React from 'react'

import { useStore } from '@/data/store'
import { daysSince } from '@/data/payHistory'
import { toTime } from '@/data/payroll'
import { DaysCard, PersonPicker, type DayRow } from '@/components/overview-parts'

// Comptes des personnes, ouverts depuis le tableau de bord : un seul sens à la fois
// (side = « leurs » : ce qu'on me doit ; « mes » : ce que je dois).
// Vue d'ensemble des personnes (clients, fournisseurs…) : même système que pour les employés,
// sans graphique.
// - « Dernier versement reçu » : les gens qui me doivent, jours depuis leur dernier versement.
// - « Dernier versement fait » : les gens à qui je dois, jours depuis mon dernier versement.

const PEOPLE: [string, string] = ['personne', 'personnes']

export const PartnersOverview: React.FC<{ side: 'leurs' | 'mes' }> = ({ side }) => {
  const { persons, movements } = useStore()
  // Dernier versement encore valable (un versement annulé ne compte pas)
  // Toujours d'après l'historique : aucun versement → « jamais »
  const lastPay = (p: (typeof persons)[number], type: 'il_m_a_verse' | 'je_lui_ai_verse') =>
    movements
      .filter(m => m.personId === p.id && m.type === type && !m.isCancelled)
      .sort((a, b) => toTime(b.date) - toTime(a.date))[0]?.date
  // Déjà versé sur un compte (versements encore valables)
  const paidOf = (p: (typeof persons)[number], type: 'il_m_a_verse' | 'je_lui_ai_verse') =>
    movements.filter(m => m.personId === p.id && m.type === type && !m.isCancelled).reduce((a, m) => a + m.amount, 0)
  const partners = persons.filter(p => p.type === 'partner')
  const [who, setWho] = React.useState('tous')
  const selected = who === 'tous' ? partners : partners.filter(p => p.id === who)
  const showCount = who === 'tous'

  const owesMeRows: DayRow[] = selected
    .filter(p => (p.owesMe || 0) > 0)
    .map(p => ({ id: p.id, name: p.name, days: daysSince(lastPay(p, 'il_m_a_verse')) ?? -1, amount: p.owesMe || 0, role: p.role, paid: paidOf(p, 'il_m_a_verse') }))

  const iOweRows: DayRow[] = selected
    .filter(p => (p.iOweHim || 0) > 0)
    .map(p => ({ id: p.id, name: p.name, days: daysSince(lastPay(p, 'je_lui_ai_verse')) ?? -1, amount: p.iOweHim || 0, role: p.role, paid: paidOf(p, 'je_lui_ai_verse') }))

  return (
    <div className="flex flex-col gap-4">
      <PersonPicker
        people={partners}
        value={who}
        onChange={setWho}
        allLabel="Toutes les personnes"
        searchPlaceholder="Nom ou numéro"
        emptyText="Aucune personne trouvée."
      />
      {side === 'leurs' && <DaysCard
        title="Leurs comptes"
        rows={owesMeRows}
        tone="credit"
        amountLabel="Client"
        totalLabel="On me doit"
        showCount={showCount}
        unit={PEOPLE}
        empty="Personne ne vous doit d'argent."
      />}
      {side === 'mes' && <DaysCard
        title="Mes comptes"
        rows={iOweRows}
        tone="debt"
        amountLabel="Fournisseur"
        totalLabel="Je dois"
        showCount={showCount}
        unit={PEOPLE}
        empty="Vous ne devez rien à personne."
      />}
    </div>
  )
}
