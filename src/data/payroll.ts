import type { Movement, Person } from './mockData'

// Paie d'un employé, entièrement calculée à partir des opérations enregistrées.
//
// - Chaque mois porte son salaire de base (« salaire_du »), ses ajouts (prime, heures en plus…)
//   et ses retenues (retenue d'avance automatique, retenue manuelle). À payer = base + ajouts − retenues.
// - Les versements de salaire sont faits sur le compte entier : l'application les répartit
//   du mois le plus ancien au plus récent. Même principe pour les remboursements d'avance.
// - Seul le mois en cours peut être modifié ; les autres sont scellés (on peut seulement les payer).
// - « Surplus » : quand un mois arrêté ou annulé avait déjà reçu trop, la différence est sortie
//   du salaire (ligne « surplus_salaire ») et, si on le choisit, devient une avance.

export type MonthState = 'en_cours' | 'passe' | 'arrete' | 'annule'

export type PayMonthRow = {
  period: string // « 2026-10 »
  label: string // « Oct. 2026 »
  base: number
  ajouts: number
  retenues: number // retenue d'avance + retenues manuelles
  aPayer: number
  verse: number
  reste: number
  etat: 'Payé' | 'En partie' | 'Pas payé' | 'Annulé'
  state: MonthState
  items: Movement[] // toutes les opérations rattachées au mois (annulées comprises)
}

export type AdvanceRow = {
  mov: Movement
  rendu: number
  reste: number
  etat: 'En cours' | 'Soldée' | 'Annulée'
}

export type Payroll = {
  months: PayMonthRow[] // du plus récent au plus ancien
  payments: Movement[] // versements de salaire (et surplus), du plus récent au plus ancien
  totalReste: number
  lastPayment?: string
  advances: AdvanceRow[] // de la plus récente à la plus ancienne
  repayments: Movement[] // remboursements : directs et retenues d'avance
  advanceReste: number
  lastRepayment?: string
  surplus: number // reçu en trop, non encore traité (normalement 0)
}

