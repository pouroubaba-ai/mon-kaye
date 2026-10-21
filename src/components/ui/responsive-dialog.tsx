import * as React from "react"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Dialog as BaseDialog,
  DialogContent as BaseDialogContent,
  DialogDescription as BaseDialogDescription,
  DialogHeader as BaseDialogHeader,
  DialogTitle as BaseDialogTitle,
} from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"

// Modèle « responsive dialog » de la documentation shadcn/ui :
// panneau qui monte du bas (Drawer) sur téléphone, fenêtre (Dialog) sur ordinateur.
// Même API que Dialog, pour pouvoir remplacer l'import sans réécrire les fenêtres.
//
// Fermer : la croix en haut à droite, toucher à côté, Échap, ou (téléphone) glisser vraiment vers le bas :
// il faut tirer le panneau d'au moins un tiers de sa hauteur ; un petit geste rapide ne ferme rien.
// Saisie en cours (dirty) : on demande d'abord « Abandonner ? ». « Continuer la saisie » laisse le panneau
// en place, sans le refermer ni le rouvrir.

type Ctx = { isMobile: boolean; requestClose: () => void; dirty: boolean; close: () => void }
const DialogCtx = React.createContext<Ctx>({ isMobile: false, requestClose: () => {}, dirty: false, close: () => {} })

type RootProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
  // La fenêtre contient une saisie non enregistrée : fermer demande d'abord confirmation.
  dirty?: boolean
  // « ajout » ou « modification » : choisit les mots de la confirmation.
  dirtyKind?: "ajout" | "modification"
}

function Dialog({ open, onOpenChange, children, dirty = false, dirtyKind = "modification" }: RootProps) {
  const isMobile = useIsMobile()
  const [confirming, setConfirming] = React.useState(false)

  const requestClose = () => {
    if (dirty) setConfirming(true)
    else onOpenChange?.(false)
  }
  // Ouvrir passe directement ; fermer passe par requestClose (jamais de fermeture « dans le dos »)
  const onRootChange = (next: boolean) => (next ? onOpenChange?.(true) : requestClose())

  return (
    <DialogCtx.Provider value={{ isMobile, requestClose, dirty, close: () => onOpenChange?.(false) }}>
      {isMobile ? (
        // iPhone : le panneau ne bouge plus quand le clavier s'ouvre (sinon le clavier s'ouvre puis se referme).
        // handleOnly : le glissement de vaul est coupé (un petit geste rapide fermait tout) ;
        // c'est DialogContent qui gère le glissement vers le bas, avec un vrai seuil.
        <Drawer open={open} onOpenChange={onRootChange} repositionInputs={false} handleOnly>
          {children}
        </Drawer>
      ) : (
        <BaseDialog open={open} onOpenChange={onRootChange}>
          {children}
        </BaseDialog>
      )}

      {/* Confirmation : « Continuer la saisie » est le choix mis en avant */}
      <BaseDialog open={confirming} onOpenChange={setConfirming}>
        <BaseDialogContent showCloseButton={false} className="sm:max-w-sm">
          <BaseDialogHeader>
            <BaseDialogTitle>{dirtyKind === "ajout" ? "Abandonner l'ajout ?" : "Abandonner les modifications ?"}</BaseDialogTitle>
            <BaseDialogDescription>Ce que vous avez saisi ne sera pas enregistré.</BaseDialogDescription>
          </BaseDialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setConfirming(false)
                onOpenChange?.(false)
              }}
            >
              Abandonner
            </Button>
            <Button autoFocus onClick={() => setConfirming(false)}>
              Continuer la saisie
            </Button>
          </div>
        </BaseDialogContent>
      </BaseDialog>
    </DialogCtx.Provider>
  )
}

// Glisser vers le bas pour fermer (téléphone). Le panneau suit le doigt ; relâché assez bas, on ferme
// (ou on demande « Abandonner ? »), sinon il remonte en douceur.
const CLOSE_RATIO = 0.33 // part de la hauteur du panneau à tirer
const CLOSE_MIN = 120 // en pixels, au moins

