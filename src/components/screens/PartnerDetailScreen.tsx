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
// - deux cartes, « Il me doit » (lui) et « Je lui dois » (moi) : en grand ce qui reste dû,
//   une barre déjà versé / reste, puis le total et le déjà versé ;
// - un seul bouton pour enregistrer une opération (la fenêtre propose les 4 actions).

export const PartnerDetailScreen: React.FC<{ partnerId: string }> = ({ partnerId }) => {
  const { persons, movements, openNewMovement, openCompensation, openMovementDetail } = useStore()

  const [view, setView] = React.useState<'ensemble' | 'historique'>('ensemble')
  const [side, setSide] = React.useState<'lui' | 'moi'>('lui')
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
            title="Il me doit"
            Icon={ArrowDownLeft}
            tone="credit"
            remaining={owesMe}
            paid={paidToMe}
            totalDays={days(lastDateOf('il_a_pris_credit', partner.lastCreditToHimDate))}
            paidDays={days(lastDateOf('il_m_a_verse', partner.lastPaymentDate))}
          />
          <BalanceCard
            title="Je lui dois"
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
          {/* Le côté, comme les cartes : ce qu'il me doit / ce que je lui dois */}
          <Tabs value={side} onValueChange={v => setSide(v as 'lui' | 'moi')}>
            <TabsList className="w-full">
              <TabsTrigger value="lui" className="data-active:text-credit data-[state=active]:text-credit">
                <ArrowDownLeft /> Il me doit
              </TabsTrigger>
              <TabsTrigger value="moi" className="data-active:text-debt data-[state=active]:text-debt">
                <ArrowUpRight /> Je lui dois
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <MovementHistory
            key={side}
            title={side === 'lui' ? 'Il me doit' : 'Je lui dois'}
            movements={partnerMovements.filter(m =>
              side === 'lui'
                ? m.type === 'il_a_pris_credit' || m.type === 'il_m_a_verse'
                : m.type === 'j_ai_pris_credit' || m.type === 'je_lui_ai_verse'
            )}
            onOpen={openMovementDetail}
            filters={[
              { value: 'credits', label: 'Crédits', match: m => m.type === 'il_a_pris_credit' || m.type === 'j_ai_pris_credit' },
              { value: 'versements', label: 'Versements', match: m => m.type === 'il_m_a_verse' || m.type === 'je_lui_ai_verse' },
            ]}
            amountClass={m =>
              m.type === 'il_m_a_verse' || m.type === 'il_a_pris_credit' ? 'text-credit' : 'text-debt'
            }
          />
        </>
      )}

      <Button size="lg" className="h-12" onClick={() => openNewMovement(partner.id)}>
        <Plus /> Enregistrer une opération
      </Button>
    </div>
  )
}
