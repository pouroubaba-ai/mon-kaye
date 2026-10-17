import React from 'react'
import { ArrowDownLeft, ArrowUpRight, Phone, Plus, Scale } from 'lucide-react'

import { useStore } from '@/data/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { MovementHistory } from '@/components/movement-history'
import { formatFCFA } from '@/lib/utils'

// Fiche partenaire (modèles shadcn : section-cards + Card + Tabs).
// Chaque compteur porte ses deux actions : on agit là où on lit le chiffre.

export const PartnerDetailScreen: React.FC<{ partnerId: string }> = ({ partnerId }) => {
  const { persons, movements, openNewMovement, openCompensation, openMovementDetail } = useStore()

  const partner = persons.find(p => p.id === partnerId)
  if (!partner) return null

  const owesMe = partner.owesMe || 0
  const iOweHim = partner.iOweHim || 0
  const net = owesMe - iOweHim
  const partnerMovements = movements.filter(m => m.personId === partnerId)

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <ArrowDownLeft className="size-4 text-credit" /> Il me doit
            </CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums text-credit">{formatFCFA(owesMe)}</CardTitle>
          </CardHeader>
          <CardFooter className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => openNewMovement(partner.id, 'il_m_a_verse')}>
              <ArrowDownLeft /> Il m'a versé
            </Button>
            <Button variant="outline" onClick={() => openNewMovement(partner.id, 'il_a_pris_credit')}>
              <Plus /> Il a pris à crédit
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <ArrowUpRight className="size-4 text-debt" /> Je lui dois
            </CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums text-debt">{formatFCFA(iOweHim)}</CardTitle>
          </CardHeader>
          <CardFooter className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => openNewMovement(partner.id, 'je_lui_ai_verse')}>
              <ArrowUpRight /> Je lui ai versé
            </Button>
            <Button variant="outline" onClick={() => openNewMovement(partner.id, 'j_ai_pris_credit')}>
              <Plus /> J'ai pris à crédit
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardDescription>Au total</CardDescription>
          <CardTitle className={net > 0 ? 'text-credit' : net < 0 ? 'text-debt' : ''}>
            {net > 0 && `Il vous doit ${formatFCFA(net)}`}
            {net < 0 && `Vous lui devez ${formatFCFA(-net)}`}
            {net === 0 && 'Comptes équilibrés'}
          </CardTitle>
          {owesMe > 0 && iOweHim > 0 && (
            <CardAction>
              <Button variant="secondary" size="sm" onClick={() => openCompensation(partner.id)}>
                <Scale /> Compenser
              </Button>
            </CardAction>
          )}
        </CardHeader>
      </Card>

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
