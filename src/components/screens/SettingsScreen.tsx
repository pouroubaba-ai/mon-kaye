import React, { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'

import { useStore } from '@/data/store'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { SubHeader } from '@/components/layout/AppLayout'
import { cn } from '@/lib/utils'

// ——— Réglages « Kayé simple » ———
// Ma boutique (le stylo pour changer le nom), Clients en retard (7, 15, 30 jours ou mon nombre),
// Employés allumé ou non, thème sombre, et Se déconnecter.

const PRESETS = [7, 15, 30]

function Section({ title, gold, children, className }: { title?: string; gold?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-3 rounded-[18px] border bg-card p-4', gold && 'border-kgold/40', className)}>
      {title && <span className="text-xs tracking-[0.08em] text-muted-foreground uppercase">{title}</span>}
      {children}
    </section>
  )
}

export const SettingsScreen: React.FC = () => {
  const { shop, setShopName, theme, toggleTheme, modules, setModule, logout, lateDays, setLateDays } = useStore()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(shop.name)
  const [askLogout, setAskLogout] = useState(false)
  const [custom, setCustom] = useState(!PRESETS.includes(lateDays))
  const [daysStr, setDaysStr] = useState(PRESETS.includes(lateDays) ? '' : String(lateDays))

  const saveName = () => {
    if (!name.trim()) return
    setShopName(name.trim())
    setEditing(false)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SubHeader title="Réglages" />
      <div className="flex flex-col gap-3.5 px-4 pt-2 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {/* Ma boutique : le nom, et le stylo pour le changer */}
        <Section title="Ma boutique" className="gap-1.5">
          {editing ? (
            <form
              className="flex items-center gap-2"
              onSubmit={e => {
                e.preventDefault()
                saveName()
              }}
            >
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                aria-label="Nom de la boutique"
                className="h-11 min-w-0 flex-1 rounded-xl border-2 border-kgold bg-background px-3 text-base font-semibold outline-none"
              />
              <button type="submit" aria-label="Enregistrer le nom" disabled={!name.trim()} className="flex size-11 items-center justify-center rounded-xl bg-kgreen-solid text-white disabled:opacity-40">
                <Check className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Annuler"
                onClick={() => {
                  setName(shop.name)
                  setEditing(false)
                }}
                className="flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
              >
                <X className="size-5" />
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[17px] font-semibold">{shop.name}</span>
              <button type="button" aria-label="Modifier le nom de la boutique" onClick={() => setEditing(true)} className="-my-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
                <Pencil className="size-5" />
              </button>
            </div>
          )}
        </Section>

        {/* Clients en retard */}
        <Section title="Clients en retard" gold>
          <span className="text-[15px] leading-snug">Un client est en retard s'il ne m'a rien versé depuis :</span>
          <div role="radiogroup" aria-label="Délai avant retard" className="grid grid-cols-4 gap-2">
            {PRESETS.map(n => {
              const on = !custom && lateDays === n
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setCustom(false)
                    setLateDays(n)
                  }}
                  className={cn('h-12 rounded-xl text-[15px]', on ? 'border-2 border-kgold bg-kgold font-bold text-white dark:text-black' : 'border font-semibold text-muted-foreground')}
                >
                  {n} j
                </button>
              )
            })}
            <button
              type="button"
              role="radio"
              aria-checked={custom}
              onClick={() => {
                setCustom(true)
                ;(document.querySelector('[aria-label="Nombre de jours"]') as HTMLInputElement | null)?.focus()
              }}
              className={cn('h-12 rounded-xl text-[15px]', custom ? 'border-2 border-kgold bg-kgold font-bold text-white dark:text-black' : 'border font-semibold text-muted-foreground')}
            >
              Autre
            </button>
          </div>
          {/* Toujours affiché (rien n'apparaît ni ne bouge) : taper un nombre choisit « Autre » */}
          <label className={cn('flex items-center gap-2.5 text-[15px]', custom ? 'text-foreground' : 'text-muted-foreground')}>
            Ou mon nombre de jours :
            <input
              inputMode="numeric"
              value={daysStr}
              placeholder="21"
              aria-label="Nombre de jours"
              onFocus={() => setCustom(true)}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 3)
                setCustom(true)
                setDaysStr(v)
                const n = parseInt(v, 10)
                if (n > 0) setLateDays(n)
              }}
              className={cn('h-11 w-[72px] rounded-xl border-2 bg-background text-center text-lg font-bold text-foreground outline-none', custom ? 'border-kgold' : 'border-border')}
            />
            jours
          </label>
          <span className="text-[13px] leading-normal text-muted-foreground">
            Ses jours s'affichent en <span className="font-semibold text-kgold">doré</span> sur l'accueil, et il apparaît dans « Ceux qui tardent à payer ».
          </span>
        </Section>

        {/* Interrupteurs */}
        <Section className="gap-0 py-1.5">
          {!modules.personnes && (
            <label className="flex items-center justify-between gap-3 border-b py-3">
              <span className="flex flex-col">
                <span className="text-base font-semibold">Clients et fournisseurs</span>
                <span className="text-[13px] text-muted-foreground">Crédits et dettes</span>
              </span>
              <Switch checked={modules.personnes} onCheckedChange={on => setModule('personnes', on)} aria-label="Module Clients et fournisseurs" className="data-[state=checked]:bg-kgreen-solid" />
            </label>
          )}
          <label className="flex items-center justify-between gap-3 border-b py-3">
            <span className="flex flex-col">
              <span className="text-base font-semibold">Employés</span>
              <span className="text-[13px] text-muted-foreground">Salaires et avances</span>
            </span>
            <Switch checked={modules.employes} disabled={modules.employes && !modules.personnes} onCheckedChange={on => setModule('employes', on)} aria-label="Module Employés" className="data-[state=checked]:bg-kgreen-solid" />
          </label>
          <label className="flex items-center justify-between gap-3 py-3">
            <span className="text-base font-semibold">Thème sombre</span>
            <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} aria-label="Thème sombre" className="data-[state=checked]:bg-kgreen-solid" />
          </label>
        </Section>

        <button type="button" onClick={() => setAskLogout(true)} className="h-[52px] rounded-[14px] border border-kred/40 text-base font-semibold text-kred hover:bg-kred/5">
          Se déconnecter
        </button>
      </div>

      <Dialog open={askLogout} onOpenChange={setAskLogout}>
        <DialogContent>
          <div className="flex flex-col gap-4">
            <DialogHeader className="gap-1 p-0">
              <DialogTitle className="text-left">Se déconnecter ?</DialogTitle>
              <DialogDescription className="text-left">Vos comptes restent gardés. Vous les retrouverez en vous reconnectant.</DialogDescription>
            </DialogHeader>
            <Button variant="destructive" size="lg" className="h-12" onClick={logout}>
              Se déconnecter
            </Button>
            <Button variant="outline" size="lg" className="h-12" onClick={() => setAskLogout(false)}>
              Annuler
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
