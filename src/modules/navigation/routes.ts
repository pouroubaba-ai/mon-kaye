// ——— Adresses des écrans ———
// Chaque écran a son adresse : actualiser garde l'écran, le bouton retour suit les adresses.
//   /                      tableau de bord        /comptes/leurs[/employes]  « Leurs comptes »
//   /personnes[/id]        liste ou fiche          /comptes/mes[/employes]    « Mes comptes »
//   /employes[/id]         liste ou fiche          /salaires                   page Salaires
//   /reglages[/modules]    réglages ou Modules
// Les fenêtres (verser, fiche de paie…) n'ont pas d'adresse.
import type { Person } from '@/data/mockData'
import type { Modules } from '@/modules/reglages/preferences'

export type Tab = 'accueil' | 'personnes' | 'employes' | 'salaires' | 'reglages'
export type AccountsView = { dir: 'leurs' | 'mes'; group: 'partner' | 'employee' }
export type Screen = {
  tab: Tab
  person: string | null
  accounts: AccountsView | null
  settings: 'main' | 'modules'
}

export function parsePath(path: string, modules: Modules, persons: Person[]): Screen {
  const home: Screen = { tab: 'accueil', person: null, accounts: null, settings: 'main' }
  const [a, b, c] = path.split('/').filter(Boolean).map(decodeURIComponent)
  const person = (type: Person['type']) => (b && persons.some(p => p.id === b && p.type === type) ? b : null)
  switch (a) {
    case 'comptes': {
      if (b !== 'leurs' && b !== 'mes') return home
      const group = (c === 'employes' && modules.employes) || !modules.personnes ? 'employee' : 'partner'
      return { ...home, accounts: { dir: b, group } }
    }
    case 'personnes':
      return modules.personnes ? { ...home, tab: 'personnes', person: person('partner') } : home
    case 'employes':
      return modules.employes ? { ...home, tab: 'employes', person: person('employee') } : home
    case 'salaires':
      return modules.employes ? { ...home, tab: 'salaires' } : home
    case 'reglages':
      return { ...home, tab: 'reglages', settings: b === 'modules' ? 'modules' : 'main' }
    default:
      return home
  }
}

export function buildPath(s: Screen, persons: Person[]): string {
  if (s.person) {
    const p = persons.find(x => x.id === s.person)
    if (p) return `/${p.type === 'employee' ? 'employes' : 'personnes'}/${encodeURIComponent(p.id)}`
  }
  if (s.tab === 'accueil') return s.accounts ? `/comptes/${s.accounts.dir}${s.accounts.group === 'employee' ? '/employes' : ''}` : '/'
  if (s.tab === 'reglages') return s.settings === 'modules' ? '/reglages/modules' : '/reglages'
  return `/${s.tab}`
}
