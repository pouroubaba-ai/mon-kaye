import React from 'react'
import { ArrowDownLeft, ArrowUpRight, Plus, Scale } from 'lucide-react'

import { useStore, returnedOn } from '@/data/store'
import { Badge } from '@/components/ui/badge'
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

// Onglets de la fiche : un peu plus serrés pour que les trois tiennent sur un téléphone.
const TAB = 'gap-1 px-1.5 text-[13px] min-[400px]:text-sm'

export const PartnerDetailScreen: React.FC<{ partnerId: string }> = ({ partnerId }) => {
  const { persons, movements, openNewMovement, openCompensation, openMovementDetail } = useStore()

  // Trois onglets au même niveau : la situation, puis chaque compte (ses opérations).
  const [view, setViewRaw] = React.useState<'ensemble' | 'lui' | 'moi'>('ensemble')
  const side: 'lui' | 'moi' = view === 'moi' ? 'moi' : 'lui'
  const [kind, setKind] = React.useState<'credit' | 'versement' | 'retour'>('credit')
  const setView = (v: 'ensemble' | 'lui' | 'moi') => {
    setViewRaw(v)
    setKind('credit')
  }
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

      {/* Un seul niveau d'onglets, avec les mots du comptoir : pas d'« Historique » à traverser. */}
      <Tabs value={view} onValueChange={v => setView(v as 'ensemble' | 'lui' | 'moi')}>
        <TabsList className="w-full">
          {/* Même icône que les cartes, devant le libellé ; sur un très petit écran (< 360 px), les icônes s'effacent pour que tout tienne. */}
          <TabsTrigger value="ensemble" className={TAB}>Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="lui" className={TAB}><ArrowDownLeft className="text-credit max-[359px]:hidden" /> Son compte</TabsTrigger>
          <TabsTrigger value="moi" className={TAB}><ArrowUpRight className="text-debt max-[359px]:hidden" /> Mon compte</TabsTrigger>
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
            onClick={() => setView('lui')}
            remaining={owesMe}
            paid={paidToMe}
            totalDays={days(lastDateOf('il_a_pris_credit', partner.lastCreditToHimDate))}
            paidDays={days(lastDateOf('il_m_a_verse', partner.lastPaymentDate))}
          />
          <BalanceCard
            title="Mon compte"
            Icon={ArrowUpRight}
            tone="debt"
            onClick={() => setView('moi')}
            remaining={iOweHim}
            paid={paidByMe}
            totalDays={days(lastDateOf('j_ai_pris_credit', partner.lastCreditFromHimDate))}
            paidDays={days(lastDateOf('je_lui_ai_verse', partner.lastPaidByMeDate))}
          />
        </div>
        </>
      )}

      {view !== 'ensemble' && (
        <>
          {(() => {
            const creditType = side === 'lui' ? 'il_a_pris_credit' : 'j_ai_pris_credit'
            const payType = side === 'lui' ? 'il_m_a_verse' : 'je_lui_ai_verse'
            const returnType = side === 'lui' ? 'il_a_retourne' : 'j_ai_retourne'
            const typeOf = (k: 'credit' | 'versement' | 'retour') => (k === 'credit' ? creditType : k === 'versement' ? payType : returnType)
            const nReturns = partnerMovements.filter(m => m.type === returnType).length
            const shown = partnerMovements.filter(m => m.type === typeOf(kind))
            // « Retours » n'apparaît que s'il y en a.
            const chips: { value: 'credit' | 'versement' | 'retour'; label: string }[] = [
              { value: 'credit', label: side === 'lui' ? 'Crédits' : 'Dettes' },
              { value: 'versement', label: 'Versements' },
              ...(nReturns > 0 ? [{ value: 'retour' as const, label: 'Retours' }] : []),
            ]
            return (
              <MovementHistory
                key={`${side}-${kind}`}
                title={side === 'lui' ? 'Son compte' : 'Mon compte'}
                movements={shown}
                hideLabel
                sub={m => {
                  if (m.type !== creditType) return undefined
                  const r = returnedOn(movements, m.id)
                  // Pastille rouge : ce qui a été retourné sur ce crédit.
                  return r > 0 ? <Badge variant="destructive">Retour {formatFCFA(r)}</Badge> : undefined
                }}
                onOpen={openMovementDetail}
                amountClass={() => (side === 'lui' ? 'text-credit' : 'text-debt')}
                action={
                  <Button size="sm" onClick={() => openNewMovement(partner.id, undefined, side === 'lui' ? 'credit' : 'debt')}>
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
                          {partnerMovements.filter(m => m.type === typeOf(c.value)).length}
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
