import * as React from "react"

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

const IsMobileContext = React.createContext(false)

type RootProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
  // La fenêtre contient une saisie non enregistrée : fermer (toucher à côté, glisser, Échap,
  // croix) demande d'abord confirmation.
  dirty?: boolean
  // « ajout » ou « modification » : choisit les mots de la confirmation.
  dirtyKind?: "ajout" | "modification"
}

function Dialog({ open, onOpenChange, children, dirty = false, dirtyKind = "modification" }: RootProps) {
  const isMobile = useIsMobile()
  const [confirming, setConfirming] = React.useState(false)
  // Sur téléphone, un glissement vers le bas a déjà fait descendre le panneau :
  // si l'on continue la saisie, on le remonte (nouveau montage du panneau, la saisie est conservée).
  const [drawerKey, setDrawerKey] = React.useState(0)

  const requestChange = (next: boolean) => {
    if (!next && dirty) {
      setConfirming(true)
      return
    }
    onOpenChange?.(next)
  }

  return (
    <IsMobileContext.Provider value={isMobile}>
      {isMobile ? (
        <Drawer key={drawerKey} open={open} onOpenChange={requestChange}>
          {children}
        </Drawer>
      ) : (
        <BaseDialog open={open} onOpenChange={requestChange}>
          {children}
        </BaseDialog>
      )}

      {/* Confirmation : « Continuer la saisie » est le choix mis en avant */}
      <BaseDialog
        open={confirming}
        onOpenChange={o => {
          setConfirming(o)
          if (!o && isMobile) setDrawerKey(k => k + 1)
        }}
      >
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
            <Button
              autoFocus
              onClick={() => {
                setConfirming(false)
                if (isMobile) setDrawerKey(k => k + 1)
              }}
            >
              Continuer la saisie
            </Button>
          </div>
        </BaseDialogContent>
      </BaseDialog>
    </IsMobileContext.Provider>
  )
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
  const isMobile = React.useContext(IsMobileContext)
  if (isMobile) {
    return (
      <DrawerContent
        className={
          fixedHeight
            ? "data-[vaul-drawer-direction=bottom]:h-[85dvh] data-[vaul-drawer-direction=bottom]:max-h-[85dvh]"
            : "data-[vaul-drawer-direction=bottom]:max-h-[92dvh]"
        }
      >
        <div className={cn("px-4 pb-6", fixedHeight ? "flex min-h-0 flex-1 flex-col" : "overflow-y-auto")}>{children}</div>
      </DrawerContent>
    )
  }
  return (
    <BaseDialogContent
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
  const isMobile = React.useContext(IsMobileContext)
  if (isMobile) return <DrawerHeader className={cn("px-0 text-left", className)}>{children}</DrawerHeader>
  return <BaseDialogHeader className={className}>{children}</BaseDialogHeader>
}

function DialogTitle({ className, children }: { className?: string; children?: React.ReactNode }) {
  const isMobile = React.useContext(IsMobileContext)
  if (isMobile) return <DrawerTitle className={className}>{children}</DrawerTitle>
  return <BaseDialogTitle className={className}>{children}</BaseDialogTitle>
}

function DialogDescription({ className, children }: { className?: string; children?: React.ReactNode }) {
  const isMobile = React.useContext(IsMobileContext)
  if (isMobile) return <DrawerDescription className={className}>{children}</DrawerDescription>
  return <BaseDialogDescription className={className}>{children}</BaseDialogDescription>
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription }
