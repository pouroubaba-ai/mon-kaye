// ——— La case « Produit » avec la liste de mes produits, et la réduction ———
// On touche la case : la liste s'ouvre dessous (les deux de toujours, puis ceux que j'ai ajoutés).
// On tape : la liste se réduit à ce qui ressemble. On peut toujours écrire librement.
import React from 'react'
import { ChevronDown, Lock, Plus, Settings2, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { Input } from '@/components/ui/input'
import { cn, plain } from '@/lib/utils'
import { useInvoices } from './store'
import type { Remise } from './types'
import { DEFAULT_PRODUCTS, money } from './view'

const norm = (s: string) => plain(s).replace(/\s+/g, ' ').trim()

// Ma liste : les deux par défaut, puis les miens ; ajouter, enlever
export function useProducts() {
  const { profile, saveProfile } = useInvoices()
  const mine = (profile.products ?? []).filter(p => !DEFAULT_PRODUCTS.some(d => norm(d) === norm(p)))
  const all = [...DEFAULT_PRODUCTS, ...mine]
  const has = (p: string) => all.some(x => norm(x) === norm(p))
  const add = (p: string) => {
    const v = p.trim().replace(/\s+/g, ' ')
    if (!v || has(v)) return
    saveProfile({ ...profile, products: [...mine, v] })
  }
  const remove = (p: string) => saveProfile({ ...profile, products: mine.filter(x => x !== p) })
  return { all, mine, has, add, remove }
}

export function ProductField({ value, onChange, onKeyDown, placeholder }: { value: string; onChange: (v: string) => void; onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void; placeholder: string }) {
  const { all, has, add } = useProducts()
  const [open, setOpen] = React.useState(false)
  const [manage, setManage] = React.useState(false)
  const ref = React.useRef<HTMLInputElement>(null)
  const q = norm(value)
  // Déjà un produit de la liste dans la case : toute la liste (pour en changer) ; sinon ce qui ressemble à ce qu'on tape
  const exact = all.some(p => norm(p) === q)
  const shown = q && !exact ? all.filter(p => norm(p).includes(q)) : all
  const canAdd = q !== '' && !has(value)
  const pick = (p: string) => {
    onChange(p)
    setOpen(false)
    ref.current?.blur()
  }
  // Toucher un choix ne doit pas fermer la liste avant d'avoir choisi
  const keep = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault()

  return (
    <div className="relative min-w-0 flex-1">
      <Input
        ref={ref}
        data-line-field
        enterKeyHint="next"
        onKeyDown={e => {
          if (e.key === 'Escape' && open) {
            e.stopPropagation()
            setOpen(false)
            return
          }
          if (e.key === 'Enter') setOpen(false)
          onKeyDown?.(e)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder={placeholder}
        aria-label="Produit"
        value={value}
        onChange={e => (onChange(e.target.value), setOpen(true))}
        className="h-9 min-w-0 pr-8 pl-2 text-sm"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Mes produits"
        onPointerDown={keep}
        onMouseDown={keep}
        onClick={() => (open ? (setOpen(false), ref.current?.blur()) : ref.current?.focus())}
        className="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground"
      >
        <ChevronDown className="size-4" />
      </button>

      {open && (
        <div onPointerDown={keep} onMouseDown={keep} className="absolute inset-x-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-xl border bg-popover shadow-xl animate-in fade-in duration-150">
          <div className="px-3 pt-2.5 pb-1 text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">Mes produits</div>
          <div className="max-h-60 overflow-y-auto">
            {shown.map(p => (
              <button key={p} type="button" onClick={() => pick(p)} className="flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-[15px] first:border-t-0 hover:bg-muted/50">
                <span className={cn('min-w-0 flex-1', norm(p) === q && 'font-bold text-kgold')}>{p}</span>
                {DEFAULT_PRODUCTS.includes(p) && <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">par défaut</span>}
              </button>
            ))}
            {canAdd && (
              <button type="button" onClick={() => (add(value), pick(value.trim()))} className="flex w-full items-center gap-1.5 border-t px-3 py-2.5 text-left text-[15px] font-bold text-kgold">
                <Plus className="size-4 shrink-0" /> <span className="min-w-0 truncate">Ajouter « {value.trim()} » à la liste</span>
              </button>
            )}
          </div>
          <button type="button" onClick={() => (setOpen(false), setManage(true))} className="flex w-full items-center justify-center gap-1.5 border-t bg-muted/30 py-2.5 text-[13px] font-semibold text-muted-foreground">
            <Settings2 className="size-3.5" /> Gérer la liste
          </button>
        </div>
      )}
      <ManageProducts open={manage} onOpenChange={setManage} />
    </div>
  )
}

// « Gérer la liste » : ajouter ou enlever ; les deux par défaut ont un cadenas
function ManageProducts({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { all, has, add, remove } = useProducts()
  const [v, setV] = React.useState('')
  React.useEffect(() => {
    if (open) setV('')
  }, [open])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="text-left">
          <DialogTitle className="text-left text-xl">Mes produits</DialogTitle>
          <DialogDescription className="text-left">Ce qui s'affiche quand on touche « Produit ».</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pb-2">
          <div className="divide-y rounded-2xl border bg-muted/30">
            {all.map(p => (
              <div key={p} className="flex min-h-12 items-center gap-2 px-3.5 py-2 text-[15px]">
                <span className="min-w-0 flex-1">{p}</span>
                {DEFAULT_PRODUCTS.includes(p) ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
                    <Lock className="size-3.5" /> Par défaut
                  </span>
                ) : (
                  <button type="button" aria-label={`Enlever ${p}`} onClick={() => remove(p)} className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-kred/40 text-kred">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={e => {
              e.preventDefault()
              if (v.trim() && !has(v)) (add(v), setV(''))
            }}
          >
            <input value={v} onChange={e => setV(e.target.value)} placeholder="Nouveau produit" aria-label="Nouveau produit" className="h-12 min-w-0 flex-1 rounded-xl border bg-background px-3.5 text-[15px] outline-none focus:border-kgold" />
            <button type="submit" disabled={!v.trim() || has(v)} className="h-12 shrink-0 rounded-xl bg-kgold px-4 font-bold text-white disabled:opacity-40 dark:text-black">
              Ajouter
            </button>
          </form>
          {v.trim() && has(v) && <span className="-mt-1 text-xs text-muted-foreground">Il est déjà dans la liste.</span>}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ——— La réduction : en FCFA ou en %, des raccourcis, et le nouveau net tout de suite ———
const digitsOnly = (s: string) => s.replace(/\D/g, '').slice(0, 10)
export function RemiseDialog({ open, onOpenChange, sub, value, onApply }: { open: boolean; onOpenChange: (o: boolean) => void; sub: number; value?: Remise; onApply: (r: Remise | undefined) => void }) {
  const [kind, setKind] = React.useState<Remise['kind']>('pct')
  const [v, setV] = React.useState('')
  React.useEffect(() => {
    if (!open) return
    setKind(value?.kind ?? 'pct')
    setV(value ? String(value.value) : '')
  }, [open, value])
  const n = parseInt(v, 10) || 0
  const bad = kind === 'pct' ? n > 100 : n > sub
  const amount = kind === 'pct' ? Math.round((sub * Math.min(100, n)) / 100) : Math.min(sub, n)
  const ok = n > 0 && !bad
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="text-left">
          <DialogTitle className="text-left text-xl">Réduction</DialogTitle>
          <DialogDescription className="sr-only">Réduction sur le total</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3 pb-2"
          onSubmit={e => {
            e.preventDefault()
            if (ok) (onApply({ kind, value: n }), onOpenChange(false))
          }}
        >
          <div className="flex gap-2">
            <input
              inputMode="numeric"
              value={kind === 'fcfa' && v ? money(n) : v}
              onChange={e => setV(digitsOnly(e.target.value).slice(0, kind === 'pct' ? 3 : 10))}
              placeholder="0"
              aria-label="Réduction"
              className={cn('h-[52px] min-w-0 flex-1 rounded-xl border-[1.5px] bg-background px-3.5 text-2xl font-extrabold tabular-nums outline-none placeholder:text-muted-foreground/40', bad ? 'border-kred' : 'border-kgold')}
            />
            <div role="radiogroup" aria-label="En FCFA ou en %" className="flex shrink-0 rounded-xl bg-muted p-1">
              {(
                [
                  ['fcfa', 'FCFA'],
                  ['pct', '%'],
                ] as const
              ).map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => (setKind(k), setV(''))} className={cn('w-14 rounded-[9px] text-sm font-bold', kind === k ? 'bg-foreground text-background' : 'text-muted-foreground')}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {kind === 'pct' && (
            <div className="flex gap-2">
              {[5, 10, 15].map(p => (
                <button key={p} type="button" onClick={() => setV(String(p))} className={cn('h-9 rounded-full border px-3.5 text-sm font-bold', n === p ? 'border-kgold text-kgold' : 'text-muted-foreground')}>
                  {p} %
                </button>
              ))}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {bad ? (
              <span className="text-kred">{kind === 'pct' ? 'Pas plus de 100 %.' : `Pas plus que le total (${money(sub)}).`}</span>
            ) : (
              <>
                {money(sub)} <span className="font-bold text-kred">− {money(amount)}</span> → net <b className="text-foreground">{money(sub - amount)} FCFA</b>
              </>
            )}
          </p>
          <button type="submit" disabled={!ok} className="h-[54px] rounded-2xl bg-foreground text-[17px] font-bold text-background disabled:opacity-40">
            Appliquer
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