const SHORT = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']
const LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export const periodOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
export const currentPeriod = () => periodOf(new Date())
export const periodLabel = (p: string) => {
  const [y, m] = p.split('-').map(Number)
  return `${SHORT[m - 1]} ${y}`
}
export const periodLong = (p: string) => {
  const [y, m] = p.split('-').map(Number)
  return `${LONG[m - 1]} ${y}`
}
// « de mars », « d'octobre » : élision devant une voyelle (avril, août, octobre).
export const ofMonth = (p: string) => {
  const name = periodLong(p)
  return /^[aeiouéâ]/i.test(name) ? `d'${name}` : `de ${name}`
}
export const daysInPeriod = (p: string) => {
  const [y, m] = p.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
export const toTime = (d: string) => {
  const [dd, mm, yy] = d.split('/').map(Number)
  return new Date(yy, mm - 1, dd).getTime()
}
const byDateDesc = (a: Movement, b: Movement) => toTime(b.date) - toTime(a.date)
const byDateAsc = (a: Movement, b: Movement) => toTime(a.date) - toTime(b.date)

export const monthKey = (empId: string, period: string) => `${empId}|${period}`

const PERIOD_TYPES = new Set(['salaire_du', 'ajout_salaire', 'retenue_salaire', 'retenue_manuelle'])
const isLive = (m: Movement) => !m.isCancelled

export function payrollOf(
  empId: string,
  movements: Movement[],
  monthStates: Record<string, 'arrete' | 'annule'>,
  today = new Date()
): Payroll {
  const mine = movements.filter(m => m.personId === empId)
  const cur = periodOf(today)

  // 1. Les mois
  const periods = [...new Set(mine.filter(m => m.period && PERIOD_TYPES.has(m.type)).map(m => m.period!))].sort()
  const rows: PayMonthRow[] = periods.map(period => {
    const items = mine.filter(m => m.period === period && PERIOD_TYPES.has(m.type))
    const live = items.filter(isLive)
    const sum = (t: string) => live.filter(m => m.type === t).reduce((a, m) => a + m.amount, 0)
    const base = sum('salaire_du')
    const ajouts = sum('ajout_salaire')
    const retenues = sum('retenue_salaire') + sum('retenue_manuelle')
    const special = monthStates[monthKey(empId, period)]
    const state: MonthState = special ?? (period === cur ? 'en_cours' : 'passe')
    return {
      period,
      label: periodLabel(period),
      base,
      ajouts,
      retenues,
      aPayer: Math.max(0, base + ajouts - retenues),
      verse: 0,
      reste: 0,
      etat: 'Pas payé',
      state,
      items,
    }
  })

  // 2. Versements de salaire répartis du plus ancien au plus récent
  const salaryPayments = mine.filter(m => m.type === 'je_lui_ai_verse' || m.type === 'surplus_salaire')
  const paid =
    salaryPayments.filter(m => isLive(m) && m.type === 'je_lui_ai_verse').reduce((a, m) => a + m.amount, 0) -
    salaryPayments.filter(m => isLive(m) && m.type === 'surplus_salaire').reduce((a, m) => a + m.amount, 0)
  let left = Math.max(0, paid)
  for (const r of rows) {
    r.verse = Math.min(r.aPayer, left)
    left -= r.verse
    r.reste = r.aPayer - r.verse
    r.etat = r.state === 'annule' ? 'Annulé' : r.reste === 0 ? 'Payé' : r.verse > 0 ? 'En partie' : 'Pas payé'
  }
  const surplus = left

  // 3. Avances, remboursées de la plus ancienne à la plus récente
  const advMovs = mine.filter(m => m.type === 'avance_salaire').sort(byDateAsc)
  const repayments = mine.filter(m => m.type === 'remboursement_direct' || m.type === 'retenue_salaire')
  let repaid = repayments.filter(isLive).reduce((a, m) => a + m.amount, 0)
  const advRows: AdvanceRow[] = advMovs.map(mov => {
    if (mov.isCancelled) return { mov, rendu: 0, reste: 0, etat: 'Annulée' }
    const rendu = Math.min(mov.amount, repaid)
    repaid -= rendu
    const reste = mov.amount - rendu
    return { mov, rendu, reste, etat: reste === 0 ? 'Soldée' : 'En cours' }
  })

  const lastOf = (list: Movement[]) => list.filter(isLive).sort(byDateDesc)[0]?.date

  return {
    months: [...rows].reverse(),
    payments: [...salaryPayments].sort(byDateDesc),
    totalReste: rows.reduce((a, r) => a + r.reste, 0),
    lastPayment: lastOf(salaryPayments.filter(m => m.type === 'je_lui_ai_verse')),
    advances: advRows.reverse(),
    repayments: [...repayments].sort(byDateDesc),
    advanceReste: advRows.reduce((a, r) => a + r.reste, 0),
    lastRepayment: lastOf(repayments),
    surplus,
  }
}

// Compteurs gardés sur la fiche (tableau de bord, vues d'ensemble) : recalculés après chaque opération.
export function syncEmployee(p: Person, movements: Movement[], monthStates: Record<string, 'arrete' | 'annule'>): Person {
  if (p.type !== 'employee') return p
  const pr = payrollOf(p.id, movements, monthStates)
  return {
    ...p,
    currentSalaryDue: pr.totalReste,
    advanceBalance: pr.advanceReste,
    lastSalaryPaymentDate: pr.lastPayment ?? p.lastSalaryPaymentDate,
    lastAdvanceRepaymentDate: pr.lastRepayment ?? p.lastAdvanceRepaymentDate,
  }
}

// ——— Données de démonstration ———
// Pour chaque employé : un salaire de base par mois depuis l'embauche ; les mois passés payés
// (quelques-uns en partie) ; le mois en cours suit la fiche ; les avances et leurs retenues.

const parseDate = (d?: string) => {
  if (!d) return null
  const [dd, mm, yyyy] = d.split('/').map(Number)
  return new Date(yyyy, mm - 1, dd)
}
const seeded = (text: string) => {
  let h = 0
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h % 10
}
const pad = (n: number) => String(n).padStart(2, '0')

export function buildPayrollSeed(persons: Person[], existing: Movement[], today = new Date()): Movement[] {
  const out: Movement[] = []
  const cur = periodOf(today)
  for (const p of persons) {
    if (p.type !== 'employee' || !p.salary) continue
    const start = parseDate(p.startDate)
    if (!start) continue
    let y = start.getFullYear()
    let m = start.getMonth() + (start.getDate() > 15 ? 1 : 0)
    if (m > 11) { m = 0; y++ }
    const lastPeriodPaid = p.status === 'inactif' ? cur : ''
    // Mois précédent : si une avance de démonstration est créée, sa retenue y est appliquée
    // (le versement de ce mois-là est donc le salaire moins la retenue).
    const prevPeriod = periodOf(new Date(today.getFullYear(), today.getMonth() - 1, 1))
    const seedsAdvance =
      (p.advanceBalance || 0) > 0 && !existing.some(x => x.personId === p.id && x.type === 'avance_salaire')
    const prevRetenue = seedsAdvance ? p.advanceDeductionPerPeriod || 0 : 0
    while (`${y}-${pad(m + 1)}` <= cur) {
      const period = `${y}-${pad(m + 1)}`
      out.push({
        id: `seed-sal-${p.id}-${period}`,
        personId: p.id,
        personName: p.name,
        type: 'salaire_du',
        label: 'Salaire de base',
        amount: p.salary,
        date: `01/${pad(m + 1)}/${y}`,
        period,
      })
      if (period < cur || lastPeriodPaid) {
        // Mois passés : payés en fin de mois (les deux derniers mois, parfois en partie).
        const recent = period >= periodOf(new Date(today.getFullYear(), today.getMonth() - 2, 1))
        const r = seeded(`${p.id}-${period}`)
        const due = p.salary - (period === prevPeriod ? prevRetenue : 0)
        const amount = recent && r >= 8 ? Math.round((due * 0.7) / 5000) * 5000 : due
        out.push({
          id: `seed-pay-${p.id}-${period}`,
          personId: p.id,
          personName: p.name,
          type: 'je_lui_ai_verse',
          label: 'Salaire versé',
          amount,
          date: `${pad(Math.min(28, daysInPeriod(period)))}/${pad(m + 1)}/${y}`,
          paymentMethod: r % 2 ? 'mobile_money' : 'especes',
        })
      }
      m++
      if (m > 11) { m = 0; y++ }
    }

    // Avances : on reconstitue le solde de la fiche avec une avance et ses remboursements passés.
    const already = existing.filter(x => x.personId === p.id)
    const advBalance = p.advanceBalance || 0
    const hasAdv = already.some(x => x.type === 'avance_salaire')
    if (advBalance > 0 && !hasAdv) {
      const given = advBalance + (p.advanceDeductionPerPeriod || 0)
      const prev = new Date(today.getFullYear(), today.getMonth() - 2, 10)
      out.push({
        id: `seed-adv-${p.id}`,
        personId: p.id,
        personName: p.name,
        type: 'avance_salaire',
        label: 'Avance sur salaire',
        amount: given,
        date: `${pad(prev.getDate())}/${pad(prev.getMonth() + 1)}/${prev.getFullYear()}`,
        paymentMethod: 'especes',
      })
      if (p.advanceDeductionPerPeriod) {
        const pp = periodOf(new Date(today.getFullYear(), today.getMonth() - 1, 1))
        out.push({
          id: `seed-ret-${p.id}-${pp}`,
          personId: p.id,
          personName: p.name,
          type: 'retenue_salaire',
          label: "Retenue pour l'avance",
          amount: p.advanceDeductionPerPeriod,
          date: `01/${pp.slice(5)}/${pp.slice(0, 4)}`,
          period: pp,
          note: 'Retenue automatique',
        })
      }
    }
    // Mois en cours : retenue d'avance automatique, si un plan de retenue existe.
    if (p.status !== 'inactif' && p.advanceDeductionPerPeriod && advBalance > 0) {
      out.push({
        id: `seed-ret-${p.id}-${cur}`,
        personId: p.id,
        personName: p.name,
        type: 'retenue_salaire',
        label: "Retenue pour l'avance",
        amount: Math.min(p.advanceDeductionPerPeriod, advBalance),
        date: `01/${cur.slice(5)}/${cur.slice(0, 4)}`,
        period: cur,
        note: 'Retenue automatique',
      })
    }
  }
  return out
}

// Historique pour le graphique de la vue d'ensemble des employés (somme sur les employés choisis).
export type PayMonth = { year: number; month: number; due: number; paid: number }
export function payHistoryFromMovements(
  employees: Person[],
  movements: Movement[],
  monthStates: Record<string, 'arrete' | 'annule'>
): PayMonth[] {
  const map = new Map<string, PayMonth>()
  for (const e of employees) {
    for (const r of payrollOf(e.id, movements, monthStates).months) {
      const [y, m] = r.period.split('-').map(Number)
      const row = map.get(r.period) ?? { year: y, month: m - 1, due: 0, paid: 0 }
      row.due += r.aPayer
      row.paid += r.verse
      map.set(r.period, row)
    }
  }
  return [...map.values()].sort((a, b) => a.year - b.year || a.month - b.month)
}
