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
  // Part de chaque versement qui revient à ce mois (un versement peut se partager entre deux mois)
  paymentParts: { mov: Movement; amount: number }[]
  // Versements annulés qui étaient tombés sur ce mois : affichés barrés, sans compter
  cancelledParts: { mov: Movement; amount: number }[]
  // Mois arrêté ou annulé après des versements : la part sortie du mois, et ce qu'elle est devenue
  movedParts: { mov: Movement; amount: number; to: 'avance' | 'rendu' }[]
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
  // À payer maintenant : les périodes dont l'échéance est passée (ou arrêtées). La période en cours
  // n'est à payer qu'à son échéance : elle est « à venir ».
  dueReste: number
  upcoming: number // période en cours : ce qui sera à payer à l'échéance (retenue prévue comprise)
  currentPeriod: string
  lastPayment?: string
  advances: AdvanceRow[] // de la plus récente à la plus ancienne
  repayments: Movement[] // remboursements : directs et retenues d'avance
  advanceReste: number
  lastRepayment?: string
  surplus: number // reçu en trop, non encore traité (normalement 0)
  // Retenue d'avance prévue sur le mois en cours (appliquée à la clôture du mois), telle qu'elle compte
  // vraiment : jamais plus que l'avance à rendre, et baissée si on a versé plus que le salaire moins la retenue.
  plannedRetenue: number
  plannedSet: number // montant inscrit sur la retenue prévue
  plannedCap: number // le même, limité à ce qui reste à rendre sur les avances
}

const SHORT = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']
const LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export const periodOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

// ——— Jour de paie (échéance) ———
// Chaque employé a son jour de paie : du 1 au 28, ou 31 = « le dernier jour du mois ».
// Une période de paie va d'une échéance à la suivante (du 25 septembre au 25 octobre) et porte
// le nom du mois de son échéance (« octobre »). Le jour de l'échéance, la période se termine :
// son salaire est à payer, et la suivante commence.
// Sans jour de paie enregistré : le dernier jour du mois (comme avant).
export const LAST_DAY = 31
const dueDays = new Map<string, number>()
export const setDueDay = (empId: string, day?: number) => {
  if (day && day >= 1) dueDays.set(empId, day)
  else dueDays.delete(empId)
}
export const dueDayOf = (empId: string) => dueDays.get(empId) ?? LAST_DAY
// Le jour de paie dans un mois donné (« le 31 » devient le 30 ou le 28 selon le mois)
const payDay = (dueDay: number, y: number, m: number) => Math.min(dueDay, new Date(y, m, 0).getDate())
// La période en cours à une date donnée, pour un jour de paie donné
export function periodFor(dueDay: number, d = new Date()) {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  if (d.getDate() < payDay(dueDay, y, m)) return `${y}-${String(m).padStart(2, '0')}`
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}
// Période en cours : celle de l'employé (selon son jour de paie) ; sans employé, le mois du calendrier
export const currentPeriod = (empId?: string) => (empId ? periodFor(dueDayOf(empId), new Date()) : periodOf(new Date()))
// Début et échéance d'une période
export function periodBounds(period: string, dueDay: number) {
  const [y, m] = period.split('-').map(Number)
  const end = new Date(y, m - 1, payDay(dueDay, y, m))
  const py = m === 1 ? y - 1 : y
  const pm = m === 1 ? 12 : m - 1
  const start = new Date(py, pm - 1, payDay(dueDay, py, pm))
  return { start, end }
}
const DAY = 86_400_000
const SHORT_DAY = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
export const dayMonth = (d: Date) => `${d.getDate()} ${SHORT_DAY[d.getMonth()]}`
// « du 25 sept. au 25 oct. »
export const periodSpan = (period: string, empId: string) => {
  const { start, end } = periodBounds(period, dueDayOf(empId))
  return `du ${dayMonth(start)} au ${dayMonth(end)}`
}
// L'échéance d'une période (date) et le nombre de jours avant elle (0 = aujourd'hui)
export const dueDateOf = (period: string, empId: string) => periodBounds(period, dueDayOf(empId)).end
export const daysUntil = (d: Date, today = new Date()) =>
  Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / DAY)
