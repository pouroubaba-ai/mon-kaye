import React from 'react'
import { ArrowDownLeft, ArrowUpRight, Phone, Plus, Scale } from 'lucide-react'

import { useStore } from '@/data/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { MovementHistory } from '@/components/movement-history'
import { formatFCFA } from '@/lib/utils'

// Fiche d'une personne, inspirée des cartes « Payroll » :
// - bandeau en haut, seulement si chacun doit quelque chose à l'autre : qui doit à qui, au net ;
// - deux cartes, « Il me doit » (lui) et « Je lui dois » (moi) : en grand ce qui reste dû,
//   une barre déjà versé / reste, puis le total et le déjà versé ;
// - un seul bouton pour enregistrer une opération (la fenêtre propose les 4 actions).

function BalanceCard({
  title,
  Icon,
  tone,
  remaining,
  paid,
}: {
  title: string
  Icon: React.ComponentType<{ className?: string }>
  tone: 'credit' | 'debt'
  remaining: number
  paid: number
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
          <Badge variant="outline" className="tabular-nums">{paidPct} % versé</Badge>
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
      </CardContent>
      <CardFooter className="justify-between border-t text-sm">
        <span className="text-muted-foreground">Total</span>
        <span className="font-medium tabular-nums">{formatFCFA(total)}</span>
      </CardFooter>
    </Card>
  )
}

export const PartnerDetailScreen: React.FC<{ partnerId: string }> = ({ partnerId }) => {
  const { persons, movements, openNewMovement, openCompensation, openMovementDetail } = useStore()

  const partner = persons.find(p => p.id === partnerId)
  if (!partner) return null

  const owesMe = partner.owesMe || 0
  const iOweHim = partner.iOweHim || 0
  const net = owesMe - iOweHim
  const partnerMovements = movements.filter(m => m.personId === partnerId)
  const sumOf = (t: string) => partnerMovements.filter(m => m.type === t && !m.isCancelled).reduce((a, m) => a + m.amount, 0)
  const paidToMe = sumOf('il_m_a_verse')
  const paidByMe = sumOf('je_lui_ai_verse')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight">{partner.name}</h1>
            <Badge variant="outline">Partenaire</Badge>
          </div>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Phone className="size-3.5" /> {partner.phone}
          </p>
          {partner.role && <p className="truncate text-sm text-muted-foreground">{partner.role}</p>}
        </div>
      </div>

      {/* Bandeau : seulement quand chacun doit quelque chose à l'autre */}
      {owesMe > 0 && iOweHim > 0 && (
        <div
          className="flex items-center gap-3 rounded-xl border p-3"
          style={{
            background: `color-mix(in srgb, ${net >= 0 ? 'var(--color-credit)' : 'var(--color-debt)'} 12%, var(--card))`,
            borderColor: `color-mix(in srgb, ${net >= 0 ? 'var(--color-credit)' : 'var(--color-debt)'} 35%, transparent)`,
          }}
        >
          <Scale className={net >= 0 ? 'size-5 shrink-0 text-credit' : 'size-5 shrink-0 text-debt'} />
          <p className="min-w-0 flex-1 text-sm">
            {net > 0 && <>Au total, <span className="font-semibold text-credit">il vous doit {formatFCFA(net)}</span></>}
            {net < 0 && <>Au total, <span className="font-semibold text-debt">vous lui devez {formatFCFA(-net)}</span></>}
            {net === 0 && <span className="font-semibold">Vous êtes quittes</span>}
          </p>
          <Button variant="secondary" size="sm" onClick={() => openCompensation(partner.id)}>
            Compenser
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BalanceCard title="Il me doit" Icon={ArrowDownLeft} tone="credit" remaining={owesMe} paid={paidToMe} />
        <BalanceCard title="Je lui dois" Icon={ArrowUpRight} tone="debt" remaining={iOweHim} paid={paidByMe} />
      </div>

      <Button size="lg" className="h-12" onClick={() => openNewMovement(partner.id)}>
        <Plus /> Enregistrer une opération
      </Button>

      <MovementHistory
        movements={partnerMovements}
        onOpen={openMovementDetail}
        filters={[
          { value: 'recus', label: 'Reçus', match: m => m.type === 'il_m_a_verse' },
          { value: 'verses', label: 'Versés', match: m => m.type === 'je_lui_ai_verse' },
          { value: 'credits', label: 'Crédits', match: m => m.type === 'il_a_pris_credit' || m.type === 'j_ai_pris_credit' },
        ]}
        amountClass={m =>
          m.type === 'il_m_a_verse' ? 'text-credit' : m.type === 'je_lui_ai_verse' ? 'text-debt' : ''
        }
      />
    </div>
  )
}
