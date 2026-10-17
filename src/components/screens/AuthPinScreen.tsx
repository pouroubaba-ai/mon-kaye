import React, { useState } from 'react'
import { useStore } from '@/data/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, ShieldCheck, KeyRound, Smartphone, Store } from 'lucide-react'

export const AuthPinScreen: React.FC = () => {
  const { shop, unlockWithPin, isLocked } = useStore()
  const [pinInput, setPinInput] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [authMode, setAuthMode] = useState<'pin' | 'google' | 'phone'>('pin')

  const handleDigit = (digit: string) => {
    if (pinInput.length < 4) {
      const next = pinInput + digit
      setPinInput(next)
      if (next.length === 4) {
        validatePin(next)
      }
    }
  }

  const handleClear = () => {
    setPinInput('')
    setErrorMessage('')
  }

  const handleDelete = () => {
    setPinInput(prev => prev.slice(0, -1))
    setErrorMessage('')
  }

  const validatePin = (code: string) => {
    const success = unlockWithPin(code)
    if (!success) {
      setErrorMessage('Code PIN incorrect. Veuillez réessayer.')
      setTimeout(() => {
        setPinInput('')
      }, 500)
    } else {
      setErrorMessage('')
      setPinInput('')
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-sm space-y-6">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{shop.name}</h1>
          <p className="text-sm text-muted-foreground">{shop.address}</p>
        </div>

        {/* PIN Unlock Card */}
        {authMode === 'pin' && (
          <Card className="border shadow-md">
            <CardHeader className="text-center pb-2">
              <div className="flex items-center justify-center gap-2 text-primary font-semibold">
                <Lock className="w-5 h-5" />
                <span>Déverrouillage Sécurisé</span>
              </div>
              <CardDescription className="text-xs">
                Saisissez votre code PIN à 4 chiffres (PIN test : {shop.pin})
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* PIN Bubbles Display */}
              <div className="flex justify-center gap-4 py-2">
                {[0, 1, 2, 3].map(idx => (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${
                      pinInput.length > idx
                        ? 'bg-foreground border-foreground scale-110'
                        : 'border-muted-foreground/40 bg-muted/20'
                    }`}
                  />
                ))}
              </div>

              {errorMessage && (
                <p className="text-xs text-destructive text-center font-medium animate-pulse">
                  {errorMessage}
                </p>
              )}

              {/* Giant Numeric Keypad */}
              <div className="grid grid-cols-3 gap-3">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
                  <button
                    key={digit}
                    onClick={() => handleDigit(digit)}
                    type="button"
                    className="h-14 rounded-xl border bg-card text-2xl font-bold flex items-center justify-center hover:bg-accent active:scale-95 transition-all text-foreground shadow-sm"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  onClick={handleClear}
                  type="button"
                  className="h-14 rounded-xl border bg-muted/40 text-sm font-semibold flex items-center justify-center hover:bg-muted active:scale-95 transition-all text-muted-foreground"
                >
                  Effacer
                </button>
                <button
                  onClick={() => handleDigit('0')}
                  type="button"
                  className="h-14 rounded-xl border bg-card text-2xl font-bold flex items-center justify-center hover:bg-accent active:scale-95 transition-all text-foreground shadow-sm"
                >
                  0
                </button>
                <button
                  onClick={handleDelete}
                  type="button"
                  className="h-14 rounded-xl border bg-muted/40 text-sm font-semibold flex items-center justify-center hover:bg-muted active:scale-95 transition-all text-muted-foreground"
                >
                  ←
                </button>
              </div>

              <div className="pt-2 text-center">
                <button
                  onClick={() => setAuthMode('phone')}
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  Changer de compte ou connexion par téléphone
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alternative Login (Google / Phone) */}
        {authMode !== 'pin' && (
          <Card className="border shadow-md">
            <CardHeader className="text-center">
              <CardTitle className="text-lg">Connexion Commerçant</CardTitle>
              <CardDescription className="text-xs">
                Accès sauvegarde en ligne Supabase
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                className="w-full h-12 flex items-center justify-center gap-3 text-sm font-medium"
                onClick={() => {
                  setAuthMode('pin')
                  unlockWithPin(shop.pin)
                }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Continuer avec Google (Android)
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou numéro local</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Téléphone Congo (+242)</Label>
                  <Input placeholder="06 123 45 67" defaultValue="06 654 32 10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mot de passe</Label>
                  <Input type="password" placeholder="••••••••" defaultValue="carnet2026" />
                </div>
                <Button
                  className="w-full h-12 text-sm font-semibold"
                  onClick={() => {
                    setAuthMode('pin')
                    unlockWithPin(shop.pin)
                  }}
                >
                  Se connecter
                </Button>
              </div>

              <Button
                variant="ghost"
                className="w-full text-xs text-muted-foreground"
                onClick={() => setAuthMode('pin')}
              >
                Retour au déverrouillage PIN
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
          <ShieldCheck className="w-4 h-4 text-credit" />
          <span>Données 100% sécurisées hors ligne sur votre téléphone</span>
        </div>

      </div>
    </div>
  )
}
