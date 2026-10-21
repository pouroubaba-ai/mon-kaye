import * as React from 'react'

// Écran « kayé » à l'ouverture de l'app : une seconde au plus, seulement quand l'app démarre
// vraiment (ouverte après avoir été fermée, ou adresse ouverte dans un nouvel onglet).
// Pas en actualisant la page ni en changeant d'écran. L'app se charge derrière pendant ce temps.
// Comment on le sait : une marque gardée le temps de la « session » (sessionStorage). Elle survit
// à l'actualisation, mais disparaît quand on ferme l'app ou l'onglet.
const SEEN_KEY = 'kaye.splash'
const firstOpenOfSession = () => {
  try {
    if (sessionStorage.getItem(SEEN_KEY)) return false
    sessionStorage.setItem(SEEN_KEY, '1')
    return true
  } catch {
    return true
  }
}
const SHOW_MS = 750
const FADE_MS = 200

// Décidé une seule fois, au chargement de l'app
const SHOW_SPLASH = firstOpenOfSession()

// ready : l'app a fini de charger (compte et données). À l'ouverture de l'app, l'écran « kayé » reste
// affiché tant qu'elle n'est pas prête (un seul écran, jamais deux à la suite).
// En actualisant : pas d'écran « kayé » du tout.
export function SplashScreen({ ready = true }: { ready?: boolean }) {
  const [minDone, setMinDone] = React.useState(!SHOW_SPLASH)
  const [phase, setPhase] = React.useState<'on' | 'fading' | 'off'>(SHOW_SPLASH ? 'on' : 'off')

  React.useEffect(() => {
    if (minDone) return
    const t = setTimeout(() => setMinDone(true), SHOW_MS)
    return () => clearTimeout(t)
  }, [])

  // Prête et le temps minimum passé : l'écran s'efface
  React.useEffect(() => {
    if (ready && minDone && phase === 'on') setPhase('fading')
  }, [ready, minDone, phase])
  React.useEffect(() => {
    if (phase !== 'fading') return
    const t = setTimeout(() => setPhase('off'), FADE_MS)
    return () => clearTimeout(t)
  }, [phase])

  if (phase === 'off') return null

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-[#0B0C0F] transition-opacity"
      // Pendant qu'il s'efface, l'écran laisse passer les touchers (sinon le premier toucher serait perdu)
      style={{ opacity: phase === 'fading' ? 0 : 1, transitionDuration: `${FADE_MS}ms`, pointerEvents: phase === 'fading' ? 'none' : undefined }}
    >
      <style>{`
        @keyframes kaye-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        @keyframes kaye-gold { from { opacity: 0; filter: brightness(1.6) } to { opacity: 1; filter: none } }
      `}</style>
      <div className="text-7xl leading-none font-extrabold tracking-tight" style={{ animation: 'kaye-in 300ms ease-out both' }}>
        <span className="bg-[linear-gradient(135deg,#F2F4F7_0%,#B9BEC6_55%,#DDE1E6_100%)] bg-clip-text text-transparent">kay</span>
        <span
          className="bg-[linear-gradient(160deg,#FFF1BE_0%,#F2C14E_35%,#B9821F_62%,#F7D774_82%,#FFE9A0_100%)] bg-clip-text text-transparent"
          style={{ animation: 'kaye-gold 300ms ease-out 200ms both' }}
        >
          é
        </span>
      </div>
      <p className="text-base text-[#9AA0A8]" style={{ animation: 'kaye-in 300ms ease-out 100ms both' }}>
        Mon kayé de compte
      </p>
    </div>
  )
}
