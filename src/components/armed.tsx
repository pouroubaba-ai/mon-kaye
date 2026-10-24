import React from 'react'

// Ouverture volontaire d'une ligne : le 1er toucher l'entoure en or (« Touche encore pour voir le détail »),
// le 2e toucher sur la même ligne ouvre le détail. Toucher une autre ligne la prend à la place ;
// sans 2e toucher, la ligne se relâche toute seule après quelques secondes.
export function useArmed(delay = 4000) {
  const [armed, setArmed] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(null), delay)
    return () => clearTimeout(t)
  }, [armed, delay])
  const tap = (key: string, open: () => void) => {
    if (armed === key) {
      setArmed(null)
      open()
    } else setArmed(key)
  }
  return { armed, tap, release: () => setArmed(null) }
}

// Style d'une ligne prise (même taille : seul un contour or s'ajoute, rien ne bouge)
export const ARMED_ROW = 'rounded-xl bg-kgold/5 ring-2 ring-kgold ring-inset'
export const ARMED_HINT = 'Touche encore pour voir le détail'

// Plusieurs billets (pour le bouton Versement)
export function Banknotes({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M7 3.5h13a1 1 0 0 1 1 1v8" />
      <path d="M4.5 6.5h13a1 1 0 0 1 1 1v8" />
      <rect x="2" y="9.5" width="14" height="10" rx="1.5" />
      <circle cx="9" cy="14.5" r="2" />
      <path d="M5 12.5v.01M13 16.5v.01" />
    </svg>
  )
}
