import React from 'react'
import { useStore } from '@/data/store'
import { LayoutDashboard, Users, Briefcase, Settings, Plus, Store, Moon, Sun, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type Tab = 'accueil' | 'personnes' | 'employes' | 'reglages'

const TITLES: Record<Tab, string> = {
  accueil: 'Accueil',
  personnes: 'Personnes',
  employes: 'Employés',
  reglages: 'Réglages',
}

// Mise en page : barre latérale shadcn (ordinateur, tablette) + barre du bas à 4 onglets
// et un seul bouton « + » (téléphone). Une seule entrée « nouveau mouvement » par appareil.
export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { shop, activeTab, setActiveTab, setSelectedPersonId, openNewMovement, theme, toggleTheme, lockApp } =
    useStore()

  const go = (tab: Tab) => {
    setSelectedPersonId(null)
    setActiveTab(tab)
  }

  const tabs: { tab: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { tab: 'accueil', label: 'Accueil', icon: LayoutDashboard },
    { tab: 'personnes', label: 'Personnes', icon: Users },
    { tab: 'employes', label: 'Employés', icon: Briefcase },
    { tab: 'reglages', label: 'Réglages', icon: Settings },
  ]

  return (
    <TooltipProvider>
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* En-tête ordinateur (structure sidebar-03) */}
        <header className="hidden h-14 shrink-0 items-center gap-2 border-b px-4 md:flex">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <span className="text-sm font-medium">{TITLES[activeTab]}</span>
        </header>

        {/* En-tête téléphone */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-background px-4 py-2 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Store className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{shop.name}</p>
              <Badge variant="outline">Démonstration</Badge>
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Changer de thème">
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
            <Button variant="ghost" size="icon" onClick={lockApp} aria-label="Verrouiller">
              <Lock />
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 pb-28 md:p-6">{children}</main>
      </SidebarInset>

      {/* Barre du bas (téléphone) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background md:hidden">
        <div className="grid grid-cols-5 items-end">
          {tabs.slice(0, 2).map(t => (
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
          {tabs.slice(2).map(t => (
            <TabButton key={t.tab} active={activeTab === t.tab} label={t.label} Icon={t.icon} onClick={() => go(t.tab)} />
          ))}
        </div>
      </nav>
    </SidebarProvider>
    </TooltipProvider>
  )
}

function TabButton({
  active,
  label,
  Icon,
  onClick,
}: {
  active: boolean
  label: string
  Icon: React.ComponentType<{ className?: string }>
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
      <Icon className="size-5" />
      {label}
    </button>
  )
}
