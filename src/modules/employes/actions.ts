// Opérations de la paie qui touchent plusieurs lignes : nouvel employé, trop reçu, retenue du mois,
// départ. Fonctions sans effet : elles reçoivent l'état et rendent le nouvel état. Le store les applique.
import type { Movement, Person } from '@/data/mockData'
import { currentPeriod, monthKey, ofMonth, payrollOf, periodStartStr, setDueDay, simulateDeparture, syncEmployee } from './payroll'

export type MonthStates = Record<string, 'arrete' | 'annule'>

// Mois arrêté ou annulé : si l'employé avait déjà reçu plus que le nouveau « à payer », le surplus sort
// du salaire (ligne « Trop reçu ») et devient une avance, ou il est noté rendu.
export function settleSurplus(
  emp: Person,
  period: string,
  before: { movements: Movement[]; monthStates: MonthStates },
  next: Movement[],
  states: MonthStates,
  choice: 'avance' | 'rendu' | undefined,
  date: string,
  stamp: number
): Movement[] {
  const after = payrollOf(emp.id, next, states)
  const surplus = after.surplus
  if (surplus <= 0) return next
  // Quels versements tombaient sur ce mois avant, et n'y tombent plus : c'est le trop reçu.
  const beforeRow = payrollOf(emp.id, before.movements, before.monthStates).months.find(r => r.period === period)
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
  const how = states[monthKey(emp.id, period)] === 'annule' ? 'annulé' : 'arrêté'
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
      note: `Le salaire ${month} a été ${how} après des versements.`,
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
      note: `Versé pour le salaire ${month}, ${how} ensuite : à rendre comme une avance.`,
    })
  }
  return [...extra, ...next]
}

// Retenue d'avance prévue sur le mois en cours : on change son montant sur place (pas d'annulation
// ni de nouvelle ligne), sans dépasser ce qui reste à rendre. 0 = pas de retenue ce mois-ci.
export function replaceCurrentRetenue(
  emp: Person,
  perMonth: number,
  base: Movement[],
  monthStates: MonthStates,
  date: string,
  stamp: number,
  usualOverride?: number
): Movement[] {
  const empId = emp.id
  const cur = currentPeriod(empId)
  if (monthStates[monthKey(empId, cur)]) return base
  const planned = base.find(m => m.personId === empId && m.type === 'retenue_salaire' && m.period === cur)
  const amount = Math.min(perMonth, payrollOf(empId, base, monthStates).advanceReste)
  const usual = usualOverride ?? emp.advanceDeductionPerPeriod ?? 0
  const note = amount !== usual && usual > 0 ? `Montant changé (au lieu de ${usual.toLocaleString('fr-FR')} FCFA)` : 'Retenue automatique'
  if (planned) {
    return base.map(m =>
      m.id === planned.id
        ? amount > 0
          ? { ...m, amount, note, isCancelled: false, cancellationReason: undefined, cancelledAt: undefined }
          : { ...m, isCancelled: true, cancellationReason: 'Pas de retenue ce mois-ci', cancelledAt: date }
        : m
    )
  }
  if (amount <= 0) return base
  return [
    {
      id: `mov-ret-${stamp}`,
      personId: empId,
      personName: emp.name,
      type: 'retenue_salaire' as const,
      label: "Retenue pour l'avance",
      amount,
      // datée du début de la période, comme les autres retenues automatiques
      date: periodStartStr(cur, empId),
      period: cur,
      note,
    },
    ...base,
  ]
}

// Départ d'un employé : le mois en cours est arrêté, l'avance est réglée selon le choix,
// l'employé passe « Parti ». Ce qui reste à lui verser se verse ensuite comme d'habitude.
export function planDeparture(
  emp: Person,
  movements: Movement[],
  monthStates: MonthStates,
  newBase: number | null,
  basisLabel: string,
  advanceChoice: 'retenir' | 'dette' | 'laisser',
  note: string | undefined,
  date: string,
  stamp: number
) {
  const sim = simulateDeparture(emp.id, movements, monthStates, newBase, basisLabel, date, stamp)
  let next = sim.stopped ? settleSurplus(emp, currentPeriod(emp.id), { movements, monthStates }, sim.next, sim.states, 'avance', date, stamp) : sim.next
  const pr = payrollOf(emp.id, next, sim.states)
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
  const person = syncEmployee({ ...emp, status: 'inactif', notes: `${emp.notes || ''} [Parti le ${date}]`.trim() }, next, sim.states)
  return { movements: next, states: sim.states, person }
}

export type NewEmployee = {
  name: string
  phone: string
  role?: string
  salary?: number
  dueDay?: number
  // Arrivé en cours de période (jj/mm/aaaa) ; absent : la période compte en entière
  start?: { date: string; amount: number; label: string }
  oldDebt?: number // ce qu'on lui devait déjà
  advance?: number // ses anciennes avances
  perMonth?: number // retenue par mois pour les rendre
}

// Nouvel employé : sa fiche, sa première période de paie (selon son jour de paie), et ce qu'il apporte d'avant
export function planNewEmployee(id: string, data: NewEmployee, today: string) {
  const person: Person = {
    id,
    type: 'employee',
    name: data.name,
    phone: data.phone,
    role: data.role,
    salary: data.salary,
    dueDay: data.dueDay,
    frequency: 'mensuel',
    startDate: data.start?.date ?? today,
    status: 'actif',
    currentSalaryDue: 0,
    advanceBalance: 0,
    advanceDeductionPerPeriod: data.advance && data.perMonth ? data.perMonth : undefined,
  }
  setDueDay(id, data.dueDay)
  const cur = currentPeriod(id)
  const base = { personId: id, personName: data.name, date: today }
  const added: Movement[] = [
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
    added.push({ ...base, id: `mov-old-${id}`, type: 'ajout_salaire', label: 'Ajout : ancien compte', amount: data.oldDebt, period: cur, note: "Ce qu'on lui devait déjà avant" })
  if (data.advance && data.advance > 0) {
    added.push({ ...base, id: `mov-adv-${id}`, type: 'avance_salaire', label: 'Anciennes avances', amount: data.advance, note: 'Ce qu’il devait encore avant son entrée dans le carnet' })
    if (data.perMonth && data.perMonth > 0)
      added.push({ ...base, id: `mov-ret-${id}-${cur}`, type: 'retenue_salaire', label: "Retenue pour l'avance", amount: Math.min(data.perMonth, data.advance), period: cur, note: 'Retenue automatique' })
  }
  return { person, added }
}

// Totaux des employés (salaire encore dû, y compris aux employés partis ; avances à rendre)
export const employeeTotals = (persons: Person[]) => {
  const employees = persons.filter(p => p.type === 'employee')
  return {
    employeesSalaryDue: employees.reduce((a, p) => a + (p.currentSalaryDue || 0), 0),
    employeesAdvanceOwed: employees.reduce((a, p) => a + (p.advanceBalance || 0), 0),
    soonSalariesDueCount: employees.filter(p => p.status === 'actif' && (p.currentSalaryDue || 0) > 0).length,
  }
}
