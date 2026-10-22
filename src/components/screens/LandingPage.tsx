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
  return (
    <div className="kaye-landing min-h-dvh" style={{ background: '#08090B' }}>
      <style>{LANDING_CSS}</style>
      <div dangerouslySetInnerHTML={{ __html: LANDING_HTML }} />
    </div>
  )
}
