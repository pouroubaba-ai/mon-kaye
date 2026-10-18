import React from 'react'

import { useStore } from '@/data/store'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PartnersOverview } from '@/components/screens/PartnersOverview'
import { EmployeesOverview } from '@/components/screens/EmployeesOverview'

// « Leurs comptes » (ce qu'on me doit) ou « Mes comptes » (ce que je dois), ouvert en touchant
// le total sur le tableau de bord. D'abord le sens de l'argent, ensuite seulement
// Personnes / Employés, comme un simple choix en haut.
export const AccountsScreen: React.FC = () => {
  const { accountsView, setAccountsView } = useStore()
  if (!accountsView) return null
  const { dir, group } = accountsView

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={group} onValueChange={g => setAccountsView({ dir, group: g as 'partner' | 'employee' })}>
        <TabsList className="w-full">
          <TabsTrigger value="partner">Personnes</TabsTrigger>
          <TabsTrigger value="employee">Employés</TabsTrigger>
        </TabsList>
      </Tabs>
      {group === 'partner' ? <PartnersOverview key={dir} side={dir} /> : <EmployeesOverview key={dir} side={dir} />}
    </div>
  )
}
