import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Wordmark } from '@/components/screens/AuthScreen'

// Premier réglage, juste après la création du compte : le nom du commerce et le code PIN
// (le code ouvre l'app sur ce téléphone, sans se reconnecter à chaque fois).

export function SetupScreen({ defaultName, onDone, onLogout }: { defaultName: string; onDone: (name: string, pin: string) => Promise<void>; onLogout: () => void }) {
  const [name, setName] = React.useState(defaultName)
  const [pin, setPin] = React.useState('')
  const [pin2, setPin2] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  const pinOk = /^\d{4}$/.test(pin)
  const same = pin === pin2
  const ok = name.trim().length > 0 && pinOk && same

  React.useLayoutEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ok || busy) return
    setBusy(true)
    setError('')
    try {
      await onDone(name.trim(), pin)
    } catch {
      setError("Impossible d'enregistrer pour l'instant. Vérifiez la connexion internet et réessayez.")
      setBusy(false)
    }
  }

  const digits = (s: string) => s.replace(/\D/g, '').slice(0, 4)

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <form onSubmit={submit} className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-5 py-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <Wordmark size="text-5xl" />
        </div>
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-xl font-semibold">Bienvenue !</h1>
          <p className="text-sm text-muted-foreground">Deux petites choses avant de commencer.</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="setup-name">Nom de votre commerce</Label>
            <Input id="setup-name" className="h-12" placeholder="Ex : Alimentation La Grâce" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="setup-pin">Choisissez un code à 4 chiffres</Label>
            <Input id="setup-pin" className="h-12 tracking-[0.5em]" type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={e => setPin(digits(e.target.value))} />
            <p className="text-xs text-muted-foreground">Il ouvre l'app sur ce téléphone, pour que personne d'autre ne voie vos comptes.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="setup-pin2">Retapez le code</Label>
            <Input id="setup-pin2" className="h-12 tracking-[0.5em]" type="password" inputMode="numeric" autoComplete="new-password" value={pin2} onChange={e => setPin2(digits(e.target.value))} />
            {pin2.length === 4 && !same && <p className="text-xs text-destructive">Les deux codes ne sont pas pareils.</p>}
          </div>
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="h-12 text-base" disabled={!ok || busy}>
          {busy ? 'Un instant…' : 'Commencer'}
        </Button>
        <button type="button" onClick={onLogout} className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Ce n'est pas mon compte
        </button>
      </form>
    </div>
  )
}
