import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  note,
}: {
  title: string
  Icon: React.ComponentType<{ className?: string }>
  tone: 'credit' | 'debt'
  remaining: number
  paid: number
  note?: React.ReactNode
}) {
  // En grand : ce qui reste. Dessous : la barre, puis le total et le déjà versé.
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
        <CardTitle className="text-3xl font-bold tabular-nums" style={{ color }}>
          {formatFCFA(remaining)}
        </CardTitle>
        <CardAction>
          <Badge variant="outline" className="tabular-nums">{paidPct} % versé</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex h-2.5 w-full gap-1 overflow-hidden rounded-full">
          {paid > 0 && <div className="h-full rounded-full" style={{ width: `${paidPct}%`, background: color }} />}
          {remaining > 0 && <div className="h-full flex-1 rounded-full" style={{ background: light }} />}
          {total === 0 && <div className="h-full flex-1 rounded-full bg-muted" />}
        </div>
        <div className="flex items-center justify-between gap-2 text-xs whitespace-nowrap min-[360px]:text-sm">
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: light }} />
            <span className="text-muted-foreground">Total</span>
            <span className="tabular-nums">{formatFCFA(total)}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: color }} />
            <span className="text-muted-foreground">Versé</span>
            <span className="tabular-nums">{formatFCFA(paid)}</span>
          </span>
        </div>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  )
}
