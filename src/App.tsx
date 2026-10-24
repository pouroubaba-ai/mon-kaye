import React from 'react'
import { StoreProvider, useStore } from '@/data/store'
import { AppLayout } from '@/components/layout/AppLayout'
import { StatsScreen } from '@/components/screens/StatsScreen'
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
import { LandingPage } from '@/components/screens/LandingPage'
import { Button } from '@/components/ui/button'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, authError, createShop, loadShop, logOut, makePersister, resetPassword, signInApple, signInEmail, signInGoogle, signUpEmail } from '@/lib/firebase'
import { resetModulesLocal, type StoreData } from '@/data/store'
import { SplashScreen } from '@/components/splash-screen'
import { PullToRefresh } from '@/components/pull-to-refresh'
import { installUnstick } from '@/lib/unstick'
import { HomeScreen } from '@/components/screens/HomeScreen'
import { EmployeesHome } from '@/components/screens/EmployeesHome'

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
        {accountsView ? (
          // Ouvert depuis les statistiques : « On me doit » / « Je dois » en détail
          <div key={`acc-${accountsView.dir}`} className={slide}>
            <AccountsScreen />
          </div>
        ) : (
          <>
            {(activeTab === 'accueil' || activeTab === 'personnes') && (modules.personnes ? <HomeScreen /> : <EmployeesHome />)}
            {activeTab === 'stats' && <StatsScreen />}
                        {(activeTab === 'salaires' || activeTab === 'employes') && modules.employes && <EmployeesHome />}
          </>
        )}
        {!accountsView && activeTab === 'reglages' && <SettingsScreen />}
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
// La page d'accueil publique : sur « / », dans le navigateur (jamais dans l'app installée)
const showsLanding = (path: string) => path === '/' && !window.matchMedia?.('(display-mode: standalone)').matches
const EMPTY_DEMO: StoreData = { shop: { name: 'Ma boutique' }, persons: [], movements: [], monthStates: {} }

type Phase =
  | { k: 'loading' }
  | { k: 'out'; mode: AuthMode }
  | { k: 'landing' } // page d'accueil publique (visiteur pas connecté sur « / »)
  | { k: 'setup'; uid: string; name: string }
  | { k: 'ready'; uid: string; v?: number; data: StoreData; persist: (d: StoreData) => void }
  | { k: 'error' }

// Pendant le chargement (très court) : un fond uni de la couleur du thème choisi, pas d'écran noir
function Loading() {
  let light = false
  try {
    const t = localStorage.getItem('kaye.theme')
    light = t ? t === 'light' : !!window.matchMedia?.('(prefers-color-scheme: light)').matches
  } catch {
    /* thème par défaut : sombre */
  }
  return <div className="min-h-dvh" style={{ background: light ? '#ffffff' : '#0B0C0F' }} />
}

export function App() {
  const [phase, setPhase] = React.useState<Phase>({ k: 'loading' })
  const pendingName = React.useRef('')
  const [retry, setRetry] = React.useState(0)

  // L'écran ne reste jamais bloqué après la fermeture d'une fenêtre
  React.useEffect(() => installUnstick(), [])

  React.useEffect(() => {
    if (DEMO) return
    return onAuthStateChanged(auth, async user => {
      const path = window.location.pathname
      if (!user) {
        if (showsLanding(path)) return setPhase({ k: 'landing' })
        const mode = authModeOf(path) ?? 'connexion'
        if (path !== `/${mode}`) window.history.replaceState(null, '', `/${mode}`)
        setPhase({ k: 'out', mode })
        return
      }
      setPhase({ k: 'loading' })
      // Ouvre l'app avec un compte chargé
      const open = (d: Awaited<ReturnType<typeof loadShop>> & object, v: number) => {
        const data: StoreData = { shop: { name: d.shop.name, modules: d.shop.modules }, persons: d.persons, movements: d.movements, monthStates: d.monthStates }
        const p = makePersister(user.uid, d)
        // L'ancien code PIN, s'il existe encore en ligne, est effacé au premier enregistrement
        const persist = Object.assign((x: StoreData) => p({ ...x, shop: { name: x.shop.name, createdAt: d.shop.createdAt, modules: x.shop.modules } }), { touched: p.touched })
        setPhase({ k: 'ready', uid: user.uid, v, data, persist })
        return persist
      }
      try {
        // 1. Tout de suite : les comptes gardés sur le téléphone (pas d'attente du réseau)
        const local = await loadShop(user.uid, 'cache').catch(() => null)
        if (local) {
          if (authModeOf(path)) window.history.replaceState(null, '', '/')
          const persist = open(local, 0)
          // 2. Ensuite, sans bloquer : la version en ligne (changements faits sur un autre téléphone).
          //    Si elle est différente et que rien n'a été changé ici entre-temps, elle remplace l'affichage.
          loadShop(user.uid, 'server')
            .then(online => {
              if (!online || persist.touched()) return
              const same = (x: typeof local) => JSON.stringify([x.shop.name, x.shop.modules, x.persons, x.movements, x.monthStates])
              if (same(online) !== same(local)) open(online, 1)
            })
            .catch(() => {})
          return
        }
        // Rien sur le téléphone (première connexion) : on attend la version en ligne
        const d = await loadShop(user.uid)
        if (!d) {
          setPhase({ k: 'setup', uid: user.uid, name: pendingName.current || user.displayName || '' })
          return
        }
        if (authModeOf(path)) window.history.replaceState(null, '', '/')
        open(d, 0)
      } catch (e) {
        console.error('[Kayé] Chargement du compte', e)
        setPhase({ k: 'error' })
      }
    })
  }, [retry])

  // Retour du navigateur entre /connexion et /inscription
  React.useEffect(() => {
    const onPop = () =>
      setPhase(p =>
        p.k === 'out' || p.k === 'landing'
          ? showsLanding(window.location.pathname)
            ? { k: 'landing' }
            : { k: 'out', mode: authModeOf(window.location.pathname) ?? 'connexion' }
          : p
      )
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
  } else if (phase.k === 'landing') {
    body = <LandingPage />
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
          // Compte neuf : Partenaires seulement, même si ce téléphone a servi à un autre compte
          resetModulesLocal()
          const empty = { shop: { name, createdAt: new Date().toISOString(), modules: { personnes: true, employes: false } }, persons: [], movements: [], monthStates: {} }
          const persist = makePersister(uid, empty)
          window.history.replaceState(null, '', '/')
          setPhase({ k: 'ready', uid, data: empty, persist: (x: StoreData) => persist({ ...x, shop: { ...x.shop, createdAt: empty.shop.createdAt } }) })
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
      <StoreProvider key={`${phase.uid}-${phase.v ?? 0}`} data={phase.data} persist={phase.persist} onLogout={() => void logOut()}>
        <AppContent />
      </StoreProvider>
    )
  }

  return (
    <>
      {body}
      <SplashScreen ready={DEMO || phase.k !== 'loading'} />
      <PullToRefresh />
    </>
  )
}

export default App
