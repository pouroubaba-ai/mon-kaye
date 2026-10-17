import * as React from 'react'
import { ChevronRight } from 'lucide-react'

import type { Movement } from '@/data/mockData'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn, formatFCFA } from '@/lib/utils'

// Historique d'une personne : une seule liste, filtrable par onglets shadcn (Tabs).
// Remplace les anciens blocs « derniers versements reçus / faits » qui répétaient
// les mêmes lignes que l'historique complet.

export const PAYMENT_LABELS: Record<string, string> = {
  especes: 'Espèces',
  momo_mtn: 'MTN MoMo',
  airtel_money: 'Airtel Money',
}

type Filter = { value: string; label: string; match: (m: Movement) => boolean }

export function MovementHistory({
  movements,
  filters,
  onOpen,
  amountClass,
  title = 'Historique',
  toolbar,
}: {
  movements: Movement[]
  filters?: Filter[]
  onOpen: (m: Movement) => void
  amountClass?: (m: Movement) => string
  title?: string
  // Contenu libre affiché à la place des onglets de filtre (ex. pastilles Crédits / Versements)
  toolbar?: React.ReactNode
}) {
  const [filter, setFilter] = React.useState('all')
  const active = filters?.find(f => f.value === filter)
  const shown = active ? movements.filter(active.match) : movements

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Touchez une ligne pour voir le reçu ou l'annuler.</CardDescription>
        <CardAction>
          <Badge variant="outline">{movements.length}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {toolbar}
        {!toolbar && filters && filters.length > 0 && (
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="w-full">
              <TabsTrigger value="all">Tout</TabsTrigger>
              {filters.map(f => (
                <TabsTrigger key={f.value} value={f.value}>
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Aucun mouvement.</p>
        ) : (
          <div className="flex flex-col divide-y rounded-lg border">
            {shown.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => onOpen(m)}
                className={cn(
                  'flex items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50',
                  m.isCancelled && 'opacity-60'
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
                    <span>{m.date}</span>
                    <span>·</span>
                    <span>{PAYMENT_LABELS[m.paymentMethod || 'especes']}</span>
                    {m.isCancelled && <Badge variant="destructive">Annulé</Badge>}
                  </div>
                  <p className={cn('truncate text-sm font-medium', m.isCancelled && 'line-through')}>{m.label}</p>
                  {m.note && <p className="truncate text-xs text-muted-foreground">{m.note}</p>}
                </div>
                <span className={cn('shrink-0 font-semibold tabular-nums', amountClass?.(m))}>{formatFCFA(m.amount)}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
