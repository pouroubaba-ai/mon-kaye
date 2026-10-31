// ——— Mes infos de facture (Réglages) ———
// Une seule fois : logo, nom, ce que je fais, adresse, numéros ; puis la numérotation et les mentions du bas.
import React from 'react'
import { ImagePlus } from 'lucide-react'
import { useStore } from '@/data/store'
import { cn } from '@/lib/utils'
import { useInvoices } from './store'
import type { InvoiceProfile } from './types'
import { pad3 } from './view'

const input = 'h-12 w-full rounded-xl border bg-background px-3.5 text-[15px] outline-none focus:border-kgold'
const area = 'w-full resize-none rounded-xl border bg-background px-3.5 py-3 text-[15px] leading-snug outline-none focus:border-kgold'
const Field = ({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) => (
  <label className={cn('flex min-w-0 flex-col gap-1.5', className)}>
    <span className="text-[13px] text-muted-foreground">{label}</span>
    {children}
  </label>
)

// Le logo réduit (PNG : garde la transparence), au plus 360 points de côté
function readLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const k = Math.min(1, 360 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = e => (URL.revokeObjectURL(url), reject(e))
    img.src = url
  })
}

export function InvoiceProfileScreen({ onBack }: { onBack: () => void }) {
  const { profile, saveProfile } = useInvoices()
  const { shop } = useStore()
  const [p, setP] = React.useState<InvoiceProfile>(() => ({ ...profile, name: profile.name || shop.name }))
  const [next, setNext] = React.useState(String(profile.next))
  const [qNext, setQNext] = React.useState(String(profile.quoteNext))
  const fileRef = React.useRef<HTMLInputElement>(null)
  const set = <K extends keyof InvoiceProfile>(k: K, v: InvoiceProfile[K]) => setP(x => ({ ...x, [k]: v }))
  const num = (s: string) => Math.max(1, parseInt(s, 10) || 1)

  const save = () => {
    saveProfile({ ...p, name: p.name.trim() || shop.name, next: num(next), quoteNext: num(qNext) })
    onBack()
  }

  return (
    <div className="flex flex-col gap-3.5 px-4 pt-2 pb-[calc(7rem+env(safe-area-inset-bottom))]">
      {/* Le logo */}
      <div className="flex items-center gap-3.5">
        <button type="button" onClick={() => fileRef.current?.click()} aria-label="Choisir mon logo" className="flex size-[86px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-white">
          {p.logo ? <img src={p.logo} alt="Mon logo" className="size-[76px] object-contain" /> : <ImagePlus className="size-8 text-neutral-400" />}
        </button>
        <div className="flex flex-col items-start gap-1">
          <span className="text-[15px] font-bold">Mon logo</span>
          <span className="text-xs text-muted-foreground">Une photo depuis le téléphone</span>
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="h-8 rounded-full bg-kgold/15 px-3 text-[13px] font-bold text-kgold">
              {p.logo ? 'Changer' : 'Choisir'}
            </button>
            {p.logo && (
              <button type="button" onClick={() => set('logo', undefined)} className="h-8 rounded-full px-3 text-[13px] font-semibold text-muted-foreground">
                Enlever
              </button>
            )}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async e => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) set('logo', await readLogo(f).catch(() => p.logo))
          }}
        />
      </div>

      <Field label="Nom de l'activité">
        <input value={p.name} onChange={e => set('name', e.target.value)} className={cn(input, 'font-semibold')} />
      </Field>
      <Field label="Ce que je fais (sous le nom)">
        <input value={p.activities} onChange={e => set('activities', e.target.value)} placeholder="Ex : Bâtiment · Travaux publics" className={input} />
      </Field>
      <Field label="Adresse (une info par ligne)">
        <textarea value={p.address} onChange={e => set('address', e.target.value)} rows={2} placeholder={'Avenue, quartier\nVille, pays'} className={area} />
      </Field>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Téléphones">
          <input type="tel" value={p.phone} onChange={e => set('phone', e.target.value)} placeholder="06 …" className={input} />
        </Field>
        <Field label="E-mail">
          <input type="email" value={p.email ?? ''} onChange={e => set('email', e.target.value || undefined)} placeholder="facultatif" className={input} />
        </Field>
      </div>
      <Field label="NIU, RCCM… (facultatif)">
        <input value={p.ids ?? ''} onChange={e => set('ids', e.target.value || undefined)} placeholder="Ex : RCCM CG-BZV-…" className={input} />
      </Field>
      <Field label="Pour me payer (facultatif)">
        <input value={p.payment ?? ''} onChange={e => set('payment', e.target.value || undefined)} placeholder="Ex : Mobile Money 06 … · Banque …" className={input} />
      </Field>

      {/* Numérotation */}
      <span className="mt-2 text-xs tracking-[0.08em] text-muted-foreground uppercase">Numéros</span>
      <div className="grid grid-cols-[1fr_96px] gap-2.5">
        <Field label="Début des numéros de facture">
          <input value={p.prefix} onChange={e => set('prefix', e.target.value)} className={input} />
        </Field>
        <Field label="Prochaine">
          <input inputMode="numeric" value={next} onChange={e => setNext(e.target.value.replace(/\D/g, '').slice(0, 5))} className={cn(input, 'font-bold text-kgold tabular-nums')} />
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_96px] gap-2.5">
        <Field label="Début des numéros de devis">
          <input value={p.quotePrefix} onChange={e => set('quotePrefix', e.target.value)} className={input} />
        </Field>
        <Field label="Prochain">
          <input inputMode="numeric" value={qNext} onChange={e => setQNext(e.target.value.replace(/\D/g, '').slice(0, 5))} className={cn(input, 'font-bold text-kgold tabular-nums')} />
        </Field>
      </div>
      <p className="-mt-1 text-[13px] text-muted-foreground">
        Prochaine facture : <b className="text-foreground">{p.prefix}{pad3(num(next))}</b> · prochain devis : <b className="text-foreground">{p.quotePrefix}{pad3(num(qNext))}</b>
      </p>

      <Field label="Mentions en bas de la facture">
        <textarea value={p.mentions} onChange={e => set('mentions', e.target.value)} rows={3} className={cn(area, 'text-[14px]')} />
        <span className="text-xs text-muted-foreground">{'{numero}'} est remplacé par le numéro de la facture.</span>
      </Field>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-xl border-t bg-background px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <button type="button" onClick={save} className="h-[56px] w-full rounded-2xl bg-kgreen-solid text-lg font-bold text-white">
          Enregistrer
        </button>
      </div>
    </div>
  )
}
