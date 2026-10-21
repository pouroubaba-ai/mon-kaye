// Le « store » : l'état de l'app (boutique, personnes, opérations, écran affiché, fenêtres ouvertes)
// et les actions du comptoir. Il ne calcule presque rien lui-même : les règles sont dans les modules
//   - src/modules/personnes      comptes des partenaires (crédits, versements, retours, compensation)
//   - src/modules/employes       paie (périodes, salaires, avances, retenues, départ)
//   - src/modules/mouvements     dates, identifiants, export
//   - src/modules/navigation     adresses des écrans, bouton retour
//   - src/modules/reglages       modules allumés, thème
//   - src/modules/synchronisation  enregistrement (Firebase)
// Il applique leurs résultats à l'état. Les tests (npm test) vérifient les soldes à chaque changement.
import React, { createContext, useContext, useState, useEffect } from 'react'

import { type Person, type Movement, INITIAL_SHOP, INITIAL_PERSONS, INITIAL_MOVEMENTS } from './mockData'
import {
  buildPayrollSeed,
  currentPeriod,
  employeeTotals,
  missingMonths,
  planCancelMonth,
  planDeparture,
  planNewEmployee,
  planStopMonth,
  replaceCurrentRetenue,
  settleSurplus,
  syncEmployee,
  type MonthStates,
  type NewEmployee,
} from '@/modules/employes'
import { applyMovement, partnerTotals, planCancel, planCompensation, planReturn, type ExcessChoice } from '@/modules/personnes'
import { downloadCsv, markCancelled, newId, nowStamp, todayStr } from '@/modules/mouvements'
import { parsePath, useHistorySync, type AccountsView, type Screen, type Tab } from '@/modules/navigation'
import { cleanModules, loadModulesLocal, loadTheme, saveModulesLocal, saveTheme, type Modules, type Theme } from '@/modules/reglages'

// Anciens imports : ces noms restent disponibles depuis le store
export { returnedOn, excessOf, type ExcessChoice } from '@/modules/personnes'
export { parsePath, buildPath } from '@/modules/navigation'
export { resetModulesLocal, DEFAULT_MODULES as NEW_ACCOUNT_MODULES, type Modules } from '@/modules/reglages'

interface StoreContextType {
  shop: typeof INITIAL_SHOP
  setShopName: (name: string) => void

  theme: Theme
  toggleTheme: () => void

  // Modules : Partenaires et Employés. Un module coupé est seulement caché (ses données restent).
  modules: Modules
  setModule: (key: keyof Modules, on: boolean) => void

  // Navigation
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  // Bouton du menu : ferme la fiche ouverte, va à la page et remonte en haut (navKey change à chaque appui).
  navigate: (tab: Tab) => void
  navKey: number
  selectedPersonId: string | null
  setSelectedPersonId: (id: string | null) => void
  // Écran ouvert depuis le tableau de bord : « Leurs comptes » ou « Mes comptes », et le côté choisi.
  accountsView: AccountsView | null
  setAccountsView: (v: AccountsView | null) => void
  // Réglages : la page principale ou la page « Modules » (une vraie page, avec retour)
  settingsView: 'main' | 'modules'
  setSettingsView: (v: 'main' | 'modules') => void

  // Fenêtres
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