const ddmmyyyy = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
export const periodStartStr = (period: string, empId: string) => ddmmyyyy(periodBounds(period, dueDayOf(empId)).start)
// « Le 25 de chaque mois » / « Le dernier jour du mois »
export const dueDayLabel = (day?: number) => (!day || day >= 29 ? 'le dernier jour du mois' : `le ${day} de chaque mois`)
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
// Nombre de jours d'une période : celle de l'employé (d'une échéance à l'autre), sinon le mois du calendrier
export const daysInPeriod = (p: string, empId?: string) => {
  if (empId) {
    const { start, end } = periodBounds(p, dueDayOf(empId))
    return Math.round((end.getTime() - start.getTime()) / DAY)
  }
  const [y, m] = p.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
// Jours déjà passés dans la période jusqu'à aujourd'hui compris (pour un arrêt en cours de période)
export const daysWorked = (p: string, empId: string, today = new Date()) => {
  const { start } = periodBounds(p, dueDayOf(empId))
  return Math.min(daysInPeriod(p, empId), Math.max(1, daysUntil(today, start) + 1)) // le premier jour compte
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
  const cur = periodFor(dueDayOf(empId), today)

  // Avances, remboursées de la plus ancienne à la plus récente.
  // Retenue du mois en cours (pas encore clos) : seulement prévue. Elle n'entre dans les remboursements
  // et ne baisse l'avance qu'à la clôture du mois ; ses changements ne laissent pas de trace ici.
  const advMovs = mine.filter(m => m.type === 'avance_salaire').sort(byDateAsc)
  const curOpen = !monthStates[monthKey(empId, cur)]
  const isPlanned = (m: Movement) => m.type === 'retenue_salaire' && m.period === cur && curOpen
  const plannedSet = mine.filter(m => isPlanned(m) && isLive(m)).reduce((a, m) => a + m.amount, 0)
  const repayments = mine.filter(m => (m.type === 'remboursement_direct' || m.type === 'retenue_salaire') && !isPlanned(m))
  let repaid = repayments.filter(isLive).reduce((a, m) => a + m.amount, 0)
  const advRows: AdvanceRow[] = advMovs.map(mov => {
    if (mov.isCancelled) return { mov, rendu: 0, reste: 0, etat: 'Annulée' }
    const rendu = Math.min(mov.amount, repaid)
    repaid -= rendu
    const reste = mov.amount - rendu
    return { mov, rendu, reste, etat: reste === 0 ? 'Soldée' : 'En cours' }
  })
  const advanceReste = advRows.reduce((a, r) => a + r.reste, 0)
  // On ne retient jamais plus que ce qu'il doit encore (avance annulée ou soldée : rien à retenir).
  const plannedCap = Math.min(plannedSet, advanceReste)

  // 1. Les mois
  const periods = [...new Set(mine.filter(m => m.period && PERIOD_TYPES.has(m.type)).map(m => m.period!))].sort()
  const rows: PayMonthRow[] = periods.map(period => {
    const items = mine.filter(m => m.period === period && PERIOD_TYPES.has(m.type))
    const live = items.filter(isLive)
    const sum = (t: string) => live.filter(m => m.type === t).reduce((a, m) => a + m.amount, 0)
    const base = sum('salaire_du')
    const ajouts = sum('ajout_salaire')
    // La retenue prévue du mois en cours est ajoutée après la répartition des versements (voir plus bas).
    const retenues = (period === cur && curOpen ? 0 : sum('retenue_salaire')) + sum('retenue_manuelle')
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
      paymentParts: [],
      cancelledParts: [],
      movedParts: [],
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
  // Chaque versement, du plus ancien au plus récent, remplit les mois du plus ancien au plus récent.
  let budget = Math.max(0, paid)
  let mi = 0
  // Mois en cours : les versements peuvent aller jusqu'au salaire entier ; ce qui dépasse
  // « salaire moins retenue » prend sur la retenue prévue (il rendra moins ce mois-ci).
  const curRow = curOpen ? rows.find(r => r.period === cur) : undefined
  for (const pay of salaryPayments.filter(m => isLive(m) && m.type === 'je_lui_ai_verse').sort(byDateAsc)) {
    let avail = Math.min(pay.amount, budget)
    budget -= avail
    while (avail > 0 && mi < rows.length) {
      const r = rows[mi]
      const room = r.aPayer - r.verse
      if (room <= 0) {
        mi++
        continue
      }
      const part = Math.min(room, avail)
      r.verse += part
      r.paymentParts.push({ mov: pay, amount: part })
      avail -= part
    }
  }
  let plannedRetenue = 0
  if (curRow) {
    plannedRetenue = Math.min(plannedCap, Math.max(0, curRow.aPayer - curRow.verse))
    curRow.aPayer -= plannedRetenue
    curRow.retenues += plannedRetenue
  }
  // Versements annulés : on refait la répartition comme s'ils comptaient encore, pour savoir
  // sur quel mois chacun était tombé ; ils y restent visibles, barrés.
  {
    const fill = rows.map(() => 0)
    let k = 0
    for (const pay of salaryPayments.filter(m => m.type === 'je_lui_ai_verse').sort(byDateAsc)) {
      let avail = pay.amount
      while (avail > 0 && k < rows.length) {
        const room = rows[k].aPayer - fill[k]
        if (room <= 0) {
          k++
          continue
        }
        const part = Math.min(room, avail)
        fill[k] += part
        if (pay.isCancelled) {
          // Un même versement annulé n'apparaît qu'une fois par mois
          const prev = rows[k].cancelledParts.find(c => c.mov.id === pay.id)
          if (prev) prev.amount += part
          else rows[k].cancelledParts.push({ mov: pay, amount: part })
        }
        avail -= part
      }
      // Rien à payer pour l'accueillir : on le montre sur le mois de sa date
      if (avail > 0 && pay.isCancelled) {
        const r = rows.find(x => x.period === periodOf(new Date(toTime(pay.date)))) ?? rows[rows.length - 1]
        r?.cancelledParts.push({ mov: pay, amount: avail })
      }
    }
  }

  for (const sp of mine.filter(m => m.type === 'surplus_salaire' && !m.isCancelled && m.period)) {
    const r = rows.find(x => x.period === sp.period)
    if (!r) continue
    for (const part of sp.parts ?? []) {
      const mov = mine.find(m => m.id === part.id)
      if (mov) r.movedParts.push({ mov, amount: part.amount, to: sp.label.endsWith('rendu') ? 'rendu' : 'avance' })
    }
  }

  // Reçu en plus de tout ce qui est à payer
  const surplus = Math.max(0, paid) - rows.reduce((a, r) => a + r.verse, 0)
  for (const r of rows) {
    r.reste = r.aPayer - r.verse
    r.etat = r.state === 'annule' ? 'Annulé' : r.reste === 0 ? 'Payé' : r.verse > 0 ? 'En partie' : 'Pas payé'
  }

  const lastOf = (list: Movement[]) => list.filter(isLive).sort(byDateDesc)[0]?.date

  return {
    months: [...rows].reverse(),
    payments: [...salaryPayments].sort(byDateDesc),
    totalReste: rows.reduce((a, r) => a + r.reste, 0),
    dueReste: rows.filter(r => r.state !== 'en_cours').reduce((a, r) => a + r.reste, 0),
    upcoming: rows.filter(r => r.state === 'en_cours').reduce((a, r) => a + r.reste, 0) + plannedRetenue,
    currentPeriod: cur,
    lastPayment: lastOf(salaryPayments.filter(m => m.type === 'je_lui_ai_verse')),
    advances: advRows.reverse(),
    repayments: [...repayments].sort(byDateDesc),
    advanceReste,
    lastRepayment: lastOf(repayments),
    surplus,
    plannedRetenue,
    plannedSet,
    plannedCap,
  }
}

// Compteurs gardés sur la fiche (tableau de bord, vues d'ensemble) : recalculés après chaque opération.
export function syncEmployee(p: Person, movements: Movement[], monthStates: Record<string, 'arrete' | 'annule'>): Person {
  if (p.type !== 'employee') return p
  setDueDay(p.id, p.dueDay)
  const pr = payrollOf(p.id, movements, monthStates)
  return {
    ...p,
    // Ce qu'on lui doit maintenant : les périodes arrivées à échéance. La période en cours
    // n'est due qu'à son échéance (la même règle partout : fiche, tableau de bord, page Salaires).
    currentSalaryDue: pr.dueReste,
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

// ——— Départ d'un employé ———
// Le mois en cours (s'il est encore ouvert) est arrêté avec le montant choisi ; la retenue d'avance
// prévue est enlevée (l'avance se règle au départ). Rien n'est payé ici : on calcule seulement.
export function simulateDeparture(
  empId: string,
  movements: Movement[],
  monthStates: Record<string, 'arrete' | 'annule'>,
  newBase: number | null, // null : garder le salaire tel quel
  basisLabel: string,
  date: string,
  stamp = Date.now()
): { next: Movement[]; states: Record<string, 'arrete' | 'annule'>; stopped: boolean } {
  const cur = currentPeriod(empId)
  const key = monthKey(empId, cur)
  const hasMonth = movements.some(m => m.personId === empId && m.period === cur && m.type === 'salaire_du' && !m.isCancelled)
  if (monthStates[key] || !hasMonth) return { next: movements, states: monthStates, stopped: false }
  const emp = movements.find(m => m.personId === empId)
  let next = movements.map(m => {
    if (m.personId !== empId || m.period !== cur || m.isCancelled) return m
    if (m.type === 'retenue_salaire') return { ...m, isCancelled: true, cancellationReason: "Départ : l'avance se règle au départ", cancelledAt: date }
    if (m.type === 'salaire_du' && newBase !== null) return { ...m, isCancelled: true, cancellationReason: 'Départ', cancelledAt: date }
    return m
  })
  if (newBase !== null) {
    next = [
      { id: `mov-sal-dep-${stamp}`, personId: empId, personName: emp?.personName ?? '', type: 'salaire_du', label: `Salaire de base (${basisLabel})`, amount: newBase, date, period: cur },
      ...next,
    ]
  }
  return { next, states: { ...monthStates, [key]: 'arrete' }, stopped: true }
}

// ——— Nouveaux mois ———
// Chaque mois commence avec le salaire entier (et la retenue d'avance prévue, s'il y a une façon de rendre).
// Le premier mois d'un employé est créé à son arrivée (entier, selon les jours, ou montant convenu) ;
// les suivants sont ajoutés ici dès qu'ils arrivent.
export function missingMonths(
  persons: Person[],
  movements: Movement[],
  monthStates: Record<string, 'arrete' | 'annule'>,
  today = new Date()
): Movement[] {
  const out: Movement[] = []
  for (const p of persons) {
    if (p.type !== 'employee' || p.status !== 'actif' || !p.salary) continue
    setDueDay(p.id, p.dueDay)
    const cur = periodFor(dueDayOf(p.id), today)
    const mine = movements.filter(m => m.personId === p.id)
    const have = new Set(mine.filter(m => m.type === 'salaire_du' && m.period).map(m => m.period!))
    if (have.size === 0) continue // pas encore de premier mois : rien à compléter
    let [y, m] = [...have].sort()[0].split('-').map(Number)
    while (true) {
      m++
      if (m > 12) { m = 1; y++ }
      const period = `${y}-${String(m).padStart(2, '0')}`
      if (period > cur) break
      if (have.has(period) || monthStates[monthKey(p.id, period)]) continue
      // Daté du début de la période (l'échéance précédente)
      const date = periodStartStr(period, p.id)
      out.push({ id: `mov-sal-${p.id}-${period}`, personId: p.id, personName: p.name, type: 'salaire_du', label: 'Salaire de base', amount: p.salary, date, period })
      const reste = payrollOf(p.id, [...movements, ...out], monthStates, today).advanceReste
      const per = p.advanceDeductionPerPeriod || 0
      if (per > 0 && reste > 0)
        out.push({ id: `mov-ret-${p.id}-${period}`, personId: p.id, personName: p.name, type: 'retenue_salaire', label: "Retenue pour l'avance", amount: Math.min(per, reste), date, period, note: 'Retenue automatique' })
    }
  }
  return out
}

// ——— Arrêter ou annuler le mois en cours (calcul seul, sans rien enregistrer) ———
// Servent à l'enregistrement ET à la question du trop reçu, pour que le montant annoncé soit le vrai.
type States = Record<string, 'arrete' | 'annule'>

// Retenue prévue inscrite pour ce qu'elle vaut vraiment (limitée à l'avance, baissée si on a versé plus)
export function applyPlannedRetenue(empId: string, next: Movement[], monthStates: States, date: string): Movement[] {
  const cur = currentPeriod(empId)
  const eff = payrollOf(empId, next, monthStates).plannedRetenue
  return next.map(m => {
    if (m.personId !== empId || m.type !== 'retenue_salaire' || m.period !== cur || m.isCancelled || m.amount === eff) return m
    if (eff <= 0) return { ...m, isCancelled: true, cancellationReason: 'Rien à retenir ce mois-ci', cancelledAt: date }
    return { ...m, amount: eff, note: `Montant changé (au lieu de ${m.amount.toLocaleString('fr-FR')} FCFA)` }
  })
}

export function planStopMonth(
  empId: string, movements: Movement[], monthStates: States, period: string,
  newBase: number, basisLabel: string, date: string, stamp = Date.now()
): { next: Movement[]; states: States } {
  const name = movements.find(m => m.personId === empId)?.personName ?? ''
  let next = movements.map(m =>
    m.personId === empId && m.period === period && m.type === 'salaire_du' && !m.isCancelled
      ? { ...m, isCancelled: true, cancellationReason: 'Mois arrêté', cancelledAt: date }
      : m
  )
  next = [
    { id: `mov-sal-stop-${stamp}`, personId: empId, personName: name, type: 'salaire_du', label: `Salaire de base (${basisLabel})`, amount: newBase, date, period },
    ...next,
  ]
  next = applyPlannedRetenue(empId, next, monthStates, date)
  return { next, states: { ...monthStates, [monthKey(empId, period)]: 'arrete' } }
}

export function planCancelMonth(empId: string, movements: Movement[], monthStates: States, period: string, reason: string, date: string) {
  const next = movements.map(m =>
    m.personId === empId && m.period === period && !m.isCancelled
      ? { ...m, isCancelled: true, cancellationReason: `Mois annulé : ${reason}`, cancelledAt: date }
      : m
  )
  return { next, states: { ...monthStates, [monthKey(empId, period)]: 'annule' as const } }
}
