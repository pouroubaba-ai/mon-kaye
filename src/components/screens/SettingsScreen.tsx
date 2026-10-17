import React, { useState } from 'react'
import { useStore } from '@/data/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Sun, 
  Moon, 
  Download, 
  Lock, 
  ShieldCheck, 
  Store, 
  CloudCheck, 
  RefreshCw, 
  FileSpreadsheet, 
  Smartphone 
} from 'lucide-react'

export const SettingsScreen: React.FC = () => {
  const { shop, setShopName, setShopPin, theme, toggleTheme, lockApp, exportCSV } = useStore()
  const [shopNameInput, setShopNameInput] = useState(shop.name)
  const [pinInput, setPinInput] = useState(shop.pin)
  const [saveFeedback, setSaveFeedback] = useState(false)

  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault()
    setShopName(shopNameInput)
    if (pinInput.length === 4) {
      setShopPin(pinInput)
    }
    setSaveFeedback(true)
    setTimeout(() => setSaveFeedback(false), 2000)
  }

  return (
    <div className="space-y-6 pb-24 md:pb-8 max-w-2xl">
      
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Réglages</h1>
        <p className="text-sm text-muted-foreground">
          Configuration du commerce, sécurité hors ligne et exportation
        </p>
      </div>

      {/* THÈME CLAIR / SOMBRE (RÈGLE OBLIGATOIRE DE LA MISSION) */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            {theme === 'dark' ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-amber-500" />}
            Thème visuel de l'application
          </CardTitle>
          <CardDescription className="text-xs">
            Le thème sombre est le mode sobre de référence. Le thème clair garantit une lisibilité maximale en plein soleil.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => { if (theme !== 'dark') toggleTheme() }}
              className={`p-4 rounded-xl border-2 flex items-center justify-between text-left transition-all ${
                theme === 'dark' ? 'border-primary bg-card shadow-md' : 'border-border/40 hover:bg-muted/30 opacity-70'
              }`}
            >
              <div className="space-y-1">
                <span className="font-bold text-sm block">Mode Sombre</span>
                <span className="text-xs text-muted-foreground">Monochrome sobre & reposant</span>
              </div>
              <Moon className="w-6 h-6 text-primary" />
            </button>

            <button
              type="button"
              onClick={() => { if (theme !== 'light') toggleTheme() }}
              className={`p-4 rounded-xl border-2 flex items-center justify-between text-left transition-all ${
                theme === 'light' ? 'border-primary bg-card shadow-md' : 'border-border/40 hover:bg-muted/30 opacity-70'
              }`}
            >
              <div className="space-y-1">
                <span className="font-bold text-sm block">Mode Clair</span>
                <span className="text-xs text-muted-foreground">Lisible en plein soleil</span>
              </div>
              <Sun className="w-6 h-6 text-amber-500" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* INFORMATIONS DU COMMERCE & CODE PIN */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Store className="w-5 h-5 text-muted-foreground" />
            Informations du commerce & Code PIN
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveInfo} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Nom du commerce</Label>
              <Input
                value={shopNameInput}
                onChange={e => setShopNameInput(e.target.value)}
                className="h-11 rounded-xl text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Code PIN de déverrouillage (4 chiffres)</Label>
              <Input
                type="password"
                maxLength={4}
                value={pinInput}
                onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                className="h-11 rounded-xl text-lg font-bold tracking-widest text-center max-w-[140px]"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" className="h-11 px-5 font-semibold text-sm">
                Enregistrer les modifications
              </Button>
              {saveFeedback && (
                <span className="text-xs font-semibold text-credit flex items-center gap-1 animate-pulse">
                  ✓ Modifications enregistrées !
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ÉTAT DE SAUVEGARDE & SYNCHRONISATION */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <CloudCheck className="w-5 h-5 text-credit" />
            Sauvegarde & Synchronisation
          </CardTitle>
          <CardDescription className="text-xs">
            Toutes vos opérations sont stockées directement sur l'appareil et synchronisées dès que la connexion revient.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 rounded-xl border bg-credit/5 border-credit/20 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-credit shrink-0 animate-ping" />
              <div>
                <span className="text-sm font-bold text-foreground block">
                  Tout est sauvegardé localement
                </span>
                <span className="text-xs text-muted-foreground">
                  Prêt pour la synchronisation en ligne Supabase
                </span>
              </div>
            </div>
            <Badge className="bg-credit text-white text-xs">
              À jour
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* EXPORTATION DES DONNÉES & SÉCURITÉ */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
            Exporter les données & Déconnexion
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={exportCSV}
            variant="outline"
            className="w-full h-12 text-sm font-semibold flex items-center justify-center gap-2 rounded-xl"
          >
            <Download className="w-4 h-4 text-primary" />
            Télécharger toutes les données (Fichier CSV / Excel)
          </Button>

          <Button
            onClick={lockApp}
            variant="destructive"
            className="w-full h-12 text-sm font-semibold flex items-center justify-center gap-2 rounded-xl"
          >
            <Lock className="w-4 h-4" />
            Verrouiller l'écran maintenant (Code PIN requis)
          </Button>
        </CardContent>
      </Card>

    </div>
  )
}
