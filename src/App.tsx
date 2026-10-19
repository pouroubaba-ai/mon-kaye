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
import { slideIn } from '@/lib/utils'
import { SplashScreen } from '@/components/splash-screen'
import { EmployeesMonthScreen } from '@/components/screens/EmployeesMonthScreen'

const AppContent: React.FC = () => {
  const { isLocked, activeTab, selectedPersonId, persons, accountsView, modules } = useStore()

  // Sens du glissement entre le tableau de bord et « Leurs/Mes comptes » (rien au premier affichage)
  const wasOpen = React.useRef(!!accountsView)
  const [slide, setSlide] = React.useState('')
  React.useLayoutEffect(() => {
    const open = !!accountsView
    if (open !== wasOpen.current) {
      setSlide(
        open
          ? 'animate-in slide-in-from-right fade-in-50 duration-300 ease-out motion-reduce:animate-none'
          : 'animate-in slide-in-from-left fade-in-50 duration-300 ease-out motion-reduce:animate-none'
      )
      wasOpen.current = open
    }
  }, [accountsView])

  // Ouvrir / fermer une fiche : la fiche glisse depuis la droite, la page revient depuis la gauche.
  // Pas de glissement quand on change de page par le menu.
  const pageRef = React.useRef<HTMLDivElement>(null)
  const ficheRef = React.useRef<HTMLDivElement>(null)
  const prev = React.useRef({ person: selectedPersonId, tab: activeTab })
  React.useLayoutEffect(() => {
    const p = prev.current
    prev.current = { person: selectedPersonId, tab: activeTab }
    if (p.person === selectedPersonId || p.tab !== activeTab) return
    if (selectedPersonId) slideIn(ficheRef.current, 'forward')
    else slideIn(pageRef.current, 'back')
  }, [selectedPersonId, activeTab])

  // Si verrouillé -> Écran PIN obligatoire
  if (isLocked) {
    return <AuthPinScreen />
  }

  // Fiche ouverte par-dessus la page : la page reste montée (cachée), pour retrouver au retour
  // sa recherche, ses filtres et sa position.
  const person = selectedPersonId ? persons.find(p => p.id === selectedPersonId) : undefined

  return (
    <AppLayout>
      <div className="overflow-x-clip">
      <div ref={pageRef} hidden={!!person}>
        {activeTab === 'accueil' && (
          // Tableau de bord ⇄ Leurs/Mes comptes : l'écran glisse (aller : depuis la droite, retour : depuis la gauche).
          // Changer d'onglet dans l'écran ne glisse pas (même clé).
          <div key={accountsView ? `acc-${accountsView.dir}` : 'dash'} className={slide}>
            {accountsView ? <AccountsScreen /> : <DashboardScreen />}
          </div>
        )}
        {activeTab === 'personnes' && modules.personnes && <PersonsListScreen />}
        {activeTab === 'employes' && modules.employes && <PersonsListScreen />}
        {activeTab === 'salaires' && modules.employes && <EmployeesMonthScreen />}
        {activeTab === 'reglages' && <SettingsScreen />}
      </div>
      {person && (
        <div ref={ficheRef}>
          {person.type === 'employee' ? <EmployeeDetailScreen key={person.id} employeeId={person.id} /> : <PartnerDetailScreen key={person.id} partnerId={person.id} />}
        </div>
      )}
      </div>

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
