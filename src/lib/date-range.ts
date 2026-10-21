// Filtre par date : « Toute la période », « Aujourd'hui », « 7 derniers jours », « Ce mois »,
// « Le mois dernier », ou « Du … au … ». Les dates des opérations sont au format jj/mm/aaaa.

export type RangeKey = 'tout' | 'jour' | '7j' | 'mois' | 'mois_prec' | 'perso'
// from / to : « aaaa-mm-jj » (champ date du téléphone), seulement pour « Du … au … »
export type DateRange = { key: RangeKey; from?: string; to?: string }
export const ALL_TIME: DateRange = { key: 'tout' }

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const fromIso = (s?: string) => {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : null
}
export const ddmmyy = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`
export const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const opTime = (d: string) => {
  const [dd, mm, yy] = d.split('/').map(Number)
  return new Date(yy, mm - 1, dd).getTime()
}

// Premier et dernier jour du filtre (compris) ; null = pas de limite
export function rangeBounds(r: DateRange, today = new Date()): { start: Date | null; end: Date | null } {
  const t = midnight(today)
  switch (r.key) {
    case 'jour':
      return { start: t, end: t }
    case '7j':
      return { start: new Date(t.getFullYear(), t.getMonth(), t.getDate() - 6), end: t }
    case 'mois':
      return { start: new Date(t.getFullYear(), t.getMonth(), 1), end: t }
    case 'mois_prec':
      return { start: new Date(t.getFullYear(), t.getMonth() - 1, 1), end: new Date(t.getFullYear(), t.getMonth(), 0) }
    case 'perso': {
      let a = fromIso(r.from)
      let b = fromIso(r.to)
      if (a && b && a > b) [a, b] = [b, a]
      return { start: a, end: b }
    }
    default:
      return { start: null, end: null }
  }
}

export const isFiltered = (r: DateRange) => r.key !== 'tout'

// L'opération (date jj/mm/aaaa) tombe-t-elle dans le filtre ?
export function inRange(date: string, r: DateRange, today = new Date()) {
  if (r.key === 'tout') return true
  const { start, end } = rangeBounds(r, today)
  const x = opTime(date)
  return (!start || x >= start.getTime()) && (!end || x <= end.getTime())
}

export function rangeLabel(r: DateRange, today = new Date()) {
  switch (r.key) {
    case 'jour':
      return "Aujourd'hui"
    case '7j':
      return '7 derniers jours'
    case 'mois':
      return 'Ce mois'
    case 'mois_prec': {
      const d = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const m = MONTHS[d.getMonth()]
      return m.charAt(0).toUpperCase() + m.slice(1) + (d.getFullYear() !== today.getFullYear() ? ` ${d.getFullYear()}` : '')
    }
    case 'perso': {
      const { start, end } = rangeBounds(r, today)
      if (start && end) return `Du ${ddmmyy(start)} au ${ddmmyy(end)}`
      if (start) return `Depuis le ${ddmmyy(start)}`
      if (end) return `Jusqu'au ${ddmmyy(end)}`
      return 'Toute la période'
    }
    default:
      return 'Toute la période'
  }
}

// « du 01/10/26 au 21/10/26 » (pour la fiche de compte)
export function rangeSpan(r: DateRange, today = new Date()) {
  const { start, end } = rangeBounds(r, today)
  if (start && end) return start.getTime() === end.getTime() ? `le ${ddmmyy(start)}` : `du ${ddmmyy(start)} au ${ddmmyy(end)}`
  if (start) return `depuis le ${ddmmyy(start)}`
  if (end) return `jusqu'au ${ddmmyy(end)}`
  return ''
}
