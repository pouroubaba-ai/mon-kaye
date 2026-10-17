import React from 'react'
import { useStore } from '@/data/store'
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  Settings, 
  Plus, 
  Store, 
  Moon, 
  Sun, 
  Lock, 
  CloudCheck, 
  ChevronRight, 
  PanelLeftClose, 
  PanelLeftOpen 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { 
    shop, 
    activeTab, 
    setActiveTab, 
    setSelectedPersonId, 
    openNewMovement, 
    theme, 
    toggleTheme, 
    lockApp,
    totals 
  } = useStore()

  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false)

  const handleTabChange = (tab: 'accueil' | 'personnes' | 'employes' | 'reglages') => {
    setSelectedPersonId(null)
    setActiveTab(tab)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row text-foreground">
      
      {/* DESKTOP / TABLET SIDEBAR (INSPIRÉ DE SHADCN SIDEBAR-03) */}
      <aside className={`hidden md:flex flex-col border-r bg-card transition-all duration-200 shrink-0 select-none ${
        isSidebarCollapsed ? 'w-20' : 'w-64'
      }`}>
        {/* Top Header Boutique */}
        <div className="p-4 border-b flex items-center justify-between">
          {!isSidebarCollapsed ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0 shadow-sm">
                <Store className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-sm text-foreground truncate">{shop.name}</h2>
                <span className="text-[11px] text-muted-foreground block truncate">
                  Brazzaville · Bacongo
                </span>
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold mx-auto">
              <Store className="w-5 h-5" />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="h-8 w-8 text-muted-foreground shrink-0"
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </Button>
        </div>

        {/* Bouton Rapide Nouveau Mouvement */}
        <div className="p-3">
          <Button
            onClick={() => openNewMovement()}
            className="w-full h-11 text-xs font-bold gap-2 shadow-sm rounded-xl justify-center"
          >
            <Plus className="w-4 h-4" />
            {!isSidebarCollapsed && <span>Nouveau Mouvement</span>}
          </Button>
        </div>

        {/* Navigation Items (Sidebar-03 Style) */}
        <nav className="flex-1 p-3 space-y-1 text-sm font-medium">
          {/* Onglet Accueil */}
          <button
            type="button"
            onClick={() => handleTabChange('accueil')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
              activeTab === 'accueil'
                ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
          >
            <LayoutDashboard className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span>Accueil</span>}
          </button>

          {/* Onglet Personnes */}
          <button
            type="button"
            onClick={() => handleTabChange('personnes')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
              activeTab === 'personnes'
                ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>Personnes</span>}
            </div>
            {!isSidebarCollapsed && totals.latePartnersCount > 0 && (
              <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/40">
                {totals.latePartnersCount}
              </Badge>
            )}
          </button>

          {/* Onglet Employés */}
          <button
            type="button"
            onClick={() => handleTabChange('employes')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
              activeTab === 'employes'
                ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
          >
            <div className="flex items-center gap-3">
              <Briefcase className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>Employés</span>}
            </div>
            {!isSidebarCollapsed && totals.soonSalariesDueCount > 0 && (
              <Badge variant="outline" className="text-[10px] text-debt border-debt/40">
                {totals.soonSalariesDueCount}
              </Badge>
            )}
          </button>

          {/* Onglet Réglages */}
          <button
            type="button"
            onClick={() => handleTabChange('reglages')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
              activeTab === 'reglages'
                ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
          >
            <Settings className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span>Réglages</span>}
          </button>
        </nav>

        {/* Footer Sidebar : Statut Hors ligne & Lock */}
        <div className="p-3 border-t space-y-2">
          {!isSidebarCollapsed && (
            <div className="p-2.5 rounded-xl bg-muted/20 border text-xs flex items-center gap-2">
              <CloudCheck className="w-4 h-4 text-credit shrink-0" />
              <div className="min-w-0">
                <span className="font-bold text-foreground block truncate">Base locale active</span>
                <span className="text-[10px] text-muted-foreground block truncate">Sauvegardé</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="flex-1 h-9 text-xs gap-1.5"
            >
              {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-500" />}
              {!isSidebarCollapsed && <span>{theme === 'dark' ? 'Sombre' : 'Clair'}</span>}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={lockApp}
              className="h-9 w-9 text-destructive"
              title="Verrouiller l'écran"
            >
              <Lock className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-y-auto">
        
        {/* MOBILE TOP BAR */}
        <header className="md:hidden border-b bg-card sticky top-0 z-30 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm text-foreground truncate">{shop.name}</h1>
              <span className="text-[10px] text-credit flex items-center gap-1 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-credit animate-pulse" />
                Sauvegardé localement
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8">
              {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-500" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={lockApp} className="h-8 w-8 text-destructive">
              <Lock className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
          {children}
        </main>

        {/* MOBILE BOTTOM NAVIGATION BAR (BARRE EN BAS À 4 ONGLETS + BOUTON FLOTTANT CENTRAL « + ») */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t px-2 py-1 shadow-lg">
          <div className="flex items-center justify-around relative">
            
            {/* 1. Accueil */}
            <button
              type="button"
              onClick={() => handleTabChange('accueil')}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all ${
                activeTab === 'accueil' ? 'text-primary font-bold' : 'text-muted-foreground'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Accueil</span>
            </button>

            {/* 2. Personnes */}
            <button
              type="button"
              onClick={() => handleTabChange('personnes')}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all ${
                activeTab === 'personnes' ? 'text-primary font-bold' : 'text-muted-foreground'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Personnes</span>
            </button>

            {/* GROS BOUTON FLOTTANT CENTRAL « + » (RÈGLE PRIORITAIRE MOBILE) */}
            <div className="relative -top-5">
              <button
                type="button"
                onClick={() => openNewMovement()}
                className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl border-4 border-background active:scale-95 transition-all"
                title="Ajouter un mouvement rapide"
              >
                <Plus className="w-7 h-7 stroke-[2.5]" />
              </button>
            </div>

            {/* 3. Employés */}
            <button
              type="button"
              onClick={() => handleTabChange('employes')}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all ${
                activeTab === 'employes' ? 'text-primary font-bold' : 'text-muted-foreground'
              }`}
            >
              <Briefcase className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Employés</span>
            </button>

            {/* 4. Réglages */}
            <button
              type="button"
              onClick={() => handleTabChange('reglages')}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all ${
                activeTab === 'reglages' ? 'text-primary font-bold' : 'text-muted-foreground'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Réglages</span>
            </button>

          </div>
        </div>

      </div>

    </div>
  )
}
