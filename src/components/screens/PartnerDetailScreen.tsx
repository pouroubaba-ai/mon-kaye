import React from 'react'
import { ArrowDownLeft, ArrowUpRight, Plus, Scale } from 'lucide-react'

import { useStore } from '@/data/store'
import { Button } from '@/components/ui/button'
import { MovementHistory } from '@/components/movement-history'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PersonHeader } from '@/components/person-header'
import { BalanceCard } from '@/components/balance-card'
import { formatFCFA } from '@/lib/utils'
import { daysSince } from '@/data/payHistory'

// Fiche d'une personne, inspirée des cartes « Payroll » :
// - bandeau en haut, seulement si chacun doit quelque chose à l'autre : qui doit à qui, au net ;
// - deux cartes, « Son compte » (ce qu'il a pris chez moi) et « Mon compte » (ce que j'ai pris chez lui) : en grand ce qui reste dû,
//   une barre déjà versé / reste, puis le total et le déjà versé ;
// - un seul bouton pour enregistrer une opération (la fenêtre propose les 4 actions).

export const PartnerDetailScreen: React.FC<{ partnerId: string }> = ({ partnerId }) => {
  const { persons, movements, openNewMovement, openCompensation, openMovementDetail } = useStore()

  const [view, setView] = React.useState<'ensemble' | 'historique'>('ensemble')
  const [side, setSide] = React.useState<'lui' | 'moi'>('lui')
  const [kind, setKind] = React.useState<'credit' | 'versement'>('credit')
  const partner = persons.find(p => p.id === partnerId)
  if (!partner) return null

  const owesMe = partner.owesMe || 0
  const iOweHim = partner.iOweHim || 0
  const net = owesMe - iOweHim
  const partnerMovements = movements.filter(m => m.personId === partnerId)
  const sumOf = (t: string) => partnerMovements.filter(m => m.type === t && !m.isCancelled).reduce((a, m) => a + m.amount, 0)
  const paidToMe = sumOf('il_m_a_verse')
  const paidByMe = sumOf('je_lui_ai_verse')
  // Date la plus récente d'un type d'opération (jj/mm/aaaa), sinon la date gardée sur la fiche.
  const toTime = (d: string) => {
    const [dd, mm, yy] = d.split('/').map(Number)
    return new Date(yy, mm - 1, dd).getTime()
  }
  const lastDateOf = (t: string, fallback?: string) => {
    const dates = partnerMovements.filter(m => m.type === t && !m.isCancelled).map(m => m.date)
    if (!dates.length) return fallback
    return dates.sort((a, b) => toTime(b) - toTime(a))[0]
  }
  const days = (d?: string) => (d ? daysSince(d) : null)

  return (
    <div className="flex flex-col gap-4">
      <PersonHeader person={partner} />

      {/* Deux vues : la situation (Vue d'ensemble) et le détail des opérations (Historique) */}
      <Tabs value={view} onValueChange={v => setView(v as 'ensemble' | 'historique')}>
        <TabsList className="w-full">
          <TabsTrigger value="ensemble">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === 'ensemble' && (
        <>
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
          <BalanceCard
            title="Son compte"
            Icon={ArrowDownLeft}
            tone="credit"
            remaining={owesMe}
            paid={paidToMe}
            totalDays={days(lastDateOf('il_a_pris_credit', partner.lastCreditToHimDate))}
            paidDays={days(lastDateOf('il_m_a_verse', partner.lastPaymentDate))}
          />
          <BalanceCard
            title="Mon compte"
            Icon={ArrowUpRight}
            tone="debt"
            remaining={iOweHim}
            paid={paidByMe}
            totalDays={days(lastDateOf('j_ai_pris_credit', partner.lastCreditFromHimDate))}
            paidDays={days(lastDateOf('je_lui_ai_verse', partner.lastPaidByMeDate))}
          />
        </div>
        </>
      )}

      {view === 'historique' && (
        <>
          {/* Le côté, comme les cartes : onglets soulignés, à la couleur du côté */}
          <Tabs value={side} onValueChange={v => { setSide(v as 'lui' | 'moi'); setKind('credit') }}>
            <TabsList variant="line" className="w-full border-b">
              <TabsTrigger value="lui" className={side === 'lui' ? 'text-credit after:bg-credit' : ''}>
                <ArrowDownLeft /> Son compte
              </TabsTrigger>
              <TabsTrigger value="moi" className={side === 'moi' ? 'text-debt after:bg-debt' : ''}>
                <ArrowUpRight /> Mon compte
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {(() => {
            const creditType = side === 'lui' ? 'il_a_pris_credit' : 'j_ai_pris_credit'
            const payType = side === 'lui' ? 'il_m_a_verse' : 'je_lui_ai_verse'
            const shown = partnerMovements.filter(m => m.type === (kind === 'credit' ? creditType : payType))
            const chips: { value: 'credit' | 'versement'; label: string }[] = [
              { value: 'credit', label: side === 'lui' ? 'Crédits' : 'Dettes' },
              { value: 'versement', label: 'Versements' },
            ]
            return (
              <MovementHistory
                key={`${side}-${kind}`}
                title={side === 'lui' ? 'Son compte' : 'Mon compte'}
                movements={shown}
                hideLabel
                onOpen={openMovementDetail}
                amountClass={() => (side === 'lui' ? 'text-credit' : 'text-debt')}
                action={
                  <Button size="sm" onClick={() => openNewMovement(partner.id)}>
                    <Plus /> Enregistrer une opération
                  </Button>
                }
                toolbar={
                  <div className="flex gap-2">
                    {chips.map(c => (
                      <Button
                        key={c.value}
                        size="sm"
                        variant={kind === c.value ? 'secondary' : 'ghost'}
                        className="rounded-full"
                        onClick={() => setKind(c.value)}
                      >
                        {c.label}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {partnerMovements.filter(m => m.type === (c.value === 'credit' ? creditType : payType)).length}
                        </span>
                      </Button>
                    ))}
                  </div>
                }
              />
            )
          })()}
        </>
      )}

      {view === 'ensemble' && (
        <Button size="lg" className="h-12" onClick={() => openNewMovement(partner.id)}>
          <Plus /> Enregistrer une opération
        </Button>
      )}
    </div>
  )
}
