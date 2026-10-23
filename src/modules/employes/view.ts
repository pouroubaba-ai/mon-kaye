// Ce qu'on affiche d'un employé (« Kayé simple ») : petits textes de la liste et de la fiche.
import type { Movement, Person } from '@/data/mockData'
import { daysUntil, dueDateOf, payrollOf, toTime, type Payroll, type PayMonthRow } from './payroll'

const LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

// « septembre » (l'année seulement si ce n'est pas celle-ci)
export const monthName = (p: string) => {
  const [y, m] = p.split('-').map(Number)
  return `${LONG[m - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ''}`
}
// « de septembre », « d'octobre »
export const ofMonthName = (p: string) => (/^[aeiouéâ]/i.test(monthName(p)) ? `d'${monthName(p)}` : `de ${monthName(p)}`)
export const Cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
// « 27 oct. »
export const shortDate = (d: Date) => `${d.getDate()} ${SHORT[d.getMonth()]}`
// « 27 oct. » depuis jj/mm/aaaa
export const shortDay = (s: string) => {
  const [dd, mm] = s.split('/').map(Number)
  return `${dd} ${SHORT[mm - 1]}`
}
export const inDays = (n: number) => (n <= 0 ? "aujourd'hui" : n === 1 ? 'demain' : `dans ${n} jours`)

// Les périodes à payer maintenant (échues, pas annulées, avec un reste), de la plus ancienne à la plus récente
export const dueRows = (pr: Payroll) => pr.months.filter(m => m.state !== 'en_cours' && m.state !== 'annule' && m.reste > 0).reverse()

export type EmpLine = {
  emp: Person
  pr: Payroll
  due: number // à payer maintenant
  upcoming: number // à verser au prochain jour de paie (retenue enlevée)
  days: number // jours avant le prochain jour de paie
  dueDate: Date
}

export function empLine(emp: Person, movements: Movement[], monthStates: Parameters<typeof payrollOf>[2]): EmpLine {
  const pr = payrollOf(emp.id, movements, monthStates)
  const dueDate = dueDateOf(pr.currentPeriod, emp.id)
  // upcoming : ce qui sera vraiment versé au jour de paie (la retenue prévue déjà enlevée)
  return { emp, pr, due: pr.dueReste, upcoming: Math.max(0, pr.upcoming - pr.plannedRetenue), days: daysUntil(dueDate), dueDate }
}

// Une ligne de paie de la fiche : son texte sous le mois
export function rowSub(r: PayMonthRow, pr: Payroll, empId: string) {
  if (r.state === 'annule') return 'Annulée'
  if (r.state === 'en_cours') {
    const d = dueDateOf(r.period, empId)
    return `À payer le ${shortDate(d)}${pr.plannedRetenue > 0 ? ` · ${pr.plannedRetenue.toLocaleString('fr-FR').replace(/\s/g, ' ')} retenus` : ''}`
  }
  if (r.reste > 0) return r.verse > 0 ? `Versé ${fmt(r.verse)} sur ${fmt(r.aPayer)} · reste à payer` : 'Pas encore payé'
  const last = r.paymentParts.map(x => x.mov).sort((a, b) => toTime(b.date) - toTime(a.date))[0]
  return last ? `Payé le ${shortDay(last.date)}${last.paymentMethod === 'mobile_money' ? ' · Mobile Money' : last.paymentMethod === 'especes' ? ' · Espèces' : ''}` : 'Payé'
}
const fmt = (v: number) => Math.round(v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
