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

function DialogContent({ className, children }: { className?: string; children?: React.ReactNode }) {
  const isMobile = React.useContext(IsMobileContext)
  if (isMobile) {
    return (
      <DrawerContent className="max-h-[92dvh]">
        <div className="overflow-y-auto px-4 pb-8">{children}</div>
      </DrawerContent>
    )
  }
  return (
    <BaseDialogContent className={cn("max-h-[90vh] overflow-y-auto sm:max-w-lg", className)}>
      {children}
    </BaseDialogContent>
  )
}

function DialogHeader({ className, children }: { className?: string; children?: React.ReactNode }) {
  const isMobile = React.useContext(IsMobileContext)
  if (isMobile) return <DrawerHeader className="px-0 text-left">{children}</DrawerHeader>
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
