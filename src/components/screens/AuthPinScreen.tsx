import React, { useState } from 'react'
import { useStore } from '@/data/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, ShieldCheck, KeyRound, Smartphone, Store } from 'lucide-react'

export const AuthPinScreen: React.FC = () => {
  const { shop, unlockWithPin, logout } = useStore()
  const [pinInput, setPinInput] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const authMode = 'pin' as const

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

  // Clavier d'ordinateur : les chiffres et la touche d'effacement marchent aussi
  React.useEffect(() => {
    if (authMode !== 'pin') return
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) handleDigit(e.key)
      else if (e.key === 'Backspace') handleDelete()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

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
                Saisissez votre code PIN à 4 chiffres
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
                  aria-label="Effacer le dernier chiffre"
                  className="h-14 rounded-xl border bg-muted/40 text-sm font-semibold flex items-center justify-center hover:bg-muted active:scale-95 transition-all text-muted-foreground"
                >
                  ←
                </button>
              </div>

              <div className="pt-2 text-center">
                {/* Autre compte : on se déconnecte et on revient à l'écran de connexion */}
                <button
                  onClick={() => logout()}
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  Changer de compte
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
          <ShieldCheck className="w-4 h-4 text-credit" />
          <span>Vos données restent sur votre téléphone, même sans internet</span>
        </div>

      </div>
    </div>
  )
}
