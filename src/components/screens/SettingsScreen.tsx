import React, { useState } from 'react'
import { Check, Download, Moon, Sun } from 'lucide-react'

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

// Réglages : trois cartes shadcn standard (formulaire, apparence, données).
// Le verrouillage reste dans l'en-tête et la barre latérale : pas de doublon ici.

export const SettingsScreen: React.FC = () => {
  const { shop, setShopName, setShopPin, theme, toggleTheme, exportCSV } = useStore()
  const [shopNameInput, setShopNameInput] = useState(shop.name)
  const [pinInput, setPinInput] = useState(shop.pin)
  const [saved, setSaved] = useState(false)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setShopName(shopNameInput)
    if (pinInput.length === 4) setShopPin(pinInput)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Réglages</h1>
        <p className="text-sm text-muted-foreground">Votre commerce, l'affichage et vos données.</p>
      </div>

      <Card>
        <form onSubmit={handleSave} className="flex flex-col gap-6">
          <CardHeader>
            <CardTitle>Commerce</CardTitle>
            <CardDescription>Le nom affiché en haut de l'écran et le code pour ouvrir l'application.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="shop-name">Nom du commerce</Label>
              <Input id="shop-name" value={shopNameInput} onChange={e => setShopNameInput(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="shop-pin">Code PIN (4 chiffres)</Label>
              <Input
                id="shop-pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinInput}
                onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                className="max-w-32 tracking-widest"
              />
            </div>
          </CardContent>
          <CardFooter className="gap-3">
            <Button type="submit">Enregistrer</Button>
            {saved && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Check className="size-4" /> Enregistré
              </span>
            )}
          </CardFooter>
        </form>
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
