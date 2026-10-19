import React from 'react'
import { StoreProvider, useStore } from '@/data/store'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthPinScreen } from '@/components/screens/AuthPinScreen'
import { DashboardScreen } from '@/components/screens/DashboardScreen'
import { PersonsListScreen } from '@/components/screens/PersonsListScreen'
import { PartnerDetailScreen } from '@/components/screens/PartnerDetailScreen'
import { EmployeeDetailScreen } from '@/components/screens/EmployeeDetailScreen'
import { SettingsScreen } from '@/components/screens/SettingsScreen'
import { AccountsScreen } from '@/components/screens/AccountsScreen'
import { NewMovementModal } from '@/components/modals/NewMovementModal'
import { DepartureModal } from '@/components/modals/DepartureModal'
import { CompensationModal } from '@/components/modals/CompensationModal'
import { MovementDetailModal } from '@/components/modals/MovementDetailModal'
import { SplashScreen } from '@/components/splash-screen'

const AppContent: React.FC = () => {
  const { isLocked, activeTab, selectedPersonId, persons, accountsView } = useStore()

  // Si verrouillé -> Écran PIN obligatoire
  if (isLocked) {
    return <AuthPinScreen />
  }

  // Fiche ouverte par-dessus la page : la page reste montée (cachée), pour retrouver au retour
  // sa recherche, ses filtres et sa position.
  const person = selectedPersonId ? persons.find(p => p.id === selectedPersonId) : undefined

  return (
    <AppLayout>
      <div hidden={!!person}>
        {activeTab === 'accueil' && (accountsView ? <AccountsScreen /> : <DashboardScreen />)}
        {activeTab === 'personnes' && <PersonsListScreen />}
        {activeTab === 'employes' && <PersonsListScreen />}
        {activeTab === 'reglages' && <SettingsScreen />}
      </div>
      {person?.type === 'employee' && <EmployeeDetailScreen key={person.id} employeeId={person.id} />}
      {person && person.type !== 'employee' && <PartnerDetailScreen key={person.id} partnerId={person.id} />}

      {/* Modales globales interactives */}
      <NewMovementModal />
      <DepartureModal />
      <CompensationModal />
      <MovementDetailModal />
    </AppLayout>
  )
}

export function App() {
  return (
    <StoreProvider>
      <AppContent />
      <SplashScreen />
    </StoreProvider>
  )
}

export default App
