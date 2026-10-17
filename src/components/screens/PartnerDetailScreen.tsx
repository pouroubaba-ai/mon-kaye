import React from 'react'
import { ArrowDownLeft, ArrowUpRight, Plus, Scale } from 'lucide-react'

import { useStore } from '@/data/store'
import { Button } from '@/components/ui/button'
import { MovementHistory } from '@/components/movement-history'
import { PersonHeader } from '@/components/person-header'
import { BalanceCard } from '@/components/balance-card'
import { formatFCFA } from '@/lib/utils'

// Fiche d'une personne, inspirée des cartes « Payroll » :
// - bandeau en haut, seulement si chacun doit quelque chose à l'autre : qui doit à qui, au net ;
// - deux cartes, « Il me doit » (lui) et « Je lui dois » (moi) : en grand ce qui reste dû,
//   une barre déjà versé / reste, puis le total et le déjà versé ;
// - un seul bouton pour enregistrer une opération (la fenêtre propose les 4 actions).

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
      <PersonHeader person={partner} />

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
