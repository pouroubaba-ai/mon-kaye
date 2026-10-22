import * as React from 'react'

import { LANDING_CSS, LANDING_HTML } from './landing-content'

// Page d'accueil publique : un visiteur pas connecté qui ouvre l'adresse principale (« / ») dans le navigateur.
// L'app installée sur le téléphone ne la montre jamais : elle ouvre directement la connexion.
// « Commencer » mène à /inscription, « Ouvrir l'appli » et « Se connecter » à /connexion.
export function LandingPage() {
  // Polices de la page (titres Sora, texte Inter), chargées seulement ici
  React.useEffect(() => {
    if (document.getElementById('kl-fonts')) return
    const link = document.createElement('link')
    link.id = 'kl-fonts'
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Inter:wght@400;500;600&display=swap'
    document.head.appendChild(link)
  }, [])
  // Liens vers une section (« Voir comment ça marche », le logo) : la page descend lentement, en douceur
  // (le défilement du navigateur est trop rapide). Durée selon la distance : environ 1,2 à 2 secondes.
  const onClick = (e: React.MouseEvent) => {
    const link = (e.target as HTMLElement).closest('a')
    const hash = link?.getAttribute('href')
    if (!hash?.startsWith('#')) return
    const target = document.getElementById(hash.slice(1))
    if (!target) return
    e.preventDefault()
    const from = window.scrollY
    const to = Math.max(0, target.getBoundingClientRect().top + from - 16)
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return window.scrollTo({ top: to, behavior: 'instant' })
    const duration = Math.min(2000, Math.max(1200, Math.abs(to - from) * 0.9))
    const start = performance.now()
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) // lent, puis plus vite, puis lent
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      window.scrollTo({ top: from + (to - from) * ease(t), behavior: 'instant' })
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }
  return (
    <div className="kaye-landing min-h-dvh" style={{ background: '#08090B' }} onClick={onClick}>
      <style>{LANDING_CSS}</style>
      <div dangerouslySetInnerHTML={{ __html: LANDING_HTML }} />
    </div>
  )
}
