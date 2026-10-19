import React, { createContext, useContext, useState, useEffect } from 'react'
import { type Person, type Movement, INITIAL_SHOP, INITIAL_PERSONS, INITIAL_MOVEMENTS } from './mockData'
import { buildPayrollSeed, currentPeriod, missingMonths, monthKey, ofMonth, payrollOf, planCancelMonth, planStopMonth, simulateDeparture, syncEmployee } from './payroll'

// Trop versé : « plus tard » = la différence passe dans l'autre compte ; « déjà rendu » = réglé en main propre.
export type ExcessChoice = 'plus_tard' | 'deja_rendu'

// Ce qu'une opération retire d'un compte, et de combien elle le ferait passer sous zéro.
export const returnedOn = (movements: Movement[], creditId: string) =>
  movements
    .filter(m => m.linkedMovementId === creditId && !m.isCancelled && (m.type === 'il_a_retourne' || m.type === 'j_ai_retourne'))
    .reduce((a, m) => a + m.amount, 0)

export const excessOf = (person: Person | undefined, side: 'lui' | 'moi', reduce: number) => {
  if (!person) return 0
  const balance = side === 'lui' ? person.owesMe || 0 : person.iOweHim || 0
  return Math.max(0, reduce - balance)
}

interface StoreContextType {
  shop: typeof INITIAL_SHOP
  setShopName: (name: string) => void
  setShopPin: (pin: string) => void
  isLocked: boolean
  unlockWithPin: (pin: string) => boolean
  lockApp: () => void
  
  // Theme
  theme: 'dark' | 'light'
  toggleTheme: () => void
  
  // Modules : Personnes (clients, fournisseurs) et Employés (salaires, avances). Un module coupé est
  // seulement caché : ses données restent et reviennent quand on le rallume. Au moins un reste allumé.
  modules: Modules
  setModule: (key: keyof Modules, on: boolean) => void

  // Navigation
  activeTab: 'accueil' | 'personnes' | 'employes' | 'salaires' | 'reglages'
  setActiveTab: (tab: 'accueil' | 'personnes' | 'employes' | 'salaires' | 'reglages') => void
  // Bouton du menu : ferme la fiche ouverte, va à la page et remonte en haut (navKey change à chaque appui).
  navigate: (tab: 'accueil' | 'personnes' | 'employes' | 'salaires' | 'reglages') => void
  navKey: number
  selectedPersonId: string | null
  // Écran ouvert depuis le tableau de bord : « Leurs comptes » ou « Mes comptes », et le côté choisi.
  accountsView: { dir: 'leurs' | 'mes'; group: 'partner' | 'employee' } | null
  setAccountsView: (v: { dir: 'leurs' | 'mes'; group: 'partner' | 'employee' } | null) => void
  // Réglages : la page principale ou la page « Modules » (une vraie page, avec retour)
  settingsView: 'main' | 'modules'
  setSettingsView: (v: 'main' | 'modules') => void
  setSelectedPersonId: (id: string | null) => void
  
  // Modals state
  isNewMovementOpen: boolean
  // side : ouvert depuis un côté de l'historique, on ne propose que les opérations de ce compte
  openNewMovement: (personId?: string, defaultType?: Movement['type'], side?: 'credit' | 'debt') => void
  closeNewMovement: () => void
  newMovementTargetPersonId: string | null
  newMovementInitialType: Movement['type'] | null
  newMovementSide: 'credit' | 'debt' | null
  
  isDepartureOpen: boolean
  openDeparture: (employeeId: string) => void
  closeDeparture: () => void
  departureTargetEmployeeId: string | null
  
  isCompensationOpen: boolean
  openCompensation: (partnerId: string) => void
  closeCompensation: () => void
  compensationTargetPartnerId: string | null
  
  selectedMovement: Movement | null
  openMovementDetail: (mov: Movement) => void
  closeMovementDetail: () => void
  
  // Data
  persons: Person[]
  movements: Movement[]
  addMovement: (movement: Omit<Movement, 'id' | 'date'> & { date?: string }) => void
  // excess : que faire si l'annulation fait passer le compte sous zéro (il a trop versé).
  cancelMovement: (id: string, reason: string, excess?: ExcessChoice) => void
  // Retour de marchandise sur un crédit (le sien ou le mien), sans argent.
  addReturn: (creditId: string, amount: number, excess?: ExcessChoice) => void
  // Paie : état particulier d'un mois (arrêté, annulé) ; clé « employé|2026-10 »
  monthStates: Record<string, 'arrete' | 'annule'>
  // Mois en cours seulement. surplus : ce que devient le trop reçu (« avance » ou « rendu »)
  stopMonth: (empId: string, period: string, newBase: number, basisLabel: string, surplus?: 'avance' | 'rendu') => void
  cancelMonth: (empId: string, period: string, reason: string, surplus?: 'avance' | 'rendu') => void
  // Façon de rendre les avances : retenue par mois (0 = il rend directement). Met à jour la retenue du mois en cours.
  setAdvancePlan: (empId: string, perMonth: number) => void
  setMonthRetenue: (empId: string, amount: number) => void
  applyCompensation: (partnerId: string) => void
  processDeparture: (
    employeeId: string,
    newBase: number | null,
    basisLabel: string,
    advanceChoice: 'retenir' | 'dette' | 'laisser',
    note?: string
  ) => void
  
