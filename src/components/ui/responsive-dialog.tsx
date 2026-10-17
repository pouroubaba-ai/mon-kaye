import * as React from "react"

import { cn } from "@/lib/utils"
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
}

function Dialog({ open, onOpenChange, children }: RootProps) {
  const isMobile = useIsMobile()
  return (
    <IsMobileContext.Provider value={isMobile}>
      {isMobile ? (
        <Drawer open={open} onOpenChange={onOpenChange}>
          {children}
        </Drawer>
      ) : (
        <BaseDialog open={open} onOpenChange={onOpenChange}>
          {children}
        </BaseDialog>
      )}
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
