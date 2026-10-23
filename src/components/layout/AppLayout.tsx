import React from 'react'
import { ChevronLeft } from 'lucide-react'

import { useStore } from '@/data/store'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// Mise en page « Kayé simple » : plus de barre du bas ni de menu sur le côté.
// L'accueil et la fiche d'une personne ont leur propre haut d'écran. Les autres pages
// (Statistiques, Réglages, Employés…) ont une petite barre : ← et le nom de la page.
const TITLES: Record<string, string> = {
  stats: 'Statistiques',
  reglages: 'Réglages',
  employes: 'Employés',
  salaires: 'Employés',
}

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { persons, activeTab, selectedPersonId, navigate, navKey, setSelectedPersonId, accountsView, setAccountsView, settingsView, setSettingsView } = useStore()

  // Position de défilement :
  // - ouvrir une fiche : en haut de la fiche ; la position de la page en dessous est gardée ;
  // - revenir de la fiche : exactement là où on était ;
  // - changer de page : en haut.
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

  const openPerson = selectedPersonId ? persons.find(p => p.id === selectedPersonId) : undefined
  // Écrans qui dessinent eux-mêmes leur haut : l'accueil (et Employés, sous le même haut) et la fiche d'un partenaire
  const own = openPerson ? openPerson.type === 'partner' : !accountsView && (activeTab === 'accueil' || activeTab === 'personnes' || activeTab === 'salaires')

  // La petite barre : ← et le nom de la page
  const bar = openPerson
    ? { label: openPerson.name, back: () => setSelectedPersonId(null) }
    : accountsView
      ? { label: accountsView.dir === 'leurs' ? 'On me doit' : 'Je dois', back: () => setAccountsView(null) }
      : activeTab === 'reglages' && settingsView === 'modules'
        ? { label: 'Modules', back: () => setSettingsView('main') }
        : { label: TITLES[activeTab] ?? '', back: () => navigate(activeTab === 'employes' ? 'salaires' : 'accueil') }

  return (
    <TooltipProvider>
      <div className="mx-auto min-h-dvh w-full max-w-xl bg-background">
        {!own && (
          <header className="sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-1 border-b bg-background px-2 pt-[env(safe-area-inset-top)]">
            <button type="button" aria-label="Retour" onClick={bar.back} className="flex size-11 items-center justify-center rounded-full hover:bg-muted">
              <ChevronLeft className="size-6" />
            </button>
            <h1 className="truncate text-lg font-semibold">{bar.label}</h1>
          </header>
        )}
        <div className={cn(!own && 'p-4 pb-[calc(2rem+env(safe-area-inset-bottom))]')}>{children}</div>
      </div>
    </TooltipProvider>
  )
}