  // Données
  persons: Person[]
  movements: Movement[]
  addMovement: (movement: Omit<Movement, 'id' | 'date'> & { date?: string }) => void
  // excess : que faire si l'annulation fait passer le compte sous zéro (il a trop versé).
  cancelMovement: (id: string, reason: string, excess?: ExcessChoice) => void
  // Retour de marchandise sur un crédit (le sien ou le mien), sans argent.
  addReturn: (creditId: string, amount: number, excess?: ExcessChoice) => void
  // Paie : état particulier d'un mois (arrêté, annulé) ; clé « employé|2026-10 »
  monthStates: MonthStates
  // Mois en cours seulement. surplus : ce que devient le trop reçu (« avance » ou « rendu »)
  stopMonth: (empId: string, period: string, newBase: number, basisLabel: string, surplus?: 'avance' | 'rendu') => void
  cancelMonth: (empId: string, period: string, reason: string, surplus?: 'avance' | 'rendu') => void
  // Façon de rendre les avances : retenue par mois (0 = il rend directement). Met à jour la retenue du mois en cours.
  setAdvancePlan: (empId: string, perMonth: number) => void
  setMonthRetenue: (empId: string, amount: number) => void
  applyCompensation: (partnerId: string) => void
  processDeparture: (employeeId: string, newBase: number | null, basisLabel: string, advanceChoice: 'retenir' | 'dette' | 'laisser', note?: string) => void

