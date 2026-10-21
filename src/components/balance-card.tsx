import * as React from 'react'
import { ChevronRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatFCFA } from '@/lib/utils'

// Carte de solde inspirée des cartes « Payroll » : en grand ce qui reste dû,
// une barre déjà versé / reste, la légende, puis le total.
// Utilisée sur la fiche d'une personne et sur la fiche d'un employé.

// « il y a 12 j », « aujourd'hui », « hier » ; rien si on ne sait pas.
const ago = (d?: number | null) =>
  d === undefined || d === null ? null : d === 0 ? "aujourd'hui" : d === 1 ? 'hier' : `il y a ${d} j`

export function BalanceCard({
  title,
  Icon,
  tone,
  remaining,
  paid,
  note,
  paidLabel = 'versé',
  totalDays,
  paidDays,
  onClick,
}: {
  title: string
  Icon: React.ComponentType<{ className?: string }>
  tone: 'credit' | 'debt'
  remaining: number
  paid: number
  note?: React.ReactNode
  // « versé » (salaire, comptes) ou « rendu » (avance)
  paidLabel?: 'versé' | 'rendu'
  // Nombre de jours depuis la dernière hausse du total (dernier crédit) et depuis le dernier versement
  totalDays?: number | null
  paidDays?: number | null
  // Carte touchable (fiche d'une personne : ouvre l'onglet du compte)
  onClick?: () => void
}) {
  // En grand : ce qui reste. Dessous : la barre, puis le total et le déjà versé.
  const total = remaining + paid
  const paidPct = total > 0 ? Math.round((paid / total) * 100) : 0
  const color = tone === 'credit' ? 'var(--color-credit)' : 'var(--color-debt)'
  const light = `color-mix(in srgb, ${color} 30%, transparent)`
  return (
    <Card
      className={onClick ? 'cursor-pointer gap-4 transition-transform active:scale-[0.99]' : 'gap-4'}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? e => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
    >
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg text-white" style={{ background: color }}>
            <Icon className="size-4" />
          </span>
          {title}
        </CardDescription>
        <CardTitle className="col-span-2 text-3xl font-bold whitespace-nowrap tabular-nums" style={{ color }}>
          {formatFCFA(remaining)}
        </CardTitle>
        <CardAction className="row-span-1 flex items-center gap-1">
          <Badge variant="outline" className="tabular-nums">{total === 0 ? 'À jour' : `${paidPct} % ${paidLabel}`}</Badge>
          {onClick && <ChevronRight className="-mr-1 size-4 text-muted-foreground" />}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex h-2.5 w-full gap-1 overflow-hidden rounded-full">
          {paid > 0 && <div className="h-full rounded-full" style={{ width: `${paidPct}%`, background: color }} />}
          {remaining > 0 && <div className="h-full flex-1 rounded-full" style={{ background: light }} />}
          {total === 0 && <div className="h-full flex-1 rounded-full bg-muted" />}
        </div>
        <div className="flex items-start justify-between gap-2 text-xs whitespace-nowrap min-[360px]:text-sm">
          <span className="flex flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: light }} />
              <span className="text-muted-foreground">Total</span>
              <span className="tabular-nums">{formatFCFA(total)}</span>
            </span>
            {total > 0 && ago(totalDays) && <span className="pl-4 text-xs text-muted-foreground/70">{ago(totalDays)}</span>}
          </span>
          <span className="flex flex-col items-end gap-0.5">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: color }} />
              <span className="text-muted-foreground">{paidLabel === 'rendu' ? 'Rendu' : 'Versé'}</span>
              <span className="tabular-nums">{formatFCFA(paid)}</span>
            </span>
            {paid > 0 && ago(paidDays) && <span className="text-xs text-muted-foreground/70">{ago(paidDays)}</span>}
          </span>
        </div>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  )
}
