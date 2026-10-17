import React, { createContext, useContext, useState, useEffect } from 'react'
import { type Person, type Movement, INITIAL_SHOP, INITIAL_PERSONS, INITIAL_MOVEMENTS } from './mockData'

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
  
  // Navigation
  activeTab: 'accueil' | 'personnes' | 'employes' | 'reglages'
  setActiveTab: (tab: 'accueil' | 'personnes' | 'employes' | 'reglages') => void
  selectedPersonId: string | null
  setSelectedPersonId: (id: string | null) => void
  
  // Modals state
  isNewMovementOpen: boolean
  openNewMovement: (personId?: string, defaultType?: Movement['type']) => void
  closeNewMovement: () => void
  newMovementTargetPersonId: string | null
  newMovementInitialType: Movement['type'] | null
  
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
  cancelMovement: (id: string, reason: string) => void
  applyCompensation: (partnerId: string) => void
  processDeparture: (
    employeeId: string,
    salaryChoice: 'mois_complet' | 'prorata' | 'fixe',
    customAmount: number,
    advanceChoice: 'retenir' | 'dette' | 'abandonner',
    abandonNote?: string
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
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shop, setShop] = useState(INITIAL_SHOP)
  const [isLocked, setIsLocked] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [activeTab, setActiveTab] = useState<'accueil' | 'personnes' | 'employes' | 'reglages'>('accueil')
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  
  const [persons, setPersons] = useState<Person[]>(INITIAL_PERSONS)
  const [movements, setMovements] = useState<Movement[]>(INITIAL_MOVEMENTS)
  
  // Modals
  const [isNewMovementOpen, setIsNewMovementOpen] = useState(false)
  const [newMovementTargetPersonId, setNewMovementTargetPersonId] = useState<string | null>(null)
  const [newMovementInitialType, setNewMovementInitialType] = useState<Movement['type'] | null>(null)
  
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
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
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

  const openNewMovement = (personId?: string, defaultType?: Movement['type']) => {
    setNewMovementTargetPersonId(personId || null)
    setNewMovementInitialType(defaultType || null)
    setIsNewMovementOpen(true)
  }

  const closeNewMovement = () => {
    setIsNewMovementOpen(false)
    setNewMovementTargetPersonId(null)
    setNewMovementInitialType(null)
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
        } else if (newMov.type === 'je_lui_ai_verse') {
          updated.iOweHim = Math.max(0, iOweHim - amt)
          updated.lastPaidByMeDate = dateStr
        } else if (newMov.type === 'j_ai_pris_credit') {
          updated.iOweHim = iOweHim + amt
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

  // CANCEL MOVEMENT (NEVER DELETE)
  const cancelMovement = (id: string, reason: string) => {
    const today = new Date()
    const cancelledAt = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()} ${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`

    const targetMov = movements.find(m => m.id === id)
    if (!targetMov || targetMov.isCancelled) return

    setMovements(prev => prev.map(m => {
      if (m.id === id) {
        return {
          ...m,
          isCancelled: true,
          cancellationReason: reason,
          cancelledAt,
        }
      }
      return m
    }))

    // Reverse counters for this person
    setPersons(prev => prev.map(p => {
      if (p.id !== targetMov.personId) return p
      const updated = { ...p }
      const amt = targetMov.amount

      if (p.type === 'partner') {
        const owesMe = updated.owesMe || 0
        const iOweHim = updated.iOweHim || 0

        if (targetMov.type === 'il_m_a_verse') {
          updated.owesMe = owesMe + amt
        } else if (targetMov.type === 'il_a_pris_credit') {
          updated.owesMe = Math.max(0, owesMe - amt)
        } else if (targetMov.type === 'je_lui_ai_verse') {
          updated.iOweHim = iOweHim + amt
        } else if (targetMov.type === 'j_ai_pris_credit') {
          updated.iOweHim = Math.max(0, iOweHim - amt)
        }
      } else if (p.type === 'employee') {
        const currentSalary = updated.currentSalaryDue || 0
        const advance = updated.advanceBalance || 0

        if (targetMov.type === 'je_lui_ai_verse') {
          updated.currentSalaryDue = currentSalary + amt
        } else if (targetMov.type === 'avance_salaire') {
          updated.advanceBalance = Math.max(0, advance - amt)
        } else if (targetMov.type === 'remboursement_direct') {
          updated.advanceBalance = advance + amt
        } else if (targetMov.type === 'retenue_salaire') {
          updated.currentSalaryDue = currentSalary + amt
          updated.advanceBalance = advance + amt
        }
      }
      return updated
    }))

    if (selectedMovement && selectedMovement.id === id) {
      setSelectedMovement(prev => prev ? { ...prev, isCancelled: true, cancellationReason: reason, cancelledAt } : null)
    }
  }

  // APPLY MUTUAL DEBT COMPENSATION
  const applyCompensation = (partnerId: string) => {
    const partner = persons.find(p => p.id === partnerId)
    if (!partner || partner.type !== 'partner') return

    const owesMe = partner.owesMe || 0
    const iOweHim = partner.iOweHim || 0
    const compAmount = Math.min(owesMe, iOweHim)

    if (compAmount <= 0) return

    const today = new Date()
    const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`
    const movId1 = `mov-comp-1-${Date.now()}`
    const movId2 = `mov-comp-2-${Date.now()}`

    const m1: Movement = {
      id: movId1,
      personId: partner.id,
      personName: partner.name,
      type: 'compensation',
      label: 'Compensation mutuelle (Diminue Il me doit)',
      amount: compAmount,
      date: dateStr,
      note: `Compensation bilatérale appliquée à hauteur de ${compAmount.toLocaleString()} FCFA`,
      linkedMovementId: movId2,
    }

    const m2: Movement = {
      id: movId2,
      personId: partner.id,
      personName: partner.name,
      type: 'compensation',
      label: 'Compensation mutuelle (Diminue Je lui dois)',
      amount: compAmount,
      date: dateStr,
      note: `Compensation bilatérale appliquée à hauteur de ${compAmount.toLocaleString()} FCFA`,
      linkedMovementId: movId1,
    }

    setMovements(prev => [m1, m2, ...prev])

    setPersons(prev => prev.map(p => {
      if (p.id !== partnerId) return p
      return {
        ...p,
        owesMe: (p.owesMe || 0) - compAmount,
        iOweHim: (p.iOweHim || 0) - compAmount,
      }
    }))

    closeCompensation()
  }

  // PROCESS DEPARTURE
  const processDeparture = (
    employeeId: string,
    salaryChoice: 'mois_complet' | 'prorata' | 'fixe',
    customAmount: number,
    advanceChoice: 'retenir' | 'dette' | 'abandonner',
    abandonNote?: string
  ) => {
    const emp = persons.find(p => p.id === employeeId)
    if (!emp || emp.type !== 'employee') return

    const today = new Date()
    const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`
    
    let finalSalary = customAmount
    const advanceLeft = emp.advanceBalance || 0
    let finalNetToPay = finalSalary

    if (advanceChoice === 'retenir') {
      finalNetToPay = Math.max(0, finalSalary - advanceLeft)
    }

    // Add movement for final settlement
    const settlementMov: Movement = {
      id: `mov-dep-${Date.now()}`,
      personId: emp.id,
      personName: emp.name,
      type: 'je_lui_ai_verse',
      label: `Solde tout compte départ (${salaryChoice === 'prorata' ? 'Prorata' : salaryChoice === 'mois_complet' ? 'Mois complet' : 'Montant fixe'})`,
      amount: finalNetToPay,
      date: dateStr,
      paymentMethod: 'especes',
      note: `Départ définitif de l'employé. Avance restante (${advanceLeft.toLocaleString()} FCFA) : ${advanceChoice === 'retenir' ? 'Retenue sur solde' : advanceChoice === 'dette' ? 'Conservée comme dette' : `Abandonnée (${abandonNote || 'accord amiable'})`}.`,
    }

    setMovements(prev => [settlementMov, ...prev])

    setPersons(prev => prev.map(p => {
      if (p.id !== employeeId) return p
      return {
        ...p,
        status: 'inactif',
        currentSalaryDue: 0,
        advanceBalance: advanceChoice === 'dette' ? advanceLeft : 0,
        notes: `${p.notes || ''} [DÉPART LE ${dateStr} - Statut Inactif]`,
      }
    }))

    closeDeparture()
  }

  // AGGREGATED METRICS
  const partnersOwesMe = persons.filter(p => p.type === 'partner').reduce((acc, p) => acc + (p.owesMe || 0), 0)
  const partnersIOwe = persons.filter(p => p.type === 'partner').reduce((acc, p) => acc + (p.iOweHim || 0), 0)
  
  const employeesSalaryDue = persons.filter(p => p.type === 'employee' && p.status === 'actif').reduce((acc, p) => acc + (p.currentSalaryDue || 0), 0)
  const employeesAdvanceOwed = persons.filter(p => p.type === 'employee').reduce((acc, p) => acc + (p.advanceBalance || 0), 0)

  const totalOwesMe = partnersOwesMe + employeesAdvanceOwed
  const totalIOwe = partnersIOwe + employeesSalaryDue

  const soonSalariesDueCount = persons.filter(p => p.type === 'employee' && p.status === 'actif' && (p.currentSalaryDue || 0) > 0).length
  const latePartnersCount = persons.filter(p => p.type === 'partner' && (p.owesMe || 0) > 0 && (p.daysSinceLastPayment || 0) >= 30).length

  // CSV EXPORT
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
        activeTab,
        setActiveTab,
        selectedPersonId,
        setSelectedPersonId,
        isNewMovementOpen,
        openNewMovement,
        closeNewMovement,
        newMovementTargetPersonId,
        newMovementInitialType,
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
