import React from 'react'

import { useStore } from '@/data/store'
import { daysSince } from '@/data/payHistory'
import { DaysCard, PersonPicker, type DayRow } from '@/components/overview-parts'

// Comptes des personnes, ouverts depuis le tableau de bord : un seul sens à la fois
// (side = « leurs » : ce qu'on me doit ; « mes » : ce que je dois).
// Vue d'ensemble des personnes (clients, fournisseurs…) : même système que pour les employés,
// sans graphique.
// - « Dernier versement reçu » : les gens qui me doivent, jours depuis leur dernier versement.
// - « Dernier versement fait » : les gens à qui je dois, jours depuis mon dernier versement.

const PEOPLE: [string, string] = ['personne', 'personnes']

export const PartnersOverview: React.FC<{ side: 'leurs' | 'mes' }> = ({ side }) => {
  const { persons } = useStore()
  const partners = persons.filter(p => p.type === 'partner')
  const [who, setWho] = React.useState('tous')
  const selected = who === 'tous' ? partners : partners.filter(p => p.id === who)
  const showCount = who === 'tous'

  const owesMeRows: DayRow[] = selected
    .filter(p => (p.owesMe || 0) > 0)
    .map(p => ({ id: p.id, name: p.name, days: daysSince(p.lastPaymentDate) ?? 0, amount: p.owesMe || 0, role: p.role }))

  const iOweRows: DayRow[] = selected
    .filter(p => (p.iOweHim || 0) > 0)
    .map(p => ({ id: p.id, name: p.name, days: daysSince(p.lastPaidByMeDate) ?? 0, amount: p.iOweHim || 0, role: p.role }))

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
        amountLabel="Son compte"
        totalLabel="Total"
        showCount={showCount}
        unit={PEOPLE}
        empty="Personne ne vous doit d'argent."
      />}
      {side === 'mes' && <DaysCard
        title="Mes comptes"
        rows={iOweRows}
        tone="debt"
        amountLabel="Mon compte"
        totalLabel="Total"
        showCount={showCount}
        unit={PEOPLE}
        empty="Vous ne devez rien à personne."
      />}
    </div>
  )
}
