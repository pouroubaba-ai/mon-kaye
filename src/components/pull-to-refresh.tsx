import * as React from 'react'
import { RotateCw } from 'lucide-react'

// « Tirer pour actualiser » dans l'app installée sur l'écran d'accueil (l'iPhone ne le propose pas
// dans ce mode). On tire l'écran vers le bas depuis le haut de la page : un cercle descend et tourne ;
// relâché assez bas, l'app se recharge (avec la dernière version). Dans Safari, le geste existe déjà :
// rien n'est ajouté. Pas de geste quand une fenêtre est ouverte.

const THRESHOLD = 70 // distance (px) à atteindre pour actualiser
const MAX = 110

const standalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true)

export function PullToRefresh() {
  const [pull, setPull] = React.useState(0)
  const [busy, setBusy] = React.useState(false)
  const start = React.useRef<number | null>(null)
  const pullRef = React.useRef(0)

  React.useEffect(() => {
    if (!standalone()) return
    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || document.querySelector('[role="dialog"]') || e.touches.length !== 1) return
      start.current = e.touches[0].clientY
    }
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return
      const d = e.touches[0].clientY - start.current
      if (d <= 0 || window.scrollY > 0) {
        pullRef.current = 0
        setPull(0)
        return
      }
      // Résistance : le cercle descend moins vite que le doigt
      const v = Math.min(MAX, d * 0.5)
      pullRef.current = v
      setPull(v)
    }
    const onEnd = () => {
      if (start.current === null) return
      start.current = null
      if (pullRef.current >= THRESHOLD) {
        setBusy(true)
        setPull(THRESHOLD)
        window.setTimeout(() => window.location.reload(), 250)
      } else {
        pullRef.current = 0
        setPull(0)
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  if (pull <= 0 && !busy) return null
  const ready = pull >= THRESHOLD
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center"
      style={{ transform: `translateY(${pull - 40}px)`, transition: start.current === null ? 'transform 200ms ease-out' : undefined }}
    >
      <div className="mt-[env(safe-area-inset-top)] flex size-10 items-center justify-center rounded-full border bg-background shadow-lg">
        <RotateCw
          className={`size-5 ${ready ? 'text-foreground' : 'text-muted-foreground'} ${busy ? 'animate-spin' : ''}`}
          style={busy ? undefined : { transform: `rotate(${pull * 3}deg)` }}
        />
      </div>
    </div>
  )
}
