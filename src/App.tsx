import React from 'react'
import { StoreProvider, useStore } from '@/data/store'
import { AppLayout } from '@/components/layout/AppLayout'
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
import { AuthScreen, Wordmark, type AuthActions, type AuthMode } from '@/components/screens/AuthScreen'
import { SetupScreen } from '@/components/screens/SetupScreen'
import { Button } from '@/components/ui/button'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, authError, createShop, loadShop, logOut, makePersister, resetPassword, signInApple, signInEmail, signInGoogle, signUpEmail } from '@/lib/firebase'
import type { StoreData } from '@/data/store'
import { SplashScreen } from '@/components/splash-screen'
import { PullToRefresh } from '@/components/pull-to-refresh'
import { EmployeesMonthScreen } from '@/components/screens/EmployeesMonthScreen'

const AppContent: React.FC = () => {
  const { activeTab, selectedPersonId, persons, accountsView, modules } = useStore()

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

// ——— Entrée dans l'app ———
// Pas connecté : écran de connexion (/connexion) ou d'inscription (/inscription).
// Connecté pour la première fois : premier réglage (le nom de l'activité).
// Ensuite : l'app avec SES données (gardées sur le téléphone et en ligne).
// Démonstration sans compte : ajouter ?demo à l'adresse (données d'exemple, rien n'est enregistré).
const authModeOf = (path: string): AuthMode | null => (path === '/connexion' ? 'connexion' : path === '/inscription' ? 'inscription' : null)
const DEMO = new URLSearchParams(window.location.search).has('demo')
const EMPTY_DEMO: StoreData = { shop: { name: 'Ma boutique' }, persons: [], movements: [], monthStates: {} }

type Phase =
  | { k: 'loading' }
  | { k: 'out'; mode: AuthMode }
  | { k: 'setup'; uid: string; name: string }
  | { k: 'ready'; uid: string; data: StoreData; persist: (d: StoreData) => void }
  | { k: 'error' }

function Loading() {
  return (
    <div className="dark flex min-h-dvh items-center justify-center bg-[#0B0C0F]">
      <Wordmark size="text-5xl" />
    </div>
  )
}

export function App() {
  const [phase, setPhase] = React.useState<Phase>({ k: 'loading' })
  const pendingName = React.useRef('')
  const [retry, setRetry] = React.useState(0)

  React.useEffect(() => {
    if (DEMO) return
    return onAuthStateChanged(auth, async user => {
      const path = window.location.pathname
      if (!user) {
        const mode = authModeOf(path) ?? 'connexion'
        if (path !== `/${mode}`) window.history.replaceState(null, '', `/${mode}`)
        setPhase({ k: 'out', mode })
        return
      }
      setPhase({ k: 'loading' })
      try {
        const d = await loadShop(user.uid)
        if (!d) {
          setPhase({ k: 'setup', uid: user.uid, name: pendingName.current || user.displayName || '' })
          return
        }
        if (authModeOf(path)) window.history.replaceState(null, '', '/')
        const data: StoreData = { shop: { name: d.shop.name }, persons: d.persons, movements: d.movements, monthStates: d.monthStates }
        const persist = makePersister(user.uid, d)
        // L'ancien code PIN, s'il existe encore en ligne, est effacé au premier enregistrement
        setPhase({ k: 'ready', uid: user.uid, data, persist: (x: StoreData) => persist({ ...x, shop: { name: x.shop.name, createdAt: d.shop.createdAt } }) })
      } catch (e) {
        console.error('[Kayé] Chargement du compte', e)
        setPhase({ k: 'error' })
      }
    })
  }, [retry])

  // Retour du navigateur entre /connexion et /inscription
  React.useEffect(() => {
    const onPop = () => setPhase(p => (p.k === 'out' ? { k: 'out', mode: authModeOf(window.location.pathname) ?? 'connexion' } : p))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const actions: AuthActions = {
    google: () => signInGoogle(),
    apple: () => signInApple(),
    email: (mode, email, pwd, shop) => {
      pendingName.current = shop
      return mode === 'inscription' ? signUpEmail(email, pwd) : signInEmail(email, pwd)
    },
    reset: email => resetPassword(email),
    error: authError,
  }

  let body: React.ReactNode
  if (DEMO) {
    body = (
      // ?demo=vide : un compte neuf, sans aucune donnée (pour essayer comme un nouveau commerçant)
      <StoreProvider data={new URLSearchParams(window.location.search).get('demo') === 'vide' ? EMPTY_DEMO : undefined}>
        <AppContent />
      </StoreProvider>
    )
  } else if (phase.k === 'loading') {
    body = <Loading />
  } else if (phase.k === 'out') {
    body = (
      <AuthScreen
        mode={phase.mode}
        actions={actions}
        onSwitch={m => {
          window.history.pushState(null, '', `/${m}`)
          setPhase({ k: 'out', mode: m })
        }}
      />
    )
  } else if (phase.k === 'setup') {
    const { uid } = phase
    body = (
      <SetupScreen
        defaultName={phase.name}
        onLogout={() => void logOut()}
        onDone={async name => {
          // Enregistré tout de suite sur le téléphone ; part en ligne dès que possible (on n'attend pas le réseau)
          createShop(uid, name).catch(e => console.error('[Kayé] Création de la boutique', e))
          const empty = { shop: { name }, persons: [], movements: [], monthStates: {} }
          const persist = makePersister(uid, empty)
          window.history.replaceState(null, '', '/')
          setPhase({ k: 'ready', uid, data: empty, persist: (x: StoreData) => persist({ ...x, shop: { ...x.shop } }) })
        }}
      />
    )
  } else if (phase.k === 'error') {
    body = (
      <div className="dark flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
        <Wordmark size="text-4xl" />
        <p className="max-w-xs text-sm text-muted-foreground">Impossible d'ouvrir vos comptes pour l'instant. Vérifiez la connexion internet.</p>
        <Button onClick={() => setRetry(r => r + 1)}>Réessayer</Button>
        <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => void logOut()}>
          Se déconnecter
        </button>
      </div>
    )
  } else {
    body = (
      <StoreProvider key={phase.uid} data={phase.data} persist={phase.persist} onLogout={() => void logOut()}>
        <AppContent />
      </StoreProvider>
    )
  }

  return (
    <>
      {body}
      <SplashScreen />
      <PullToRefresh />
    </>
  )
}

export default App