  // Totaux
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
  logout: () => void
  isDemo: boolean
  // Supprimer une personne ou un employé : sa fiche et tout son historique, pour toujours
  deletePerson: (id: string) => void
  // Modifier les informations d'une personne (nom, numéro, rôle, salaire…)
  updatePerson: (id: string, changes: Partial<Pick<Person, 'name' | 'phone' | 'role' | 'salary' | 'dueDay'>>) => void
  // Ajouter une personne ou un employé ; renvoie son identifiant
  addPerson: (data: { type: 'partner' | 'employee' } & NewEmployee) => string
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

// Données d'un vrai compte (venues de Firebase) ; sans elles : la démonstration
export type StoreData = {
  shop: { name: string; modules?: Modules }
  persons: Person[]
  movements: Movement[]
  monthStates: MonthStates
}

export const StoreProvider: React.FC<{
  children: React.ReactNode
  data?: StoreData // vrai compte ; absent : démonstration
  persist?: (d: StoreData) => void // enregistre chaque changement (Firebase)
  onLogout?: () => void
}> = ({ children, data, persist, onLogout }) => {
  const [shop, setShop] = useState(() => (data ? { ...INITIAL_SHOP, owner: '', phone: '', address: '', name: data.shop.name } : INITIAL_SHOP))
  const [theme, setTheme] = useState<Theme>(loadTheme)

  // ——— Modules : ceux enregistrés dans le compte ; un ancien compte qui n'en a pas encore reprend ceux du téléphone
  const initialModules = React.useRef<Modules>(data?.shop.modules ? cleanModules(data.shop.modules) : loadModulesLocal()).current
  const [modules, setModules] = useState<Modules>(initialModules)
  useEffect(() => saveModulesLocal(modules), [modules])

  // ——— Écran affiché. Au démarrage : celui de l'adresse (actualiser garde l'écran)
  const start = React.useRef<Screen | null>(null)
  const startScreen = () => (start.current ??= parsePath(window.location.pathname, initialModules, data ? data.persons : INITIAL_PERSONS))
  const [activeTab, setActiveTabRaw] = useState<Tab>(() => startScreen().tab)
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(() => startScreen().person)
  const [accountsView, setAccountsView] = useState<AccountsView | null>(() => startScreen().accounts)
  const [settingsView, setSettingsView] = useState<'main' | 'modules'>(() => startScreen().settings)
  const [navKey, setNavKey] = useState(0)
  // Changer de page referme l'écran « Leurs comptes / Mes comptes ».
  const setActiveTab = (tab: Tab) => {
    setAccountsView(null)
    setSettingsView('main')
    setActiveTabRaw(tab)
  }
  const navigate = (tab: Tab) => {
    setSelectedPersonId(null)
    setActiveTab(tab)
    setNavKey(k => k + 1)
  }
  const show = (s: Screen) => {
    setActiveTabRaw(s.tab)
    setSelectedPersonId(s.person)
    setAccountsView(s.accounts)
    setSettingsView(s.settings)
  }

  const setModule: StoreContextType['setModule'] = (key, on) => {
    const next = { ...modules, [key]: on }
    if (!next.personnes && !next.employes) return // au moins un module allumé
    setModules(next)
    if (!on) {
      // On quitte ce qui vient d'être caché
      setSelectedPersonId(null)
      setAccountsView(null)
      if ((key === 'personnes' && activeTab === 'personnes') || (key === 'employes' && (activeTab === 'employes' || activeTab === 'salaires')))
        setActiveTabRaw('accueil')
    }
  }

  // ——— Données. Démonstration : la paie des employés est reconstituée en opérations (mois, versements,
  // avances), puis les compteurs de chaque employé sont recalculés à partir d'elles.
  const [movements, setMovements] = useState<Movement[]>(() =>
    data ? data.movements : [...INITIAL_MOVEMENTS, ...buildPayrollSeed(INITIAL_PERSONS, INITIAL_MOVEMENTS)]
  )
  const [monthStates, setMonthStates] = useState<MonthStates>(() => (data ? data.monthStates : {}))
  const [persons, setPersons] = useState<Person[]>(() => {
    if (data) return data.persons.map(p => syncEmployee(p, data.movements, data.monthStates))
    const all = [...INITIAL_MOVEMENTS, ...buildPayrollSeed(INITIAL_PERSONS, INITIAL_MOVEMENTS)]
    return INITIAL_PERSONS.map(p => syncEmployee(p, all, {}))
  })
  const setPerson = (p: Person) => setPersons(prev => prev.map(x => (x.id === p.id ? p : x)))

  // Vrai compte : chaque changement est enregistré (sur le téléphone, puis en ligne)
  useEffect(() => {
    persist?.({ shop: { name: shop.name, modules }, persons, movements, monthStates })
  }, [shop.name, modules, persons, movements, monthStates])

  // Nouvelle période : chaque employé actif la commence avec son salaire entier
  useEffect(() => {
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

  // ——— Fenêtres
  const [isNewMovementOpen, setIsNewMovementOpen] = useState(false)
  const [newMovementTargetPersonId, setNewMovementTargetPersonId] = useState<string | null>(null)
  const [newMovementInitialType, setNewMovementInitialType] = useState<Movement['type'] | null>(null)
  const [newMovementSide, setNewMovementSide] = useState<'credit' | 'debt' | null>(null)
  const [departureTargetEmployeeId, setDepartureTargetEmployeeId] = useState<string | null>(null)
  const [compensationTargetPartnerId, setCompensationTargetPartnerId] = useState<string | null>(null)
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null)

  const openNewMovement: StoreContextType['openNewMovement'] = (personId, defaultType, side) => {
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
  const closeDeparture = () => setDepartureTargetEmployeeId(null)
  const closeCompensation = () => setCompensationTargetPartnerId(null)

  // ——— Thème (classe « dark » sur la page)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  const toggleTheme = () =>
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      saveTheme(next)
      return next
    })

  // ——— Actions du comptoir

  const addMovement: StoreContextType['addMovement'] = data => {
    const newMov: Movement = { ...data, id: newId('mov'), date: data.date || todayStr() }
    // Employé : ajout ou retenue rattachés à la période en cours ; compteurs recalculés.
    if (persons.find(p => p.id === newMov.personId)?.type === 'employee') {
      if ((newMov.type === 'ajout_salaire' || newMov.type === 'retenue_manuelle') && !newMov.period) newMov.period = currentPeriod(newMov.personId)
      // Mise à jour à partir de la dernière liste : deux opérations enregistrées d'un coup
      // (versement + avance) ne s'effacent pas l'une l'autre
      setMovements(prev => {
        const next = [newMov, ...prev]
        setPersons(ps => ps.map(p => (p.id === newMov.personId ? syncEmployee(p, next, monthStates) : p)))
        return next
      })
      return
    }
    setMovements(prev => [newMov, ...prev])
    setPersons(prev => prev.map(p => (p.id === newMov.personId ? applyMovement(p, newMov) : p)))
  }

  // Annuler (jamais supprimer) : la ligne reste, barrée, avec la pastille « Annulé ».
  const cancelMovement: StoreContextType['cancelMovement'] = (id, reason, choice) => {
    const at = nowStamp()
    const target = movements.find(m => m.id === id)
    if (!target || target.isCancelled) return
    const person = persons.find(p => p.id === target.personId)
    if (!person) return
    if (person.type === 'employee') {
      // Employé : la ligne est barrée, puis tout est recalculé depuis les opérations.
      commitEmployee(person.id, movements.map(m => (m.id === id ? markCancelled(m, reason, at) : m)))
    } else {
      const plan = planCancel(movements, person, target, reason, choice, todayStr(), Date.now())
      setMovements(prev => [...plan.added, ...prev.map(m => (plan.marks[m.id] !== undefined && (m.id === id || !m.isCancelled) ? markCancelled(m, plan.marks[m.id], at) : m))])
      setPerson(plan.person)
    }
    if (selectedMovement?.id === id) setSelectedMovement(prev => (prev ? markCancelled(prev, reason, at) : null))
  }

  // Retour de marchandise : baisse le compte comme un versement, sans argent ni moyen de paiement.
  const addReturn: StoreContextType['addReturn'] = (creditId, amount, choice) => {
    const credit = movements.find(m => m.id === creditId)
    if (!credit || credit.isCancelled || amount <= 0) return
    const person = persons.find(p => p.id === credit.personId)
    if (!person) return
    const plan = planReturn(person, credit, amount, choice, todayStr(), Date.now())
    setMovements(prev => [...plan.added, ...prev])
    setPerson(plan.person)
  }

  const applyCompensation: StoreContextType['applyCompensation'] = partnerId => {
    const partner = persons.find(p => p.id === partnerId)
    if (!partner || partner.type !== 'partner') return
    const plan = planCompensation(partner, todayStr(), Date.now())
    if (!plan) return
    setMovements(prev => [...plan.added, ...prev])
    setPerson(plan.person)
    closeCompensation()
  }

  // Paie : arrêter ou annuler la période en cours (le trop reçu devient une avance, ou il est noté rendu)
  const stopMonth: StoreContextType['stopMonth'] = (empId, period, newBase, basisLabel, surplus) => {
    const emp = persons.find(p => p.id === empId)
    if (!emp || period !== currentPeriod(empId)) return
    const { next, states } = planStopMonth(empId, movements, monthStates, period, newBase, basisLabel, todayStr())
    commitEmployee(empId, settleSurplus(emp, period, { movements, monthStates }, next, states, surplus, todayStr(), Date.now()), states)
  }
  const cancelMonth: StoreContextType['cancelMonth'] = (empId, period, reason, surplus) => {
    const emp = persons.find(p => p.id === empId)
    if (!emp || period !== currentPeriod(empId)) return
    const { next, states } = planCancelMonth(empId, movements, monthStates, period, reason, todayStr())
    commitEmployee(empId, settleSurplus(emp, period, { movements, monthStates }, next, states, surplus, todayStr(), Date.now()), states)
  }

  // La nouvelle façon de rendre devient la référence : la retenue prévue la suit, sans « au lieu de ».
  const setAdvancePlan: StoreContextType['setAdvancePlan'] = (empId, perMonth) => {
    const emp = persons.find(p => p.id === empId)
    if (!emp) return
    const next = replaceCurrentRetenue(emp, perMonth, movements, monthStates, todayStr(), Date.now(), perMonth)
    setMovements(next)
    setPersons(prev => prev.map(p => (p.id === empId ? syncEmployee({ ...p, advanceDeductionPerPeriod: perMonth }, next, monthStates) : p)))
  }
  // Seulement ce mois-ci : plus ou moins que la retenue prévue (la façon de rendre ne change pas).
  const setMonthRetenue: StoreContextType['setMonthRetenue'] = (empId, amount) => {
    const emp = persons.find(p => p.id === empId)
    if (!emp) return
    commitEmployee(empId, replaceCurrentRetenue(emp, amount, movements, monthStates, todayStr(), Date.now()))
  }

  const processDeparture: StoreContextType['processDeparture'] = (employeeId, newBase, basisLabel, advanceChoice, note) => {
    const emp = persons.find(p => p.id === employeeId)
    if (!emp || emp.type !== 'employee') return
    const plan = planDeparture(emp, movements, monthStates, newBase, basisLabel, advanceChoice, note, todayStr(), Date.now())
    setMovements(plan.movements)
    setMonthStates(plan.states)
    setPerson(plan.person)
    closeDeparture()
  }

  const updatePerson: StoreContextType['updatePerson'] = (id, changes) => {
    setPersons(prev => prev.map(p => (p.id === id ? { ...p, ...changes } : p)))
    // Le nom est aussi recopié dans ses opérations, pour que l'historique reste juste.
    if (changes.name) setMovements(prev => prev.map(m => (m.personId === id ? { ...m, personName: changes.name as string } : m)))
  }

  const deletePerson: StoreContextType['deletePerson'] = id => {
    setSelectedPersonId(null)
    setPersons(prev => prev.filter(p => p.id !== id))
    setMovements(prev => prev.filter(m => m.personId !== id))
    setMonthStates(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(`${id}|`))))
  }

  const addPerson: StoreContextType['addPerson'] = ({ type, ...data }) => {
    const id = newId(type === 'employee' ? 'emp' : 'part')
    if (type !== 'employee') {
      setPersons(prev => [...prev, { id, type: 'partner', name: data.name, phone: data.phone, role: data.role, owesMe: 0, iOweHim: 0 }])
      return id
    }
    const plan = planNewEmployee(id, data, todayStr())
    const next = [...plan.added, ...movements]
    setMovements(next)
    setPersons(prev => [...prev, syncEmployee(plan.person, next, monthStates)])
    return id
  }

  // ——— Totaux (un module coupé ne compte pas ; ses données restent)
  const pt = partnerTotals(persons)
  const et = employeeTotals(persons)
  const totals = {
    ...pt,
    ...et,
    totalOwesMe: (modules.personnes ? pt.partnersOwesMe : 0) + (modules.employes ? et.employeesAdvanceOwed : 0),
    totalIOwe: (modules.personnes ? pt.partnersIOwe : 0) + (modules.employes ? et.employeesSalaryDue : 0),
  }

  // ——— Adresse ⇄ écran, bouton retour
  useHistorySync({ tab: activeTab, person: selectedPersonId, accounts: accountsView, settings: settingsView }, persons, modules, show)

  return (
    <StoreContext.Provider
      value={{
        shop,
        setShopName: name => setShop(prev => ({ ...prev, name })),
        theme,
        toggleTheme,
        modules,
        setModule,
        activeTab,
        setActiveTab,
        navigate,
        navKey,
        selectedPersonId,
        setSelectedPersonId,
        accountsView,
        setAccountsView,
        settingsView,
        setSettingsView,
        isNewMovementOpen,
        openNewMovement,
        closeNewMovement,
        newMovementTargetPersonId,
        newMovementInitialType,
        newMovementSide,
        isDepartureOpen: departureTargetEmployeeId !== null,
        openDeparture: setDepartureTargetEmployeeId,
        closeDeparture,
        departureTargetEmployeeId,
        isCompensationOpen: compensationTargetPartnerId !== null,
        openCompensation: setCompensationTargetPartnerId,
        closeCompensation,
        compensationTargetPartnerId,
        selectedMovement,
        openMovementDetail: setSelectedMovement,
        closeMovementDetail: () => setSelectedMovement(null),
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
        totals,
        exportCSV: () => downloadCsv(movements),
        logout: () => (onLogout ? onLogout() : window.location.assign('/connexion')),
        isDemo: !data,
        updatePerson,
        deletePerson,
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
