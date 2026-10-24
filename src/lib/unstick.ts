// Garde-fou : l'écran ne doit jamais rester « mort » après la fermeture d'une fenêtre.
// Les fenêtres (panneaux qui montent du bas, boîtes de dialogue) bloquent les touchers sur le reste
// de la page tant qu'elles sont ouvertes, et figent la page sur iPhone. Si l'une se ferme en même temps
// qu'une autre s'ouvre, ou que l'écran change au même moment, ce blocage peut rester collé : la page
// ne répond plus jusqu'à ce qu'on la fasse défiler. Ici, dès qu'aucune fenêtre n'est ouverte, on enlève
// ce qui reste — et on vérifie aussi au moment où le doigt touche l'écran, avant que le toucher soit traité.

const OPEN = '[role="dialog"][data-state="open"], [data-vaul-drawer][data-state="open"], [role="alertdialog"][data-state="open"]'

export function unstick() {
  if (document.querySelector(OPEN)) return
  const b = document.body
  if (b.style.pointerEvents === 'none') b.style.pointerEvents = ''
  // Page figée par une fenêtre (iPhone) : on la remet à sa place, à la même hauteur
  if (b.style.position === 'fixed') {
    const y = -parseInt(b.style.top || '0', 10) || 0
    b.style.removeProperty('position')
    b.style.top = ''
    b.style.left = ''
    b.style.right = ''
    b.style.height = ''
    if (y) window.scrollTo(0, y)
  }
  if (b.hasAttribute('data-scroll-locked')) b.removeAttribute('data-scroll-locked')
}

export function installUnstick() {
  let timer = 0
  const later = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(unstick, 700) // après l'animation de fermeture
  }
  const mo = new MutationObserver(later)
  mo.observe(document.body, { attributes: true, attributeFilter: ['style', 'data-scroll-locked'], childList: true })
  const now = () => unstick()
  document.addEventListener('touchstart', now, { capture: true, passive: true })
  document.addEventListener('pointerdown', now, true)
  return () => {
    mo.disconnect()
    window.clearTimeout(timer)
    document.removeEventListener('touchstart', now, { capture: true })
    document.removeEventListener('pointerdown', now, true)
  }
}
