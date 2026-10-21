import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { useRef } from "react"

// Garde la dernière valeur non vide : une fenêtre qui se ferme continue d'afficher son contenu
// pendant l'animation de fermeture, au lieu de disparaître d'un coup.
export function useKept<T>(value: T | null | undefined): T | null | undefined {
  const last = useRef(value)
  if (value !== null && value !== undefined) last.current = value
  return value ?? last.current
}

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
// Deux noms « pareils » : sans tenir compte des majuscules, des accents ni des espaces en trop.
const nameKey = (s: string) => plain(s).replace(/\s+/g, ' ').trim()
// Quelqu'un porte déjà ce nom (dans Personnes ou dans Employés) ? Le message à afficher, sinon rien.
export function nameTaken(persons: { id: string; name: string; type: string }[], name: string, exceptId?: string): string {
  const k = nameKey(name)
  if (!k) return ''
  const same = persons.find(p => p.id !== exceptId && nameKey(p.name) === k)
  if (!same) return ''
  return `« ${same.name} » existe déjà dans ${same.type === 'employee' ? 'Employés' : 'Personnes'}. Choisissez un autre nom.`
}
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

// Photo jointe (reçu, bordereau…) : réduite et compressée pour rester légère (≈ 100 à 200 Ko),
// gardée avec l'opération, sur le téléphone et en ligne.
export function compressImage(file: File, max = 1200, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image illisible'))
    }
    img.src = url
  })
}
