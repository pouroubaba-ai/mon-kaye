import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { formatFCFA } from '@/lib/utils'

// Carte de solde inspirée des cartes « Payroll » : en grand ce qui reste dû,
// une barre déjà versé / reste, la légende, puis le total.
// Utilisée sur la fiche d'une personne et sur la fiche d'un employé.

export function BalanceCard({
  title,
  Icon,
  tone,
  remaining,
  paid,
  badge,
  note,
  totalLabel = 'Total',
}: {
  title: string
  Icon: React.ComponentType<{ className?: string }>
  tone: 'credit' | 'debt'
  remaining: number
  paid: number
  badge?: React.ReactNode
  note?: React.ReactNode
  totalLabel?: string
}) {
  const total = remaining + paid
  const paidPct = total > 0 ? Math.round((paid / total) * 100) : 0
  const color = tone === 'credit' ? 'var(--color-credit)' : 'var(--color-debt)'
  const light = `color-mix(in srgb, ${color} 30%, transparent)`
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg text-white" style={{ background: color }}>
            <Icon className="size-4" />
          </span>
          {title}
        </CardDescription>
        <CardTitle className="text-3xl font-semibold tabular-nums" style={{ color }}>
          {formatFCFA(remaining)}
        </CardTitle>
        <CardAction>
          {badge ?? <Badge variant="outline" className="tabular-nums">{paidPct} % versé</Badge>}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex h-2.5 w-full gap-1 overflow-hidden rounded-full">
          {paid > 0 && <div className="h-full rounded-full" style={{ width: `${paidPct}%`, background: color }} />}
          {remaining > 0 && <div className="h-full flex-1 rounded-full" style={{ background: light }} />}
          {total === 0 && <div className="h-full flex-1 rounded-full bg-muted" />}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: color }} /> Déjà versé ({formatFCFA(paid)})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: light }} /> Reste ({formatFCFA(remaining)})
          </span>
        </div>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </CardContent>
      <CardFooter className="justify-between border-t text-sm">
        <span className="text-muted-foreground">{totalLabel}</span>
        <span className="font-medium tabular-nums">{formatFCFA(total)}</span>
      </CardFooter>
    </Card>
  )
}

