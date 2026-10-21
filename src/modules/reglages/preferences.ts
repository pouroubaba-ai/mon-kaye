// Réglages : modules allumés et thème.
// - Modules : Partenaires (clients, fournisseurs) et Employés (salaires, avances). Un module coupé est
//   seulement caché : ses données restent. Au moins un reste allumé. Le choix est enregistré dans le
//   compte (avec la boutique) et gardé aussi sur l'appareil.
// - Thème : gardé sur l'appareil ; la première fois, celui du téléphone (sombre par défaut).

export type Modules = { personnes: boolean; employes: boolean }

// Compte neuf : Partenaires seulement
export const DEFAULT_MODULES: Modules = { personnes: true, employes: false }
const MODULES_KEY = 'kaye.modules'

export const cleanModules = (m: Partial<Modules>): Modules => {
  const out = { personnes: m.personnes !== false, employes: m.employes === true }
  return out.personnes || out.employes ? out : DEFAULT_MODULES
}

export const saveModulesLocal = (m: Modules) => {
  try {
    localStorage.setItem(MODULES_KEY, JSON.stringify(m))
  } catch {
    /* rien : le choix vaut pour cette fois */
  }
}

// Compte neuf sur ce téléphone : on repart de Partenaires seulement
export const resetModulesLocal = () => saveModulesLocal(DEFAULT_MODULES)

export const loadModulesLocal = (): Modules => {
  try {
    const raw = localStorage.getItem(MODULES_KEY)
    return raw ? cleanModules(JSON.parse(raw)) : DEFAULT_MODULES
  } catch {
    return DEFAULT_MODULES
  }
}

export type Theme = 'dark' | 'light'

export const loadTheme = (): Theme => {
  try {
    const t = localStorage.getItem('kaye.theme')
    if (t === 'dark' || t === 'light') return t
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export const saveTheme = (t: Theme) => {
  try {
    localStorage.setItem('kaye.theme', t)
  } catch {
    /* rien : le choix vaut pour cette fois */
  }
}
