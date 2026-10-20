import React from 'react'
import { useStore } from '@/data/store'
import { LayoutDashboard, Users, Briefcase, Settings, Plus, Moon, Sun, Lock, Coins } from 'lucide-react'
import { useToPayCount } from '@/components/screens/EmployeesMonthScreen'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { cn } from '@/lib/utils'

type Tab = 'accueil' | 'personnes' | 'employes' | 'salaires' | 'reglages'

const TITLES: Record<Tab, string> = {
  accueil: 'Tableau de bord',
  personnes: 'Personnes',
  employes: 'Employés',
  salaires: 'Salaires',
  reglages: 'Réglages',
}

// Mise en page : barre latérale shadcn (ordinateur, tablette) + barre du bas à 4 onglets
// et un seul bouton « + » (téléphone). Une seule entrée « nouveau mouvement » par appareil.
export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { shop, persons, activeTab, selectedPersonId, navigate, navKey, setSelectedPersonId, openNewMovement, theme, toggleTheme, lockApp, accountsView, setAccountsView, modules, settingsView, setSettingsView } =
    useStore()

  // Position de défilement :
  // - ouvrir une fiche : en haut de la fiche ; la position de la page en dessous est gardée ;
  // - revenir de la fiche : exactement là où on était ;
  // - changer de page, ou toucher le bouton du menu (même celui de la page actuelle) : en haut.
  const top = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  const pageScroll = React.useRef(0)
  const personOpen = React.useRef(false)
  React.useEffect(() => {
    const onScroll = () => {
      if (!personOpen.current) pageScroll.current = window.scrollY
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const prevPerson = React.useRef(selectedPersonId)
  React.useLayoutEffect(() => {
    const prev = prevPerson.current
    prevPerson.current = selectedPersonId
    personOpen.current = !!selectedPersonId
    if (selectedPersonId && selectedPersonId !== prev) top()
    else if (!selectedPersonId && prev) window.scrollTo({ top: pageScroll.current, left: 0, behavior: 'instant' })
  }, [selectedPersonId])
  React.useLayoutEffect(() => {
    pageScroll.current = 0
    top()
  }, [activeTab, accountsView?.dir, settingsView, navKey])

  const shopName = shop.name?.trim()
  const openPerson = selectedPersonId ? persons.find(p => p.id === selectedPersonId) : undefined
  // Fil d'Ariane : une fiche ouverte (« Page › Nom ») ou un écran de comptes (« Tableau de bord › Leurs comptes »).
  const crumb = openPerson
    ? { label: openPerson.name, back: () => setSelectedPersonId(null) }
    : accountsView && activeTab === 'accueil'
      ? { label: accountsView.dir === 'leurs' ? 'Leurs comptes' : 'Mes comptes', back: () => setAccountsView(null) }
      : activeTab === 'reglages' && settingsView === 'modules'
        ? { label: 'Modules', back: () => setSettingsView('main') }
        : null

  const go = (tab: Tab) => navigate(tab)

  type NavTab = { tab: Tab; label: string; icon: React.ComponentType<{ className?: string }> }
  const allTabs: NavTab[] = [
    { tab: 'accueil', label: 'Accueil', icon: LayoutDashboard },
    { tab: 'personnes', label: 'Personnes', icon: Users },
    { tab: 'employes', label: 'Employés', icon: Briefcase },
    { tab: 'salaires', label: 'Salaires', icon: Coins },
  ]
  const shown = allTabs.filter(t => (t.tab === 'personnes' ? modules.personnes : t.tab === 'employes' || t.tab === 'salaires' ? modules.employes : true))
  // Le « + » toujours au milieu : autant d'onglets de chaque côté. S'il en manque un, Réglages
  // prend la place libre (sinon Réglages est l'icône en haut à droite).
  const settingsInBar = shown.length % 2 === 1
  const tabs = settingsInBar ? [...shown, { tab: 'reglages' as Tab, label: 'Réglages', icon: Settings }] : shown
  const half = tabs.length / 2
  const toPay = useToPayCount()

  return (
    <TooltipProvider>
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* En-tête : le nom de la page, le thème et le verrouillage. */}
        <header className="sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 pt-[env(safe-area-inset-top)] items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
          <Separator orientation="vertical" className="mr-2 hidden data-[orientation=vertical]:h-4 md:block" />
          <div className="min-w-0 flex-1">
            {crumb ? (
              // Fiche ouverte : fil d'Ariane « Page › Nom ». Toucher la page ramène à la liste.
              <Breadcrumb>
                <BreadcrumbList className="flex-nowrap text-sm">
                  <BreadcrumbItem className="shrink-0">
                    <BreadcrumbLink asChild>
                      <button type="button" onClick={crumb.back}>
                        {TITLES[activeTab]}
                      </button>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem className="min-w-0">
                    <BreadcrumbPage className="truncate font-medium">{crumb.label}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            ) : (
              <>
                <h1 className="truncate text-lg leading-tight font-semibold tracking-tight md:text-base">{TITLES[activeTab]}</h1>
                {activeTab === 'accueil' && shopName && (
                  <p className="truncate text-xs leading-tight text-muted-foreground">{shopName}</p>
                )}
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center md:hidden">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Changer de thème">
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
            <Button variant="ghost" size="icon" onClick={lockApp} aria-label="Verrouiller">
              <Lock />
            </Button>
            {/* Réglages : ici sur téléphone, la barre du bas laisse sa place à « Salaires » */}
            {/* Dans une page ouverte (fiche, Modules…), on revient par le fil d'Ariane : pas de roue ici */}
            {!settingsInBar && !crumb && (
              <Button variant="ghost" size="icon" onClick={() => go('reglages')} aria-label="Réglages" className={cn(activeTab === 'reglages' && 'bg-muted')}>
                <Settings />
              </Button>
            )}
          </div>
        </header>

        <div className={cn('mx-auto w-full max-w-6xl flex-1 p-4 md:p-6', crumb ? 'pb-[calc(2rem+env(safe-area-inset-bottom))]' : 'pb-[calc(7rem+env(safe-area-inset-bottom))]')}>{children}</div>
      </SidebarInset>

      {/* Barre du bas (téléphone) : masquée dans une fiche, le fil d'Ariane sert au retour */}
      {!crumb && (
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] md:hidden">
        <div className="grid items-end" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
          {tabs.slice(0, half).map(t => (
            <TabButton key={t.tab} active={activeTab === t.tab} label={t.label} Icon={t.icon} onClick={() => go(t.tab)} />
          ))}
          <div className="flex justify-center">
            <Button
              size="icon"
              onClick={() => openNewMovement()}
              aria-label="Nouveau mouvement"
              className="-mt-6 size-14 rounded-full shadow-lg ring-4 ring-background"
            >
              <Plus className="size-7" />
            </Button>
          </div>
          {tabs.slice(half).map(t => (
            <TabButton key={t.tab} active={activeTab === t.tab} label={t.label} Icon={t.icon} badge={t.tab === 'salaires' ? toPay : 0} onClick={() => go(t.tab)} />
          ))}
        </div>
      </nav>
      )}
    </SidebarProvider>
    </TooltipProvider>
  )
}

function TabButton({
  active,
  label,
  Icon,
  badge = 0,
  onClick,
}: {
  active: boolean
  label: string
  Icon: React.ComponentType<{ className?: string }>
  badge?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs',
        active ? 'font-semibold text-foreground' : 'text-muted-foreground'
      )}
    >
      <span className="relative">
        <Icon className="size-5" />
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white tabular-nums">
            {badge}
          </span>
        )}
      </span>
      {label}
    </button>
  )
}
