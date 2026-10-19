import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
// Icônes officielles de Google et d'Apple (paquet react-icons), comme le demandent leurs règles pour ces boutons
import { FcGoogle } from 'react-icons/fc'
import { FaApple } from 'react-icons/fa'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Connexion et inscription (aperçu de l'écran ; le branchement à Firebase vient ensuite).
// Toujours en sombre, aux couleurs du logo. Trois façons d'entrer : Google, Apple, ou e-mail + mot de passe.

export type AuthMode = 'connexion' | 'inscription'

export function Wordmark({ size = 'text-6xl' }: { size?: string }) {
  return (
    <div className={`${size} leading-none font-extrabold tracking-tight`} aria-label="kayé">
      <span className="bg-[linear-gradient(135deg,#F2F4F7_0%,#B9BEC6_55%,#DDE1E6_100%)] bg-clip-text text-transparent">kay</span>
      <span className="bg-[linear-gradient(160deg,#FFF1BE_0%,#F2C14E_35%,#B9821F_62%,#F7D774_82%,#FFE9A0_100%)] bg-clip-text text-transparent">é</span>
    </div>
  )
}

export function AuthScreen({ mode, onSwitch }: { mode: AuthMode; onSwitch: (m: AuthMode) => void }) {
  const signup = mode === 'inscription'
  // Toujours en sombre, aux couleurs du logo (le thème choisi s'applique une fois dans l'app)
  React.useLayoutEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])
  const [shop, setShop] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [pwd, setPwd] = React.useState('')
  const [showPwd, setShowPwd] = React.useState(false)

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const pwdOk = pwd.length >= 6
  const ok = emailOk && pwdOk && (!signup || shop.trim().length > 0)

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-5 py-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <Wordmark />
          <p className="text-sm text-muted-foreground">Mon kayé de compte</p>
        </div>

        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-xl font-semibold">{signup ? 'Créer mon compte' : 'Se connecter'}</h1>
          <p className="text-sm text-muted-foreground">
            {signup ? 'Vos comptes gardés en sécurité, même si vous changez de téléphone.' : 'Retrouvez vos comptes.'}
          </p>
        </div>

        {/* Le plus simple d'abord : un seul toucher */}
        <div className="flex flex-col gap-3">
          <Button type="button" size="lg" className="h-12 bg-white text-base text-neutral-900 hover:bg-neutral-100">
            <FcGoogle className="size-5" aria-hidden="true" /> Continuer avec Google
          </Button>
          <Button type="button" size="lg" variant="outline" className="h-12 text-base">
            <FaApple className="size-5" aria-hidden="true" /> Continuer avec Apple
          </Button>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          ou avec votre e-mail
          <span className="h-px flex-1 bg-border" />
        </div>

        <form className="flex flex-col gap-4" onSubmit={e => e.preventDefault()}>
          {signup && (
            <div className="grid gap-2">
              <Label htmlFor="auth-shop">Nom de votre commerce</Label>
              <Input id="auth-shop" className="h-12" placeholder="Ex : Alimentation La Grâce" value={shop} onChange={e => setShop(e.target.value)} />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="auth-email">E-mail</Label>
            <Input id="auth-email" className="h-12" type="email" inputMode="email" autoComplete="email" placeholder="vous@exemple.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="auth-pwd">Mot de passe</Label>
              {!signup && (
                <button type="button" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                  Mot de passe oublié ?
                </button>
              )}
            </div>
            <div className="relative">
              <Input
                id="auth-pwd"
                className="h-12 pr-12"
                type={showPwd ? 'text' : 'password'}
                autoComplete={signup ? 'new-password' : 'current-password'}
                value={pwd}
                onChange={e => setPwd(e.target.value)}
              />
              <button
                type="button"
                aria-label={showPwd ? 'Cacher le mot de passe' : 'Voir le mot de passe'}
                onClick={() => setShowPwd(v => !v)}
                className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              >
                {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {signup && <p className="text-xs text-muted-foreground">Au moins 6 caractères.</p>}
          </div>
          <Button type="submit" size="lg" className="h-12 text-base" disabled={!ok}>
            {signup ? 'Créer mon compte' : 'Se connecter'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {signup ? 'Déjà un compte ? ' : 'Pas encore de compte ? '}
          <button type="button" onClick={() => onSwitch(signup ? 'connexion' : 'inscription')} className="font-medium text-foreground underline-offset-4 hover:underline">
            {signup ? 'Se connecter' : 'Créer un compte'}
          </button>
        </p>
      </div>
    </div>
  )
}
