import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Wordmark } from '@/components/screens/AuthScreen'

// Premier réglage, juste après la création du compte : le nom de l'activité.

export function SetupScreen({ defaultName, onDone, onLogout }: { defaultName: string; onDone: (name: string) => Promise<void>; onLogout: () => void }) {
  const [name, setName] = React.useState(defaultName)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  const ok = name.trim().length > 0

  React.useLayoutEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ok || busy) return
    setBusy(true)
    setError('')
    try {
      await onDone(name.trim())
    } catch {
      setError("Impossible d'enregistrer pour l'instant. Vérifiez la connexion internet et réessayez.")
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <form onSubmit={submit} className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-5 py-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <Wordmark size="text-5xl" />
        </div>
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-xl font-semibold">Bienvenue !</h1>
          <p className="text-sm text-muted-foreground">Une seule chose avant de commencer.</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="setup-name">Nom de l'activité</Label>
            <Input id="setup-name" className="h-12" placeholder="Ex : Alimentation La Grâce" value={name} onChange={e => setName(e.target.value)} />
          </div>
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="h-12 text-base" disabled={!ok || busy}>
          {busy ? 'Un instant…' : 'Commencer'}
        </Button>
        <button type="button" onClick={onLogout} className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Utiliser un autre compte
        </button>
      </form>
    </div>
  )
}