  // Aggregated Totals
  totals: {
    totalOwesMe: number
    totalIOwe: number
    partnersOwesMe: number
    partnersIOwe: number
    employeesSalaryDue: number
    employeesAdvanceOwed: number
    soonSalariesDueCount: number
    latePartnersCount: number
  }
  
  exportCSV: () => void
  // Modifier les informations d'une personne (nom, numéro, rôle, salaire…)
  updatePerson: (id: string, changes: Partial<Pick<Person, 'name' | 'phone' | 'role' | 'salary' | 'dueDay'>>) => void
  // Ajouter une personne ou un employé ; renvoie son identifiant
  addPerson: (data: {
    type: 'partner' | 'employee'
    name: string
    phone: string
    role?: string
    salary?: number
    dueDay?: number
    // Employé : son arrivée (premier mois), ce qu'on lui devait déjà, son avance et la façon de la rendre
    start?: { day: number; amount: number; label: string } // absent : il commence au début du mois
    oldDebt?: number
    advance?: number
    perMonth?: number
  }) => string
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export type Modules = { personnes: boolean; employes: boolean }

// ——— Adresses des écrans ———
// Chaque écran a son adresse : actualiser garde l'écran, le bouton retour suit les adresses.
//   /                      tableau de bord        /comptes/leurs[/employes]  « Leurs comptes »
//   /personnes[/id]        liste ou fiche          /comptes/mes[/employes]    « Mes comptes »
//   /employes[/id]         liste ou fiche          /salaires                   page Salaires
//   /reglages[/modules]    réglages ou Modules
// Les fenêtres (verser, fiche de paie…) n'ont pas d'adresse.
type Tab = 'accueil' | 'personnes' | 'employes' | 'salaires' | 'reglages'
type Screen = {
  tab: Tab
  person: string | null
  accounts: { dir: 'leurs' | 'mes'; group: 'partner' | 'employee' } | null
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
// Écran au démarrage : celui de l'adresse (actualiser garde l'écran)
const startScreen = (() => {
  let cache: Screen | null = null
  return () => {
    if (!cache) cache = parsePath(window.location.pathname, loadModules(), INITIAL_PERSONS)
    return cache
  }
})()
// Par défaut : Personnes seulement. Le choix est gardé sur l'appareil.
const DEFAULT_MODULES: Modules = { personnes: true, employes: false }
const MODULES_KEY = 'kaye.modules'
const loadModules = (): Modules => {
  try {
    const raw = localStorage.getItem(MODULES_KEY)
    if (!raw) return DEFAULT_MODULES
    const m = JSON.parse(raw)
    const out = { personnes: m.personnes !== false, employes: m.employes === true }
    return out.personnes || out.employes ? out : DEFAULT_MODULES
  } catch {
    return DEFAULT_MODULES
  }
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shop, setShop] = useState(INITIAL_SHOP)
  const [isLocked, setIsLocked] = useState(false)
  // Thème gardé sur l'appareil ; la première fois, celui du téléphone (sombre par défaut)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const t = localStorage.getItem('kaye.theme')
      if (t === 'dark' || t === 'light') return t
      return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })
  const [activeTab, setActiveTabRaw] = useState<'accueil' | 'personnes' | 'employes' | 'salaires' | 'reglages'>(() => startScreen().tab)
  const [accountsView, setAccountsView] = useState<{ dir: 'leurs' | 'mes'; group: 'partner' | 'employee' } | null>(() => startScreen().accounts)
  const [settingsView, setSettingsView] = useState<'main' | 'modules'>(() => startScreen().settings)
  // Changer de page referme l'écran « Leurs comptes / Mes comptes ».
  const setActiveTab = (tab: 'accueil' | 'personnes' | 'employes' | 'salaires' | 'reglages') => {
    setAccountsView(null)
    setSettingsView('main')
    setActiveTabRaw(tab)
  }
  const [navKey, setNavKey] = useState(0)
  const navigate = (tab: 'accueil' | 'personnes' | 'employes' | 'salaires' | 'reglages') => {
    setSelectedPersonId(null)
    setAccountsView(null)
    setSettingsView('main')
    setActiveTabRaw(tab)
    setNavKey(k => k + 1)
  }
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(() => startScreen().person)

  const [modules, setModules] = useState<Modules>(loadModules)
  const setModule: StoreContextType['setModule'] = (key, on) => {
    const next = { ...modules, [key]: on }
    if (!next.personnes && !next.employes) return // au moins un module allumé
    setModules(next)
    try {
      localStorage.setItem(MODULES_KEY, JSON.stringify(next))
    } catch {
      /* rien : le choix vaut pour cette fois */
    }
    if (!on) {
      // On quitte ce qui vient d'être caché
      setSelectedPersonId(null)
      setAccountsView(null)
      if ((key === 'personnes' && activeTab === 'personnes') || (key === 'employes' && (activeTab === 'employes' || activeTab === 'salaires')))
        setActiveTabRaw('accueil')
    }
  }
  
  // Démonstration : la paie des employés est reconstituée en opérations (mois, versements, avances),
  // puis les compteurs de chaque employé sont recalculés à partir d'elles.
  const [movements, setMovements] = useState<Movement[]>(() => [
    ...INITIAL_MOVEMENTS,
    ...buildPayrollSeed(INITIAL_PERSONS, INITIAL_MOVEMENTS),
  ])
  const [monthStates, setMonthStates] = useState<Record<string, 'arrete' | 'annule'>>({})
  const [persons, setPersons] = useState<Person[]>(() => {
    const all = [...INITIAL_MOVEMENTS, ...buildPayrollSeed(INITIAL_PERSONS, INITIAL_MOVEMENTS)]
    return INITIAL_PERSONS.map(p => syncEmployee(p, all, {}))
  })
  // Nouveau mois : chaque employé actif commence le mois avec son salaire entier
  React.useEffect(() => {
    const extra = missingMonths(persons, movements, monthStates)
    if (extra.length === 0) return
    const next = [...extra, ...movements]
    setMovements(next)
    const ids = new Set(extra.map(m => m.personId))
    setPersons(prev => prev.map(p => (ids.has(p.id) ? syncEmployee(p, next, monthStates) : p)))
  }, [persons, movements, monthStates])

  // Employé : on enregistre les opérations, puis on recalcule ses compteurs depuis elles.
  const commitEmployee = (empId: string, next: Movement[], states = monthStates) => {
    setMovements(next)
    setMonthStates(states)
    setPersons(prev => prev.map(p => (p.id === empId ? syncEmployee(p, next, states) : p)))
  }
  
  // Modals
  const [isNewMovementOpen, setIsNewMovementOpen] = useState(false)
  const [newMovementTargetPersonId, setNewMovementTargetPersonId] = useState<string | null>(null)
  const [newMovementInitialType, setNewMovementInitialType] = useState<Movement['type'] | null>(null)
  const [newMovementSide, setNewMovementSide] = useState<'credit' | 'debt' | null>(null)
  
  const [isDepartureOpen, setIsDepartureOpen] = useState(false)
  const [departureTargetEmployeeId, setDepartureTargetEmployeeId] = useState<string | null>(null)
  
  const [isCompensationOpen, setIsCompensationOpen] = useState(false)
  const [compensationTargetPartnerId, setCompensationTargetPartnerId] = useState<string | null>(null)
  
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null)

  // Sync theme with HTML class
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem('kaye.theme', next)
      } catch {
        /* rien : le choix vaut pour cette fois */
      }
      return next
    })
  }

  const setShopName = (name: string) => {
    setShop(prev => ({ ...prev, name }))
  }

  const setShopPin = (pin: string) => {
    setShop(prev => ({ ...prev, pin }))
  }

  const unlockWithPin = (enteredPin: string) => {
    if (enteredPin === shop.pin) {
      setIsLocked(false)
      return true
    }
    return false
  }

  const lockApp = () => {
    setIsLocked(true)
  }

  const openNewMovement = (personId?: string, defaultType?: Movement['type'], side?: 'credit' | 'debt') => {
    setNewMovementTargetPersonId(personId || null)
    setNewMovementInitialType(defaultType || null)
    setNewMovementSide(side || null)
    setIsNewMovementOpen(true)
  }

  const closeNewMovement = () => {
    setIsNewMovementOpen(false)
    setNewMovementTargetPersonId(null)
    setNewMovementInitialType(null)
    setNewMovementSide(null)
  }

  const openDeparture = (employeeId: string) => {
    setDepartureTargetEmployeeId(employeeId)
    setIsDepartureOpen(true)
  }

  const closeDeparture = () => {
    setIsDepartureOpen(false)
    setDepartureTargetEmployeeId(null)
  }

  const openCompensation = (partnerId: string) => {
    setCompensationTargetPartnerId(partnerId)
    setIsCompensationOpen(true)
  }

  const closeCompensation = () => {
    setIsCompensationOpen(false)
    setCompensationTargetPartnerId(null)
  }

  const openMovementDetail = (mov: Movement) => {
    setSelectedMovement(mov)
  }

  const closeMovementDetail = () => {
    setSelectedMovement(null)
  }

  // ADD MOVEMENT WITH RECALCULATION
  const addMovement = (movementData: Omit<Movement, 'id' | 'date'> & { date?: string }) => {
    const today = new Date()
    const dateStr = movementData.date || `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`
    const newId = `mov-${Date.now()}`
    
    const newMov: Movement = {
      ...movementData,
      id: newId,
      date: dateStr,
    }

    // Employé : ajout ou retenue rattachés au mois en cours ; compteurs recalculés.
    if (persons.find(p => p.id === newMov.personId)?.type === 'employee') {
      if ((newMov.type === 'ajout_salaire' || newMov.type === 'retenue_manuelle') && !newMov.period) newMov.period = currentPeriod()
      commitEmployee(newMov.personId, [newMov, ...movements])
      return
    }

    setMovements(prev => [newMov, ...prev])

    // Update person counters
    setPersons(prev => prev.map(p => {
      if (p.id !== newMov.personId) return p
      
      const updated = { ...p }
      const amt = newMov.amount

      if (p.type === 'partner') {
        const owesMe = updated.owesMe || 0
        const iOweHim = updated.iOweHim || 0

        if (newMov.type === 'il_m_a_verse') {
          updated.owesMe = Math.max(0, owesMe - amt)
          updated.lastPaymentDate = dateStr
          updated.daysSinceLastPayment = 0
        } else if (newMov.type === 'il_a_pris_credit') {
          updated.owesMe = owesMe + amt
          updated.lastCreditToHimDate = dateStr
        } else if (newMov.type === 'je_lui_ai_verse') {
          updated.iOweHim = Math.max(0, iOweHim - amt)
          updated.lastPaidByMeDate = dateStr
        } else if (newMov.type === 'j_ai_pris_credit') {
          updated.iOweHim = iOweHim + amt
          updated.lastCreditFromHimDate = dateStr
        }
      } else if (p.type === 'employee') {
        const currentSalary = updated.currentSalaryDue || 0
        const advance = updated.advanceBalance || 0

        if (newMov.type === 'je_lui_ai_verse') {
          updated.currentSalaryDue = Math.max(0, currentSalary - amt)
          updated.lastSalaryPaymentDate = dateStr
        } else if (newMov.type === 'avance_salaire') {
          updated.advanceBalance = advance + amt
        } else if (newMov.type === 'remboursement_direct') {
          updated.advanceBalance = Math.max(0, advance - amt)
          updated.lastAdvanceRepaymentDate = dateStr
        } else if (newMov.type === 'retenue_salaire') {
          updated.currentSalaryDue = Math.max(0, currentSalary - amt)
          updated.advanceBalance = Math.max(0, advance - amt)
          updated.lastAdvanceRepaymentDate = dateStr
        }
      }
      return updated
    }))
  }

  const todayStr = () => {
    const d = new Date()
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }

  // Trop versé. side = le compte qui passe sous zéro ('lui' = son compte, 'moi' = mon compte).
  // La différence change de côté : on l'inscrit comme une dette dans l'autre compte
  // (« plus tard »), ou comme une dette aussitôt réglée (« déjà rendu »), pour que l'historique explique tout.
  const excessMovements = (p: Person, side: 'lui' | 'moi', excess: number, choice: ExcessChoice, linkedId: string, why: string) => {
    const date = todayStr()
    const stamp = Date.now()
    const out: Movement[] = [
      {
        id: `mov-trop-${stamp}`,
        personId: p.id,
        personName: p.name,
        type: side === 'lui' ? 'j_ai_pris_credit' : 'il_a_pris_credit',
        label: side === 'lui' ? 'Trop versé : à lui rendre' : 'Trop versé : à me rendre',
        amount: excess,
        date,
        note: `Trop versé après ${why}.`,
        linkedMovementId: linkedId,
      },
    ]
    if (choice === 'deja_rendu') {
      out.push({
        id: `mov-rendu-${stamp}`,
        personId: p.id,
        personName: p.name,
        type: side === 'lui' ? 'je_lui_ai_verse' : 'il_m_a_verse',
        label: 'Trop versé : rendu',
        amount: excess,
        date,
        paymentMethod: 'especes',
        note: `Différence déjà rendue après ${why}.`,
        linkedMovementId: linkedId,
      })
    }
    return out
  }

  // Retire `reduce` d'un compte. S'il passe sous zéro, il revient à 0 et la différence va dans l'autre compte
  // (sauf si elle a déjà été rendue).
  const reduceAccount = (p: Person, side: 'lui' | 'moi', reduce: number, choice: ExcessChoice | undefined) => {
    const updated = { ...p }
    const balance = side === 'lui' ? p.owesMe || 0 : p.iOweHim || 0
    const excess = Math.max(0, reduce - balance)
    if (side === 'lui') updated.owesMe = Math.max(0, balance - reduce)
    else updated.iOweHim = Math.max(0, balance - reduce)
    if (excess > 0 && (choice ?? 'plus_tard') === 'plus_tard') {
      if (side === 'lui') updated.iOweHim = (p.iOweHim || 0) + excess
      else updated.owesMe = (p.owesMe || 0) + excess
    }
    return { updated, excess }
  }

  // CANCEL MOVEMENT (NEVER DELETE) : la ligne reste, barrée, avec la pastille « Annulé ».
  const cancelMovement = (id: string, reason: string, choice?: ExcessChoice) => {
    const today = new Date()
    const cancelledAt = `${todayStr()} ${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`

    const targetMov = movements.find(m => m.id === id)
    if (!targetMov || targetMov.isCancelled) return
    const person = persons.find(p => p.id === targetMov.personId)
    if (!person) return

    // Employé : la ligne est barrée, puis tout est recalculé depuis les opérations.
    if (person.type === 'employee') {
      const next = movements.map(m => (m.id === id ? { ...m, isCancelled: true, cancellationReason: reason, cancelledAt } : m))
      commitEmployee(person.id, next)
      if (selectedMovement && selectedMovement.id === id) {
        setSelectedMovement(prev => (prev ? { ...prev, isCancelled: true, cancellationReason: reason, cancelledAt } : null))
      }
      return
    }

    const isCredit = targetMov.type === 'il_a_pris_credit' || targetMov.type === 'j_ai_pris_credit'
    // Un crédit annulé emporte ses retours : on ne retire que ce qui restait de ce crédit.
    const net = isCredit ? targetMov.amount - returnedOn(movements, id) : targetMov.amount
    let extra: Movement[] = []
    let updated: Person = { ...person }
    const amt = targetMov.amount

    // Compensation : les deux versements liés s'annulent ensemble, les deux comptes remontent.
    const twinId = targetMov.paymentMethod === 'compensation' ? targetMov.linkedMovementId : undefined

    if (person.type === 'partner' && twinId) {
      updated.owesMe = (person.owesMe || 0) + amt
      updated.iOweHim = (person.iOweHim || 0) + amt
    } else if (person.type === 'partner') {
      const owesMe = person.owesMe || 0
      const iOweHim = person.iOweHim || 0
      if (targetMov.type === 'il_m_a_verse') updated.owesMe = owesMe + amt
      else if (targetMov.type === 'je_lui_ai_verse') updated.iOweHim = iOweHim + amt
      else if (targetMov.type === 'il_a_retourne') updated.owesMe = owesMe + amt
      else if (targetMov.type === 'j_ai_retourne') updated.iOweHim = iOweHim + amt
      else if (isCredit) {
        const side = targetMov.type === 'il_a_pris_credit' ? 'lui' : 'moi'
        const r = reduceAccount(person, side, net, choice)
        updated = r.updated
        if (r.excess > 0) extra = excessMovements(person, side, r.excess, choice ?? 'plus_tard', id, `l'annulation du crédit du ${targetMov.date}`)
      }
    } else if (person.type === 'employee') {
      const currentSalary = person.currentSalaryDue || 0
      const advance = person.advanceBalance || 0
      if (targetMov.type === 'je_lui_ai_verse') updated.currentSalaryDue = currentSalary + amt
      else if (targetMov.type === 'avance_salaire') updated.advanceBalance = Math.max(0, advance - amt)
      else if (targetMov.type === 'remboursement_direct') updated.advanceBalance = advance + amt
      else if (targetMov.type === 'retenue_salaire') {
        updated.currentSalaryDue = currentSalary + amt
        updated.advanceBalance = advance + amt
      }
    }

    const mark = (m: Movement, why: string): Movement => ({ ...m, isCancelled: true, cancellationReason: why, cancelledAt })
    setMovements(prev => [
      ...extra,
      ...prev.map(m => {
        if (m.id === id) return mark(m, reason)
        if (twinId && m.id === twinId && !m.isCancelled) return mark(m, reason)
        if (isCredit && m.linkedMovementId === id && !m.isCancelled && (m.type === 'il_a_retourne' || m.type === 'j_ai_retourne'))
          return mark(m, 'Crédit annulé')
        return m
      }),
    ])
    setPersons(prev => prev.map(p => (p.id === person.id ? updated : p)))

    if (selectedMovement && selectedMovement.id === id) {
      setSelectedMovement(prev => (prev ? mark(prev, reason) : null))
    }
  }

  // RETOUR DE MARCHANDISE : diminue le compte comme un versement, mais sans argent ni moyen de paiement.
  const addReturn = (creditId: string, amount: number, choice?: ExcessChoice) => {
    const credit = movements.find(m => m.id === creditId)
    if (!credit || credit.isCancelled || amount <= 0) return
    const person = persons.find(p => p.id === credit.personId)
    if (!person) return
    const side = credit.type === 'il_a_pris_credit' ? 'lui' : 'moi'
    const ret: Movement = {
      id: `mov-retour-${Date.now()}`,
      personId: person.id,
      personName: person.name,
      type: side === 'lui' ? 'il_a_retourne' : 'j_ai_retourne',
      label: 'Retour',
      amount,
      date: todayStr(),
      note: `Sur le crédit du ${credit.date} (${credit.amount.toLocaleString('fr-FR')} FCFA)`,
      linkedMovementId: creditId,
    }
    const r = reduceAccount(person, side, amount, choice)
    const extra = r.excess > 0 ? excessMovements(person, side, r.excess, choice ?? 'plus_tard', ret.id, `le retour du ${ret.date}`) : []
    setMovements(prev => [...extra, ret, ...prev])
    setPersons(prev => prev.map(p => (p.id === person.id ? r.updated : p)))
  }

  // PAIE : arrêter ou annuler le mois en cours. Si l'employé avait déjà reçu plus que le nouveau
  // « à payer », le surplus sort du salaire (ligne « Trop reçu ») et devient une avance, ou il est noté rendu.
  const settleSurplus = (
    emp: Person,
    period: string,
    next: Movement[],
    states: Record<string, 'arrete' | 'annule'>,
    choice?: 'avance' | 'rendu'
  ) => {
    const after = payrollOf(emp.id, next, states)
    const surplus = after.surplus
    if (surplus <= 0) return next
    // Quels versements tombaient sur ce mois avant, et n'y tombent plus : c'est le trop reçu.
    const beforeRow = payrollOf(emp.id, movements, monthStates).months.find(r => r.period === period)
    const afterRow = after.months.find(r => r.period === period)
    const partOf = (row: typeof afterRow, id: string) => row?.paymentParts.filter(p => p.mov.id === id).reduce((a, p) => a + p.amount, 0) ?? 0
    let left = surplus
    const parts: { id: string; amount: number }[] = []
    for (const p of [...(beforeRow?.paymentParts ?? [])].reverse()) {
      const out = Math.min(left, p.amount - partOf(afterRow, p.mov.id))
      if (out > 0) {
        parts.unshift({ id: p.mov.id, amount: out })
        left -= out
      }
    }
    const month = ofMonth(period)
    const date = todayStr()
    const stamp = Date.now()
    const extra: Movement[] = [
      {
        id: `mov-surplus-${stamp}`,
        personId: emp.id,
        personName: emp.name,
        type: 'surplus_salaire',
        label: choice === 'rendu' ? `Trop reçu sur le salaire ${month} : rendu` : `Trop reçu sur le salaire ${month} : passé en avance`,
        amount: surplus,
        date,
        period,
        parts,
        note: `Le salaire ${month} a été ${states[monthKey(emp.id, period)] === 'annule' ? 'annulé' : 'arrêté'} après des versements.`,
      },
    ]
    if (choice !== 'rendu') {
      extra.push({
        id: `mov-surplus-adv-${stamp}`,
        personId: emp.id,
        personName: emp.name,
        type: 'avance_salaire',
        label: `Trop reçu sur le salaire ${month}`,
        amount: surplus,
        date,
        note: `Versé pour le salaire ${month}, ${states[monthKey(emp.id, period)] === 'annule' ? 'annulé' : 'arrêté'} ensuite : à rendre comme une avance.`,
      })
    }
    return [...extra, ...next]
  }

  // Clôture du mois : la retenue prévue est inscrite pour ce qu'elle vaut vraiment
  // (limitée à l'avance à rendre, baissée si on a versé plus que le salaire moins la retenue).
  const stopMonth: StoreContextType['stopMonth'] = (empId, period, newBase, basisLabel, surplus) => {
    const emp = persons.find(p => p.id === empId)
    if (!emp || period !== currentPeriod()) return
    const { next, states } = planStopMonth(empId, movements, monthStates, period, newBase, basisLabel, todayStr())
    commitEmployee(empId, settleSurplus(emp, period, next, states, surplus), states)
  }

  const cancelMonth: StoreContextType['cancelMonth'] = (empId, period, reason, surplus) => {
    const emp = persons.find(p => p.id === empId)
    if (!emp || period !== currentPeriod()) return
    const { next, states } = planCancelMonth(empId, movements, monthStates, period, reason, todayStr())
    commitEmployee(empId, settleSurplus(emp, period, next, states, surplus), states)
  }

  // Retenue d'avance du mois en cours : remplacée par un nouveau montant (0 = pas de retenue ce mois-ci).
  // Elle ne peut pas dépasser ce qui reste à rendre sur les avances.
  // Retenue d'avance prévue sur le mois en cours : on change son montant sur place (pas d'annulation
  // ni de nouvelle ligne), sans dépasser ce qui reste à rendre. 0 = pas de retenue ce mois-ci.
  const replaceCurrentRetenue = (empId: string, perMonth: number, base: Movement[] = movements, usualOverride?: number): Movement[] => {
    const emp = persons.find(p => p.id === empId)
    const cur = currentPeriod()
    if (!emp || monthStates[monthKey(empId, cur)]) return base
    const planned = base.find(m => m.personId === empId && m.type === 'retenue_salaire' && m.period === cur)
    const amount = Math.min(perMonth, payrollOf(empId, base, monthStates).advanceReste)
    const usual = usualOverride ?? emp.advanceDeductionPerPeriod ?? 0
    const note = amount !== usual && usual > 0 ? `Montant changé (au lieu de ${usual.toLocaleString('fr-FR')} FCFA)` : 'Retenue automatique'
    if (planned) {
      return base.map(m =>
        m.id === planned.id
          ? amount > 0
            ? { ...m, amount, note, isCancelled: false, cancellationReason: undefined, cancelledAt: undefined }
            : { ...m, isCancelled: true, cancellationReason: 'Pas de retenue ce mois-ci', cancelledAt: todayStr() }
          : m
      )
    }
    if (amount <= 0) return base
    return [
      {
        id: `mov-ret-${Date.now()}`,
        personId: empId,
        personName: emp.name,
        type: 'retenue_salaire' as const,
        label: "Retenue pour l'avance",
        amount,
        // datée du 1er du mois, comme les autres retenues automatiques
        date: `01/${cur.slice(5)}/${cur.slice(0, 4)}`,
        period: cur,
        note,
      },
      ...base,
    ]
  }

  const setAdvancePlan: StoreContextType['setAdvancePlan'] = (empId, perMonth) => {
    const emp = persons.find(p => p.id === empId)
    if (!emp) return
    // La nouvelle façon de rendre devient la référence : la retenue prévue la suit, sans « au lieu de ».
    const next = replaceCurrentRetenue(empId, perMonth, movements, perMonth)
    setMovements(next)
    setPersons(prev => prev.map(p => (p.id === empId ? syncEmployee({ ...p, advanceDeductionPerPeriod: perMonth }, next, monthStates) : p)))
  }

  // Seulement ce mois-ci : plus ou moins que la retenue prévue (la façon de rendre ne change pas).
  const setMonthRetenue: StoreContextType['setMonthRetenue'] = (empId, amount) => {
    commitEmployee(empId, replaceCurrentRetenue(empId, amount))
  }

  // COMPENSATION : chacun « verse » à l'autre le plus petit des deux montants.
  // Deux versements liés, motif « Compensation » : un dans son compte, un dans le mien.
  const applyCompensation = (partnerId: string) => {
    const partner = persons.find(p => p.id === partnerId)
    if (!partner || partner.type !== 'partner') return

    const compAmount = Math.min(partner.owesMe || 0, partner.iOweHim || 0)
    if (compAmount <= 0) return

    const dateStr = todayStr()
    const stamp = Date.now()
    const id1 = `mov-comp-lui-${stamp}`
    const id2 = `mov-comp-moi-${stamp}`
    const note = `Compensation de ${compAmount.toLocaleString('fr-FR')} FCFA entre son compte et mon compte`

    const m1: Movement = {
      id: id1,
      personId: partner.id,
      personName: partner.name,
      type: 'il_m_a_verse',
      label: 'Compensation',
      amount: compAmount,
      date: dateStr,
      paymentMethod: 'compensation',
      note,
      linkedMovementId: id2,
    }
    const m2: Movement = { ...m1, id: id2, type: 'je_lui_ai_verse', linkedMovementId: id1 }

    setMovements(prev => [m1, m2, ...prev])
    setPersons(prev => prev.map(p => {
      if (p.id !== partnerId) return p
      return {
        ...p,
        owesMe: (p.owesMe || 0) - compAmount,
        iOweHim: (p.iOweHim || 0) - compAmount,
        lastPaymentDate: dateStr,
        lastPaidByMeDate: dateStr,
      }
    }))

    closeCompensation()
  }

  // DÉPART D'UN EMPLOYÉ : le mois en cours est arrêté, l'avance est réglée selon le choix,
  // l'employé passe « Parti ». Ce qui reste à lui verser se verse ensuite comme d'habitude.
  const processDeparture: StoreContextType['processDeparture'] = (employeeId, newBase, basisLabel, advanceChoice, note) => {
    const emp = persons.find(p => p.id === employeeId)
    if (!emp || emp.type !== 'employee') return
    const date = todayStr()
    const stamp = Date.now()
    const sim = simulateDeparture(employeeId, movements, monthStates, newBase, basisLabel, date, stamp)
    let next = sim.stopped ? settleSurplus(emp, currentPeriod(), sim.next, sim.states, 'avance') : sim.next
    const pr = payrollOf(employeeId, next, sim.states)
    let left = pr.advanceReste
    const extra: Movement[] = []
    if (advanceChoice === 'retenir') {
      // Retirée de ce qu'il reste à lui verser, du mois le plus récent au plus ancien
      for (const r of pr.months) {
        if (left <= 0) break
        const cut = Math.min(left, r.reste)
        if (cut <= 0) continue
        extra.push({
          id: `mov-dep-ret-${stamp}-${r.period}`,
          personId: emp.id,
          personName: emp.name,
          type: 'retenue_salaire',
          label: "Retenue pour l'avance (départ)",
          amount: cut,
          date,
          period: r.period,
          note: 'Avance retirée du salaire au départ',
        })
        left -= cut
      }
    } else if (advanceChoice === 'laisser' && left > 0) {
      extra.push({
        id: `mov-dep-laisse-${stamp}`,
        personId: emp.id,
        personName: emp.name,
        type: 'remboursement_direct',
        label: 'Avance laissée au départ',
        amount: left,
        date,
        note: note?.trim() || undefined,
      })
    }
    next = [...extra, ...next]
    setMovements(next)
    setMonthStates(sim.states)
    setPersons(prev =>
      prev.map(p => (p.id === employeeId ? syncEmployee({ ...p, status: 'inactif', notes: `${p.notes || ''} [Parti le ${date}]`.trim() }, next, sim.states) : p))
    )
    closeDeparture()
  }

  // AGGREGATED METRICS
  const partnersOwesMe = persons.filter(p => p.type === 'partner').reduce((acc, p) => acc + (p.owesMe || 0), 0)
  const partnersIOwe = persons.filter(p => p.type === 'partner').reduce((acc, p) => acc + (p.iOweHim || 0), 0)
  
  // Salaire encore dû, y compris aux employés partis
  const employeesSalaryDue = persons.filter(p => p.type === 'employee').reduce((acc, p) => acc + (p.currentSalaryDue || 0), 0)
  const employeesAdvanceOwed = persons.filter(p => p.type === 'employee').reduce((acc, p) => acc + (p.advanceBalance || 0), 0)

  // Un module coupé ne compte pas dans les totaux (ses données restent)
  const totalOwesMe = (modules.personnes ? partnersOwesMe : 0) + (modules.employes ? employeesAdvanceOwed : 0)
  const totalIOwe = (modules.personnes ? partnersIOwe : 0) + (modules.employes ? employeesSalaryDue : 0)

  const soonSalariesDueCount = persons.filter(p => p.type === 'employee' && p.status === 'actif' && (p.currentSalaryDue || 0) > 0).length
  const latePartnersCount = persons.filter(p => p.type === 'partner' && (p.owesMe || 0) > 0 && (p.daysSinceLastPayment || 0) >= 30).length

  // CSV EXPORT
  const updatePerson: StoreContextType['updatePerson'] = (id, changes) => {
    setPersons(prev => prev.map(p => (p.id === id ? { ...p, ...changes } : p)))
    // Le nom est aussi recopié dans ses opérations, pour que l'historique reste juste.
    if (changes.name) {
      setMovements(prev => prev.map(m => (m.personId === id ? { ...m, personName: changes.name as string } : m)))
    }
  }

  const addPerson: StoreContextType['addPerson'] = data => {
    const id = `${data.type === 'employee' ? 'emp' : 'part'}-${Date.now()}`
    const today = new Date()
    const startDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`
    const person: Person =
      data.type === 'employee'
        ? {
            id,
            type: 'employee',
            name: data.name,
            phone: data.phone,
            role: data.role,
            salary: data.salary,
            dueDay: data.dueDay,
            frequency: 'mensuel',
            startDate: data.start ? `${String(data.start.day).padStart(2, '0')}/${startDate.slice(3)}` : startDate,
            status: 'actif',
            currentSalaryDue: 0,
            advanceBalance: 0,
            advanceDeductionPerPeriod: data.advance && data.perMonth ? data.perMonth : undefined,
          }
        : { id, type: 'partner', name: data.name, phone: data.phone, role: data.role, owesMe: 0, iOweHim: 0 }
    if (person.type !== 'employee') {
      setPersons(prev => [...prev, person])
      return id
    }
    // Employé : son premier mois, et ce qu'il apporte d'avant (ancien compte, avance)
    const cur = currentPeriod()
    const base = { personId: id, personName: data.name, date: startDate }
    const extra: Movement[] = [
      {
        ...base,
        id: `mov-sal-${id}-${cur}`,
        type: 'salaire_du',
        label: data.start ? `Salaire de base (${data.start.label})` : 'Salaire de base',
        amount: data.start ? data.start.amount : data.salary || 0,
        period: cur,
      },
    ]
    if (data.oldDebt && data.oldDebt > 0)
      extra.push({ ...base, id: `mov-old-${id}`, type: 'ajout_salaire', label: 'Ajout : ancien compte', amount: data.oldDebt, period: cur, note: "Ce qu'on lui devait déjà avant" })
    if (data.advance && data.advance > 0) {
      extra.push({ ...base, id: `mov-adv-${id}`, type: 'avance_salaire', label: 'Anciennes avances', amount: data.advance, note: 'Ce qu’il devait encore avant son entrée dans le carnet' })
      if (data.perMonth && data.perMonth > 0)
        extra.push({ ...base, id: `mov-ret-${id}-${cur}`, type: 'retenue_salaire', label: "Retenue pour l'avance", amount: Math.min(data.perMonth, data.advance), period: cur, note: 'Retenue automatique' })
    }
    const next = [...extra, ...movements]
    setMovements(next)
    setPersons(prev => [...prev, syncEmployee(person, next, monthStates)])
    return id
  }

  const exportCSV = () => {
    let csv = "ID;Type;Personne;Montant FCFA;Date;Moyen Paiement;Annule;Note\n"
    movements.forEach(m => {
      csv += `${m.id};${m.type};"${m.personName}";${m.amount};${m.date};${m.paymentMethod || 'non précisé'};${m.isCancelled ? 'OUI' : 'NON'};"${(m.note || '').replace(/"/g, '""')}"\n`
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Carnet_Export_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Adresse ⇄ écran. Changer d'écran ajoute une adresse à l'historique ; le bouton retour
  // (téléphone ou navigateur) revient à l'adresse d'avant, et l'écran suit.
  const screen: Screen = { tab: activeTab, person: selectedPersonId, accounts: accountsView, settings: settingsView }
  const path = buildPath(screen, persons)
  const fromHistory = React.useRef(false)
  React.useEffect(() => {
    if (fromHistory.current) {
      fromHistory.current = false
      if (window.location.pathname !== path) window.history.replaceState(null, '', path)
      return
    }
    const here = window.location.pathname
    if (here === path) return
    // Onglet Personnes / Employés de « Leurs/Mes comptes » : même écran, l'adresse change sans ajouter de retour
    const sameScreen = (x: string) => x.match(/^\/comptes\/(leurs|mes)/)?.[1]
    if (sameScreen(here) && sameScreen(here) === sameScreen(path)) window.history.replaceState(null, '', path)
    else window.history.pushState(null, '', path)
  }, [path])
  const pathRef = React.useRef(path)
  pathRef.current = path
  const lockedRef = React.useRef(isLocked)
  lockedRef.current = isLocked
  const modulesRef = React.useRef(modules)
  modulesRef.current = modules
  const personsRef = React.useRef(persons)
  personsRef.current = persons
  React.useEffect(() => {
    const onPop = () => {
      // Fenêtre ouverte ou app verrouillée : le retour ferme la fenêtre (comme Échap), l'écran ne bouge pas
      if (lockedRef.current || document.querySelector('[role="dialog"]')) {
        if (!lockedRef.current) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        window.history.pushState(null, '', pathRef.current)
        return
      }
      const next = parsePath(window.location.pathname, modulesRef.current, personsRef.current)
      const nextPath = buildPath(next, personsRef.current)
      if (nextPath === pathRef.current) {
        // Adresse inconnue ou même écran : on corrige seulement l'adresse
        if (window.location.pathname !== nextPath) window.history.replaceState(null, '', nextPath)
        return
      }
      fromHistory.current = true
      setActiveTabRaw(next.tab)
      setSelectedPersonId(next.person)
      setAccountsView(next.accounts)
      setSettingsView(next.settings)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return (
    <StoreContext.Provider
      value={{
        shop,
        setShopName,
        setShopPin,
        isLocked,
        unlockWithPin,
        lockApp,
        theme,
        toggleTheme,
        modules,
        setModule,
        activeTab,
        setActiveTab,
        navigate,
        navKey,
        selectedPersonId,
        accountsView,
        setAccountsView,
        settingsView,
        setSettingsView,
        setSelectedPersonId,
        isNewMovementOpen,
        openNewMovement,
        closeNewMovement,
        newMovementTargetPersonId,
        newMovementInitialType,
        newMovementSide,
        isDepartureOpen,
        openDeparture,
        closeDeparture,
        departureTargetEmployeeId,
        isCompensationOpen,
        openCompensation,
        closeCompensation,
        compensationTargetPartnerId,
        selectedMovement,
        openMovementDetail,
        closeMovementDetail,
        persons,
        movements,
        addMovement,
        cancelMovement,
        addReturn,
        monthStates,
        stopMonth,
        cancelMonth,
        setAdvancePlan,
        setMonthRetenue,
        applyCompensation,
        processDeparture,
        totals: {
          totalOwesMe,
          totalIOwe,
          partnersOwesMe,
          partnersIOwe,
          employeesSalaryDue,
          employeesAdvanceOwed,
          soonSalariesDueCount,
          latePartnersCount,
        },
        exportCSV,
        updatePerson,
        addPerson,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export const useStore = () => {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useStore must be used within StoreProvider')
  return context
}
