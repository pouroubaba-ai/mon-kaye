import * as React from "react"
import { Briefcase, Coins, LayoutDashboard, Lock, Moon, Plus, Settings, Store, Sun, Users } from "lucide-react"
import { useToPayCount } from "@/components/screens/EmployeesMonthScreen"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useStore } from "@/data/store"

// Barre latérale de « Carnet », construite sur la structure du bloc shadcn/ui « sidebar-03 »
// (Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarMenu, SidebarRail),
// repliable en icônes. Affichée sur ordinateur et tablette ; sur téléphone, la barre du bas la remplace.

type Tab = "accueil" | "personnes" | "employes" | "salaires" | "reglages"

const NAV: { tab: Tab; title: string; icon: React.ComponentType }[] = [
  { tab: "accueil", title: "Accueil", icon: LayoutDashboard },
  { tab: "personnes", title: "Personnes", icon: Users },
  { tab: "employes", title: "Employés", icon: Briefcase },
  { tab: "salaires", title: "Salaires", icon: Coins },
  { tab: "reglages", title: "Réglages", icon: Settings },
]

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { shop, activeTab, navigate, openNewMovement, theme, toggleTheme, lockApp, totals, modules } =
    useStore()

  // Bouton du menu : toujours en haut de la page (même si on y est déjà).
  const go = (tab: Tab) => navigate(tab)

  const toPay = useToPayCount()
  const badgeFor = (tab: Tab) => {
    if (tab === "salaires") return toPay > 0 ? toPay : null
    if (tab === "personnes" && totals.latePartnersCount > 0) return totals.latePartnersCount
    if (tab === "employes" && totals.soonSalariesDueCount > 0) return totals.soonSalariesDueCount
    return null
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" onClick={() => go("accueil")} tooltip={shop.name}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Store className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="truncate font-medium">{shop.name}</span>
                <span className="text-xs text-muted-foreground">Démonstration</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Nouveau mouvement" onClick={() => openNewMovement()}>
                  <Plus />
                  <span>Nouveau mouvement</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.filter(i => (i.tab === 'personnes' ? modules.personnes : i.tab === 'employes' || i.tab === 'salaires' ? modules.employes : true)).map(item => {
                const badge = badgeFor(item.tab)
                return (
                  <SidebarMenuItem key={item.tab}>
                    <SidebarMenuButton
                      isActive={activeTab === item.tab}
                      tooltip={item.title}
                      onClick={() => go(item.tab)}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                    {badge !== null && <SidebarMenuBadge className={item.tab === "salaires" ? "rounded-full bg-destructive text-white peer-hover/menu-button:text-white" : undefined}>{badge}</SidebarMenuBadge>}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"} onClick={toggleTheme}>
              {theme === "dark" ? <Sun /> : <Moon />}
              <span>{theme === "dark" ? "Mode clair" : "Mode sombre"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Verrouiller" onClick={lockApp}>
              <Lock />
              <span>Verrouiller</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
