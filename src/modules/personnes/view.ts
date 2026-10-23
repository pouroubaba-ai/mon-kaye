// Ce qu'on affiche d'un partenaire (accueil, fiche) : côtés utilisés, déjà versé, dernières dates, petits textes.
import type { Movement, Person } from '@/data/mockData'
import { daysSince } from '@/data/payHistory'
import { opTime } from '@/lib/date-range'

export type Side = 'lui' | 'moi' // lui : ce qu'il me doit (client) ; moi : ce que je lui dois (fournisseur)

export const CREDIT_OF: Record<Side, Movement['type']> = { lui: 'il_a_pris_credit', moi: 'j_ai_pris_credit' }
export const PAY_OF: Record<Side, Movement['type']> = { lui: 'il_m_a_verse', moi: 'je_lui_ai_verse' }
export const RETURN_OF: Record<Side, Movement['type']> = { lui: 'il_a_retourne', moi: 'j_ai_retourne' }

export const sideOf = (m: Movement): Side | null =>
  m.type === 'il_a_pris_credit' || m.type === 'il_m_a_verse' || m.type === 'il_a_retourne'
    ? 'lui'
    : m.type === 'j_ai_pris_credit' || m.type === 'je_lui_ai_verse' || m.type === 'j_ai_retourne'
      ? 'moi'
      : null

export const balanceOf = (p: Person, side: Side) => (side === 'lui' ? p.owesMe || 0 : p.iOweHim || 0)

// Les côtés utilisés : un solde, ou au moins une opération
export function usedSides(p: Person, movements: Movement[]): Side[] {
  const mine = movements.filter(m => m.personId === p.id && !m.isCancelled)
  return (['lui', 'moi'] as Side[]).filter(s => balanceOf(p, s) > 0 || mine.some(m => sideOf(m) === s))
}

// Déjà versé sur un côté ; « pris » = reste + versé (le calcul tombe toujours juste)
export function paidOn(movements: Movement[], personId: string | null, side: Side) {
  return movements
    .filter(m => (personId === null || m.personId === personId) && !m.isCancelled && m.type === PAY_OF[side])
    .reduce((a, m) => a + m.amount, 0)
}

export function lastDate(movements: Movement[], personId: string, type: Movement['type']) {
  const d = movements.filter(m => m.personId === personId && m.type === type && !m.isCancelled).map(m => m.date)
  return d.sort((a, b) => opTime(b) - opTime(a))[0]
}

// « aujourd'hui », « hier », « il y a 12 j »
export function ago(date?: string) {
  const n = daysSince(date)
  if (n === null) return ''
  return n === 0 ? "aujourd'hui" : n === 1 ? 'hier' : `il y a ${n} j`
}

// Sous le nom, dans l'accueil : depuis quand il n'a rien versé
// Dernier versement : d'après l'historique, sinon la date gardée sur la fiche (anciens comptes)
export const lastPayDate = (movements: Movement[], p: Person, side: Side) =>
  lastDate(movements, p.id, PAY_OF[side]) ?? (side === 'lui' ? p.lastPaymentDate : p.lastPaidByMeDate)

export function lastPayText(movements: Movement[], p: Person, side: Side) {
  const d = lastPayDate(movements, p, side)
  return d ? `Dernier versement ${ago(d)}` : 'Jamais versé'
}

export const il = (p?: Person) => (p?.sex === 'f' ? 'Elle' : 'Il')

export const initials = (name: string) =>
  name
    .replace(/\(.*\)/, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

// Montant sans « FCFA » : 145 000
export const amt = (v: number) => Math.round(v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
