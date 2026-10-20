import React, { useState } from 'react'
import { Blocks, Briefcase, Check, ChevronRight, LogOut, Moon, Sun, Users } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'

import { useStore } from '@/data/store'
import { slideIn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'

// Réglages : trois cartes shadcn standard (formulaire, apparence, données).
// Le verrouillage reste dans l'en-tête et la barre latérale : pas de doublon ici.

export const SettingsScreen: React.FC = () => {
  const { shop, setShopName, setShopPin, theme, toggleTheme, modules, setModule, logout, settingsView: view, setSettingsView: setView } = useStore()
  const [shopNameInput, setShopNameInput] = useState(shop.name)
  const [pinInput, setPinInput] = useState(shop.pin)
  const [saved, setSaved] = useState(false)
  const [askLogout, setAskLogout] = useState(false)

  const onNames = [modules.personnes && 'Personnes', modules.employes && 'Employés'].filter(Boolean).join(' · ')

  // On n'enregistre que si tout est bon : un nom, et un code de 4 chiffres
  const nameOk = shopNameInput.trim().length > 0
  const pinOk = /^\d{4}$/.test(pinInput)
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nameOk || !pinOk) return
    setShopName(shopNameInput.trim())
    setShopPin(pinInput)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Entrer dans « Modules » ou en revenir : la page glisse (comme une fiche)
  const boxRef = React.useRef<HTMLDivElement>(null)
  const prevView = React.useRef(view)
  React.useLayoutEffect(() => {
    if (prevView.current === view) return
    slideIn(boxRef.current, view === 'modules' ? 'forward' : 'back')
    prevView.current = view
  }, [view])

  // Liste des modules : on allume ou coupe chacun. Couper ne supprime rien.
  if (view === 'modules') {
    const MODS = [
      { key: 'personnes', title: 'Personnes', hint: 'Clients, fournisseurs : leurs comptes et les miens', Icon: Users },
      { key: 'employes', title: 'Employés', hint: 'Salaires, avances et la page Salaires', Icon: Briefcase },
    ] as const
    return (
      <div ref={boxRef} className="flex max-w-2xl flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">Gardez seulement ce que vous utilisez. Couper un module ne supprime rien : tout revient quand vous le rallumez.</p>
        </div>
        <Card className="py-0">
          <div className="flex flex-col divide-y">
            {MODS.map(m => {
              const on = modules[m.key]
              // Le dernier module allumé ne peut pas être coupé
              const last = on && !(m.key === 'personnes' ? modules.employes : modules.personnes)
              return (
                <label key={m.key} htmlFor={`module-${m.key}`} className="flex items-center gap-3 p-4">
                  <m.Icon className="size-5 shrink-0 text-muted-foreground" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium">{m.title}</span>
                    <span className="text-xs text-muted-foreground">{last ? 'Au moins un module doit rester allumé' : m.hint}</span>
                  </span>
                  <Switch id={`module-${m.key}`} checked={on} disabled={last} onCheckedChange={v => setModule(m.key, v)} />
                </label>
              )
            })}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div ref={boxRef} className="flex max-w-2xl flex-col gap-4">
      <Card>
        <form onSubmit={handleSave} className="flex flex-col gap-6">
          <CardHeader>
            <CardTitle>Commerce</CardTitle>
            <CardDescription>Le nom affiché en haut de l'écran et le code pour ouvrir l'application.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="shop-name">Nom du commerce</Label>
              <Input id="shop-name" value={shopNameInput} onChange={e => { setShopNameInput(e.target.value); setSaved(false) }} aria-invalid={!nameOk} />
              {!nameOk && <p className="text-xs text-destructive">Le nom ne peut pas être vide.</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="shop-pin">Code PIN (4 chiffres)</Label>
              <Input
                id="shop-pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinInput}
                onChange={e => { setPinInput(e.target.value.replace(/\D/g, '')); setSaved(false) }}
                aria-invalid={!pinOk}
                className="max-w-32 tracking-widest"
              />
              {!pinOk && <p className="text-xs text-destructive">Le code doit avoir 4 chiffres.</p>}
            </div>
          </CardContent>
          <CardFooter className="gap-3">
            <Button type="submit" disabled={!nameOk || !pinOk}>Enregistrer</Button>
            {saved && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Check className="size-4" /> Enregistré
              </span>
            )}
          </CardFooter>
        </form>
      </Card>

      {/* Modules : une ligne qui ouvre la liste des modules */}
      <Card className="py-0">
        <button type="button" onClick={() => setView('modules')} className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40 rounded-xl">
          <Blocks className="size-5 shrink-0 text-muted-foreground" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-medium">Modules</span>
            <span className="truncate text-xs text-muted-foreground">{onNames || 'Aucun'}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Affichage</CardTitle>
          <CardDescription>Le mode clair se lit mieux en plein soleil.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={theme} onValueChange={v => v !== theme && toggleTheme()}>
            <TabsList className="w-full">
              <TabsTrigger value="dark">
                <Moon /> Sombre
              </TabsTrigger>
              <TabsTrigger value="light">
                <Sun /> Clair
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Se déconnecter : demande d'abord, dans une petite fenêtre à part */}
      <Button variant="outline" size="lg" className="h-12 text-destructive hover:text-destructive" onClick={() => setAskLogout(true)}>
        <LogOut /> Se déconnecter
      </Button>
      <Dialog open={askLogout} onOpenChange={setAskLogout}>
        <DialogContent>
          <div className="flex flex-col gap-4">
            <DialogHeader className="gap-1 p-0">
              <DialogTitle className="text-left">Se déconnecter ?</DialogTitle>
              <DialogDescription className="text-left">Vos comptes restent gardés. Vous les retrouverez en vous reconnectant.</DialogDescription>
            </DialogHeader>
            <Button variant="destructive" size="lg" className="h-12" onClick={() => logout()}>
              Se déconnecter
            </Button>
            <Button variant="outline" size="lg" className="h-12" onClick={() => setAskLogout(false)}>
              Rester connecté
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
