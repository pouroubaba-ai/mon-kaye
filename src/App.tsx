import React from 'react'
import { StoreProvider, useStore } from '@/data/store'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthPinScreen } from '@/components/screens/AuthPinScreen'
import { DashboardScreen } from '@/components/screens/DashboardScreen'
import { PersonsListScreen } from '@/components/screens/PersonsListScreen'
import { PartnerDetailScreen } from '@/components/screens/PartnerDetailScreen'
import { EmployeeDetailScreen } from '@/components/screens/EmployeeDetailScreen'
import { SettingsScreen } from '@/components/screens/SettingsScreen'
import { NewMovementModal } from '@/components/modals/NewMovementModal'
import { DepartureModal } from '@/components/modals/DepartureModal'
import { CompensationModal } from '@/components/modals/CompensationModal'
import { MovementDetailModal } from '@/components/modals/MovementDetailModal'

const AppContent: React.FC = () => {
  const { isLocked, activeTab, selectedPersonId, persons } = useStore()

  // Si verrouillé -> Écran PIN obligatoire
  if (isLocked) {
    return <AuthPinScreen />
  }

  // Navigation vers la fiche détaillée si une personne est sélectionnée
  if (selectedPersonId) {
    const person = persons.find(p => p.id === selectedPersonId)
    if (person?.type === 'employee') {
      return (
        <AppLayout>
          <EmployeeDetailScreen employeeId={selectedPersonId} />
          <NewMovementModal />
          <DepartureModal />
          <MovementDetailModal />
        </AppLayout>
      )
    } else if (person) {
      return (
        <AppLayout>
          <PartnerDetailScreen partnerId={selectedPersonId} />
          <NewMovementModal />
          <CompensationModal />
          <MovementDetailModal />
        </AppLayout>
      )
    }
  }

  return (
    <AppLayout>
      {activeTab === 'accueil' && <DashboardScreen />}
      {activeTab === 'personnes' && <PersonsListScreen />}
      {activeTab === 'employes' && <PersonsListScreen />}
      {activeTab === 'reglages' && <SettingsScreen />}

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
    </StoreProvider>
  )
}

export default App
