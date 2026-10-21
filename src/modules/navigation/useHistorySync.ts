import * as React from 'react'

import type { Person } from '@/data/mockData'
import type { Modules } from '@/modules/reglages/preferences'
import { buildPath, parsePath, type Screen } from './routes'

// Adresse ⇄ écran, et la pile de retour de Safari / du téléphone.
// - Descendre (ouvrir une fiche, « Leurs/Mes comptes », Réglages › Modules) ajoute un écran à la pile :
//   le retour (ou le glissement depuis le bord) remonte à l'écran d'où l'on vient.
// - Changer d'écran principal (barre du bas, menu) remplace l'écran du dessus : les onglets ne
//   s'empilent pas, donc sur un écran principal le glissement ne saute pas vers un autre onglet.
// - Remonter avec le fil d'Ariane revient d'un cran dans la pile (comme le geste retour).
// - Fenêtre ouverte : le retour ferme la fenêtre (comme Échap), l'écran ne bouge pas.
export function useHistorySync(screen: Screen, persons: Person[], modules: Modules, show: (s: Screen) => void) {
  const path = buildPath(screen, persons)
  const depth = (screen.person ? 1 : 0) + (screen.accounts ? 1 : 0) + (screen.settings === 'modules' ? 1 : 0)
  const fromHistory = React.useRef(false)
  const prevDepth = React.useRef(depth)
  type Entry = { kaye: number; parent: string | null }
  const url = (p: string) => p + window.location.search

  React.useEffect(() => {
    const before = prevDepth.current
    prevDepth.current = depth
    const cur = (window.history.state ?? null) as Entry | null
    if (fromHistory.current) {
      fromHistory.current = false
      if (window.location.pathname !== path) window.history.replaceState({ kaye: depth, parent: cur?.parent ?? null }, '', url(path))
      return
    }
    const here = window.location.pathname
    if (here === path) {
      if (!cur || cur.kaye === undefined) window.history.replaceState({ kaye: depth, parent: null }, '', url(path))
      return
    }
    if (depth > before) {
      // On descend : nouvel écran sur la pile, qui se souvient de l'écran d'où l'on vient
      window.history.pushState({ kaye: depth, parent: here }, '', url(path))
    } else if (depth < before && cur?.parent === path) {
      // On remonte vers l'écran d'où l'on venait : un cran en arrière dans la pile
      fromHistory.current = true
      window.history.back()
    } else {
      // Même niveau (changement d'onglet) : on remplace, rien ne s'empile
      window.history.replaceState({ kaye: depth, parent: depth > 0 ? (cur?.parent ?? null) : null }, '', url(path))
    }
  }, [path])

  const pathRef = React.useRef(path)
  pathRef.current = path
  // L'entrée de pile de l'écran affiché (pour la remettre si le retour a seulement fermé une fenêtre)
  const lastEntry = React.useRef<unknown>(null)
  React.useEffect(() => {
    lastEntry.current = window.history.state
  })
  const live = React.useRef({ modules, persons, show })
  live.current = { modules, persons, show }

  React.useEffect(() => {
    const onPop = () => {
      if (document.querySelector('[role="dialog"]')) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        window.history.pushState(lastEntry.current, '', pathRef.current + window.location.search)
        return
      }
      const { modules, persons, show } = live.current
      const next = parsePath(window.location.pathname, modules, persons)
      const nextPath = buildPath(next, persons)
      if (nextPath === pathRef.current) {
        // Même écran (par exemple après un retour demandé par le fil d'Ariane) ou adresse inconnue :
        // on corrige seulement l'adresse
        fromHistory.current = false
        if (window.location.pathname !== nextPath) window.history.replaceState(null, '', nextPath + window.location.search)
        return
      }
      fromHistory.current = true
      show(next)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
}
