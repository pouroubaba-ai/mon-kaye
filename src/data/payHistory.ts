import type { Person } from './mockData'

// Historique des salaires, mois par mois, pour la vue d'ensemble des employés.
//
// DÉMONSTRATION : les mois passés sont fabriqués de façon fixe (toujours les mêmes chiffres)
// à partir de la date d'embauche et du salaire de chaque employé. Le mois en cours, lui,
// suit l'état réel de l'application : un salaire versé aujourd'hui fait bouger le graphique.
// Dans la vraie version, tout sera calculé à partir des opérations enregistrées.

export type PayMonth = { year: number; month: number; due: number; paid: number }

const parseDate = (d?: string) => {
  if (!d) return null
  const [dd, mm, yyyy] = d.split('/').map(Number)
  return new Date(yyyy, mm - 1, dd)
}

// Petit hasard fixe : même employé + même mois = même résultat à chaque ouverture.
const seeded = (text: string) => {
  let h = 0
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h % 10
}

const round5000 = (v: number) => Math.round(v / 5000) * 5000

export function buildPayHistory(persons: Person[], today = new Date()): PayMonth[] {
  const months = new Map<string, PayMonth>()
  const curY = today.getFullYear()
  const curM = today.getMonth()

  for (const p of persons) {
    if (p.type !== 'employee' || !p.salary) continue
    const start = parseDate(p.startDate)
    if (!start) continue
    // Embauché après le 15 : premier salaire complet le mois suivant.
    let y = start.getFullYear()
    let m = start.getMonth() + (start.getDate() > 15 ? 1 : 0)
    if (m > 11) { m = 0; y++ }

    while (y < curY || (y === curY && m <= curM)) {
      const key = `${y}-${m}`
      const row = months.get(key) ?? { year: y, month: m, due: 0, paid: 0 }
      row.due += p.salary
      if (y === curY && m === curM) {
        row.paid += Math.max(0, p.salary - (p.currentSalaryDue || 0))
      } else {
        const r = seeded(`${p.id}-${key}`)
        row.paid += r <= 6 ? p.salary : r <= 8 ? round5000(p.salary * 0.85) : round5000(p.salary * 0.6)
      }
      months.set(key, row)
      m++
      if (m > 11) { m = 0; y++ }
    }
  }
  return [...months.values()].sort((a, b) => a.year - b.year || a.month - b.month)
}

export const daysSince = (d?: string, today = new Date()) => {
  const date = parseDate(d)
  if (!date) return null
  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86_400_000))
}
