// ——— Les infos de facture d'un client : un petit bouton « Ses infos · 6 », puis un modal ———
// Au lieu de tout écrire sous son nom (adresse, RCCM, NIU… ça surcharge), on les range ici, chacune avec son nom.
import React from 'react'
import { Info } from 'lucide-react'
import type { Billing } from '@/data/mockData'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'

const GROUPS: { title: string; fields: [keyof Billing, string][] }[] = [
  {
    title: 'Où le trouver',
    fields: [
      ['adresse', 'Adresse'],
      ['ville', 'Ville'],
      ['email', 'E-mail'],
    ],
  },
  {
    title: 'Son entreprise',
    fields: [
      ['forme', 'Forme juridique'],
      ['rccm', 'RCCM'],
      ['niu', 'NIU'],
    ],
  },
]

// Ce qu'on sait de lui : ses infos champ par champ, ou (anciennes factures) des lignes sans nom
export type ClientInfo = { name: string; phone?: string; billing?: Billing; lines?: string[] }

const filledOf = (c: ClientInfo) => {
  const b = c.billing ?? {}
  const n = GROUPS.reduce((a, g) => a + g.fields.filter(([k]) => (b[k] ?? '').trim()).length, 0)
  return n > 0 ? { n, lines: [] as string[] } : { n: (c.lines ?? []).length, lines: c.lines ?? [] }
}

export function ClientInfos({ client, onEdit, className }: { client: ClientInfo; onEdit?: () => void; className?: string }) {
  const [open, setOpen] = React.useState(false)
  const { n, lines } = filledOf(client)
  if (n === 0) return null
  const b = client.billing ?? {}
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`inline-flex h-7 items-center gap-1.5 self-start rounded-full bg-muted px-3 text-[13px] font-bold ${className ?? ''}`}>
        <Info className="size-3.5" strokeWidth={2.4} /> Ses infos <span className="font-semibold text-muted-foreground">· {n}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader className="text-left">
            <DialogTitle className="text-left text-xl">Ses infos</DialogTitle>
            <DialogDescription className="text-left">
              {client.name}
              {client.phone ? ` · ${client.phone}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pb-2">
            {lines.length > 0 ? (
              <div className="divide-y rounded-2xl border bg-muted/30">
                {lines.map((l, i) => (
                  <div key={i} className="px-3.5 py-2.5 text-[15px]">
                    {l}
                  </div>
                ))}
              </div>
            ) : (
              GROUPS.map(g => {
                const rows = g.fields.filter(([k]) => (b[k] ?? '').trim())
                if (!rows.length) return null
                return (
                  <div key={g.title} className="rounded-2xl border bg-muted/30">
                    <div className="px-3.5 pt-2.5 pb-1 text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">{g.title}</div>
                    {rows.map(([k, label]) => (
                      <div key={k} className="flex items-baseline justify-between gap-3 border-t px-3.5 py-2.5 text-[15px]">
                        <span className="shrink-0 text-muted-foreground">{label}</span>
                        <span className="min-w-0 text-right font-semibold break-words">{b[k]}</span>
                      </div>
                    ))}
                  </div>
                )
              })
            )}
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onEdit()
                }}
                className="h-[52px] rounded-2xl border-2 text-base font-bold"
              >
                Modifier
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
