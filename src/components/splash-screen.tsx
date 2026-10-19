import * as React from 'react'

// Écran « kayé » à l'ouverture de l'app : une seconde au plus, seulement quand l'app démarre
// (pas en revenant d'un autre écran). L'app se charge derrière pendant ce temps.
const SHOW_MS = 750
const FADE_MS = 200

export function SplashScreen() {
  const [phase, setPhase] = React.useState<'on' | 'fading' | 'off'>('on')

  React.useEffect(() => {
    const t1 = setTimeout(() => setPhase('fading'), SHOW_MS)
    const t2 = setTimeout(() => setPhase('off'), SHOW_MS + FADE_MS)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  if (phase === 'off') return null

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-[#0B0C0F] transition-opacity"
      style={{ opacity: phase === 'fading' ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
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
