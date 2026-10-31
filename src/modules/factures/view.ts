// ——— Calculs des factures : totaux, numéros, montant en lettres, unités ———
import type { Invoice, InvoiceLine, InvoiceProfile } from './types'

export const TVA_RATE = 0.18

export const lineTotal = (l: InvoiceLine) => Math.round(l.q * l.p)
export function totals(inv: Pick<Invoice, 'lines' | 'tva'>) {
  const ht = inv.lines.reduce((a, l) => a + lineTotal(l), 0)
  const tva = inv.tva ? Math.round(ht * TVA_RATE) : 0
  return { ht, tva, net: ht + tva }
}

// « 2 » → « 002 » (au moins 3 chiffres)
export const pad3 = (n: number) => String(Math.max(0, Math.floor(n))).padStart(3, '0')
export const numberOf = (p: InvoiceProfile, kind: 'facture' | 'devis') => (kind === 'devis' ? `${p.quotePrefix}${pad3(p.quoteNext)}` : `${p.prefix}${pad3(p.next)}`)
// Numéro court pour la liste : « SB-BTP/2026-001 » → « 001 »
export const shortNumber = (n: string) => n.match(/(\d+)\s*$/)?.[1] ?? n

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
export const dateLong = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return `${String(d).padStart(2, '0')} ${MOIS[m - 1]} ${y}`
}

// Montant en lettres, en français (« Un million deux cent mille »)
export function inWords(n: number): string {
  n = Math.round(n)
  const U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize']
  const D = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt']
  const two = (x: number): string => {
    if (x < 17) return U[x]
    if (x < 20) return 'dix-' + U[x - 10]
    const d = Math.floor(x / 10)
    const u = x % 10
    if (d === 7 || d === 9) return D[d] + (d === 7 && u === 1 ? ' et ' : '-') + two(10 + u)
    if (u === 0) return D[d] + (d === 8 ? 's' : '')
    return D[d] + (u === 1 && d !== 8 ? ' et un' : '-' + U[u])
  }
  // end : rien ne suit (« deux cents » ; mais « deux cent mille »)
  const three = (x: number, end: boolean): string => {
    const c = Math.floor(x / 100)
    const r = x % 100
    const cs = c === 0 ? '' : c === 1 ? 'cent' : U[c] + ' cent' + (r === 0 && end ? 's' : '')
    const rs = r ? two(r) : ''
    return [cs, rs].filter(Boolean).join(' ')
  }
  if (n === 0) return 'Zéro'
  const parts: string[] = []
  const md = Math.floor(n / 1e9)
  const mi = Math.floor(n / 1e6) % 1000
  const k = Math.floor(n / 1000) % 1000
  const r = n % 1000
  if (md) parts.push(three(md, true) + (md > 1 ? ' milliards' : ' milliard'))
  if (mi) parts.push(three(mi, true) + (mi > 1 ? ' millions' : ' million'))
  if (k) parts.push(k === 1 ? 'mille' : three(k, false) + ' mille')
  if (r) parts.push(three(r, true))
  const s = parts.join(' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Montant affiché : « 1 200 000 » (espaces fines insécables)
export const money = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

// ——— Unités : le clavier des unités ———
export const UNIT_GROUPS: { label: string; units: string[] }[] = [
  { label: 'Nombre', units: ['pièce', 'unité', 'lot', 'forfait', 'carton', 'sac', 'paquet', 'voyage'] },
  { label: 'Temps', units: ['heure', 'jour', 'semaine', 'mois'] },
  { label: 'Poids', units: ['g', 'kg', 'tonne'] },
  { label: 'Volume · Longueur · Surface', units: ['litre', 'm³', 'cm', 'm', 'km', 'm²', 'hectare'] },
]
// Pluriel d'une unité selon la quantité (« 2 jours », « 2 kg », « 2 mois »)
const INVARIABLE = new Set(['g', 'kg', 'm³', 'cm', 'm', 'km', 'm²'])
export function unitFor(u: string | undefined, q: number) {
  if (!u) return ''
  if (q <= 1 || INVARIABLE.has(u) || /[sxz]$/.test(u)) return u
  return u + 's'
}
// « 2 jours », « 1,5 tonne », « 3 »
export const qtyLabel = (l: InvoiceLine) => `${String(l.q).replace('.', ',')}${l.u ? ` ${unitFor(l.u, l.q)}` : ''}`

// Infos de départ (avant que le commerçant ne les remplisse)
export function defaultProfile(shopName: string, year = new Date().getFullYear()): InvoiceProfile {
  return {
    name: shopName,
    activities: '',
    address: '',
    phone: '',
    prefix: `FAC-${year}-`,
    next: 1,
    quotePrefix: `DEV-${year}-`,
    quoteNext: 1,
    mentions: 'Facture établie en deux exemplaires originaux.\nPrière de rappeler la référence {numero} lors du règlement.',
  }
}