function useSwipeToClose(el: HTMLDivElement | null, ctx: Ctx) {
  const live = React.useRef(ctx)
  live.current = ctx
  React.useEffect(() => {
    if (!el) return
    let startY = 0
    let dy = 0
    let tracking = false
    let dragging = false

    // Un élément qui défile et n'est pas tout en haut : le geste fait défiler, il ne tire pas le panneau
    const scrolledInside = (target: EventTarget | null) => {
      let n = target as HTMLElement | null
      while (n && n !== el) {
        if (n.scrollTop > 0) return true
        n = n.parentElement
      }
      return el.scrollTop > 0
    }
    const setY = (y: number, animate: boolean) => {
      el.style.transition = animate ? "transform 250ms cubic-bezier(0.32, 0.72, 0, 1)" : "none"
      el.style.transform = y ? `translate3d(0, ${y}px, 0)` : ""
    }
    const onStart = (e: TouchEvent) => {
      const t = e.target as HTMLElement | null
      if (e.touches.length !== 1 || t?.closest("input, textarea, select, [data-no-swipe]") || scrolledInside(t)) {
        tracking = false
        return
      }
      tracking = true
      dragging = false
      startY = e.touches[0].clientY
      dy = 0
    }
    const onMove = (e: TouchEvent) => {
      if (!tracking) return
      dy = e.touches[0].clientY - startY
      if (!dragging) {
        if (dy < 10) {
          if (dy < -4) tracking = false // vers le haut : c'est un défilement
          return
        }
        dragging = true
      }
      e.preventDefault() // le panneau suit le doigt, la page ne défile pas
      setY(Math.max(0, dy - 10), false)
    }
    const onEnd = () => {
      if (!tracking) return
      tracking = false
      if (!dragging) return
      dragging = false
      const height = el.getBoundingClientRect().height
      const far = Math.max(CLOSE_MIN, height * CLOSE_RATIO)
      if (dy - 10 >= far && !live.current.dirty) {
        // Fermer : le panneau continue de descendre depuis là où est le doigt, puis la fenêtre se ferme
        // (sans rejouer l'animation de fermeture, qui le ferait remonter d'abord)
        setY(height, true)
        window.setTimeout(() => {
          el.style.animation = "none"
          live.current.close()
        }, 230)
        return
      }
      // Pas assez loin, ou une saisie est en cours : le panneau remonte à sa place, sans se refermer.
      // Avec une saisie en cours, on demande ensuite « Abandonner ? » ; « Continuer » ne fait rien bouger.
      setY(0, true)
      window.setTimeout(() => {
        el.style.transition = ""
      }, 260)
      if (dy - 10 >= far) live.current.requestClose()
    }
    el.addEventListener("touchstart", onStart, { passive: true })
    el.addEventListener("touchmove", onMove, { passive: false })
    el.addEventListener("touchend", onEnd)
    el.addEventListener("touchcancel", onEnd)
    return () => {
      el.removeEventListener("touchstart", onStart)
      el.removeEventListener("touchmove", onMove)
      el.removeEventListener("touchend", onEnd)
      el.removeEventListener("touchcancel", onEnd)
    }
  }, [el])
}

// fixedHeight : la fenêtre garde la même hauteur quel que soit son contenu ;
// c'est le contenu qui défile à l'intérieur (pas de saut quand on change d'écran).
function DialogContent({
  className,
  children,
  fixedHeight = false,
}: {
  className?: string
  children?: React.ReactNode
  fixedHeight?: boolean
}) {
  const ctx = React.useContext(DialogCtx)
  const { isMobile, requestClose } = ctx
  // Le panneau arrive après coup (dans un portail) : on attend qu'il soit là pour écouter le doigt
  const [panel, setPanel] = React.useState<HTMLDivElement | null>(null)
  useSwipeToClose(panel, ctx)
  // Toucher à côté ou Échap : on passe par requestClose (confirmation si une saisie est en cours)
  const outside = (e: Event) => {
    e.preventDefault()
    requestClose()
  }
  if (isMobile) {
    return (
      <DrawerContent
        ref={setPanel}
        // Pas de clavier qui s'ouvre tout seul pendant que le panneau monte : on touche le champ pour écrire
        onOpenAutoFocus={e => e.preventDefault()}
        showHandle={false}
        onPointerDownOutside={outside}
        onEscapeKeyDown={outside}
        className={
          fixedHeight
            ? "data-[vaul-drawer-direction=bottom]:h-[85dvh] data-[vaul-drawer-direction=bottom]:max-h-[85dvh]"
            : "data-[vaul-drawer-direction=bottom]:max-h-[92dvh]"
        }
      >
        {/* Petite poignée : montre qu'on peut tirer le panneau vers le bas */}
        <div aria-hidden className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
        <button
          type="button"
          aria-label="Fermer"
          onClick={requestClose}
          className="absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <XIcon className="size-5" />
        </button>
        <div className={cn("px-4 pt-2 pb-6", fixedHeight ? "flex min-h-0 flex-1 flex-col" : "overflow-y-auto")}>{children}</div>
      </DrawerContent>
    )
  }
  return (
    <BaseDialogContent
      onPointerDownOutside={outside}
      onEscapeKeyDown={outside}
      className={cn(
        "sm:max-w-lg",
        fixedHeight ? "flex h-[min(680px,90vh)] flex-col" : "max-h-[90vh] overflow-y-auto",
        className
      )}
    >
      {children}
    </BaseDialogContent>
  )
}

function DialogHeader({ className, children }: { className?: string; children?: React.ReactNode }) {
  const { isMobile } = React.useContext(DialogCtx)
  // Place laissée à droite pour la croix
  if (isMobile) return <DrawerHeader className={cn("px-0 text-left", className, "pr-11")}>{children}</DrawerHeader>
  return <BaseDialogHeader className={className}>{children}</BaseDialogHeader>
}

function DialogTitle({ className, children }: { className?: string; children?: React.ReactNode }) {
  const { isMobile } = React.useContext(DialogCtx)
  if (isMobile) return <DrawerTitle className={className}>{children}</DrawerTitle>
  return <BaseDialogTitle className={className}>{children}</BaseDialogTitle>
}

function DialogDescription({ className, children }: { className?: string; children?: React.ReactNode }) {
  const { isMobile } = React.useContext(DialogCtx)
  if (isMobile) return <DrawerDescription className={className}>{children}</DrawerDescription>
  return <BaseDialogDescription className={className}>{children}</BaseDialogDescription>
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription }
