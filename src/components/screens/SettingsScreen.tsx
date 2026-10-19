import React, { useState } from 'react'
import { ArrowLeft, Blocks, Briefcase, Check, ChevronRight, Download, Moon, Sun, Users } from 'lucide-react'

import { useStore } from '@/data/store'
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
  const { shop, setShopName, setShopPin, theme, toggleTheme, exportCSV, modules, setModule } = useStore()
  const [shopNameInput, setShopNameInput] = useState(shop.name)
  const [pinInput, setPinInput] = useState(shop.pin)
  const [saved, setSaved] = useState(false)

  const [view, setView] = useState<'main' | 'modules'>('main')
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

  // Liste des modules : on allume ou coupe chacun. Couper ne supprime rien.
  if (view === 'modules') {
    const MODS = [
      { key: 'personnes', title: 'Personnes', hint: 'Clients, fournisseurs : leurs comptes et les miens', Icon: Users },
      { key: 'employes', title: 'Employés', hint: 'Salaires, avances et la page Salaires', Icon: Briefcase },
    ] as const
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <button type="button" onClick={() => setView('main')} className="flex items-center gap-2 self-start text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Réglages
        </button>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Modules</h2>
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
    <div className="flex max-w-2xl flex-col gap-4">
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

      <Card>
        <CardHeader>
          <CardTitle>Données</CardTitle>
          <CardDescription>
            Version de démonstration : les chiffres sont des exemples et ne sont pas encore enregistrés.
          </CardDescription>
          <CardAction>
            <Badge variant="outline">Démonstration</Badge>
          </CardAction>
        </CardHeader>
        <CardFooter>
          <Button variant="outline" onClick={exportCSV}>
            <Download /> Télécharger en fichier Excel (CSV)
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
