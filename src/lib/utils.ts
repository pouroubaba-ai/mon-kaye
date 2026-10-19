import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFCFA(amount: number): string {
  const rounded = Math.round(amount || 0)
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA"
}

export function formatDateJJMMYYYY(dateInput: string | Date): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput
  if (isNaN(d.getTime())) return String(dateInput)
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

// ——— Recherche ———
// Sans accents ni majuscules : « epicerie » trouve « Épicerie ».
export const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const digitsOf = (s: string) => s.replace(/\D/g, '')
// Numéro sans espaces ni indicatif : « 06 444 », « 064445566 » et « +242 06 444 55 66 » se trouvent l'un l'autre.
const localDigits = (s: string) => {
  const d = digitsOf(s)
  return d.startsWith('242') && d.length > 9 ? d.slice(3) : d
}
export function matchesPerson(p: { name: string; phone?: string; role?: string }, query: string): boolean {
  const q = query.trim()
  if (!q) return true
  if (plain(p.name).includes(plain(q)) || (p.role && plain(p.role).includes(plain(q)))) return true
  const qd = localDigits(q)
  return qd.length >= 2 && localDigits(p.phone || '').includes(qd)
}

// Numéro écrit comme au Congo : « 064445566 » → « +242 06 444 55 66 ». Sinon, laissé tel quel.
export function formatPhone(s: string): string {
  const d = localDigits(s)
  if (d.length === 9 && d.startsWith('0')) return `+242 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`
  return s.trim()
}

// Numéro pour un lien WhatsApp (wa.me) : chiffres avec l'indicatif ; vide si on ne sait pas.
export function waNumber(s?: string): string {
  const d = localDigits(s || '')
  if (d.length === 9 && d.startsWith('0')) return `242${d}`
  return d.length >= 8 ? digitsOf(s || '') : ''
}

// ——— Glissement d'écran ———
// Aller : l'écran arrive depuis la droite ; retour : depuis la gauche. Rien si l'appareil demande moins d'animations.
export function slideIn(el: HTMLElement | null, dir: 'forward' | 'back') {
  if (!el || typeof el.animate !== 'function') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  el.animate(
    [
      { transform: `translateX(${dir === 'forward' ? '100%' : '-100%'})`, opacity: 0.5 },
      { transform: 'translateX(0)', opacity: 1 },
    ],
    { duration: 300, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
  )
}
