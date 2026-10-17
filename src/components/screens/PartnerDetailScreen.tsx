import React from 'react'
import { useStore } from '@/data/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatFCFA } from '@/lib/utils'
import { 
  ArrowLeft, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Scale, 
  Phone, 
  Clock, 
  FileText, 
  CheckCircle2, 
  Ban 
} from 'lucide-react'

export const PartnerDetailScreen: React.FC<{ partnerId: string }> = ({ partnerId }) => {
  const { 
    persons, 
    movements, 
    setSelectedPersonId, 
    openNewMovement, 
    openCompensation, 
    openMovementDetail 
  } = useStore()

  const partner = persons.find(p => p.id === partnerId)
  if (!partner) return null

  const owesMe = partner.owesMe || 0
  const iOweHim = partner.iOweHim || 0
  const netBalance = owesMe - iOweHim

  // Historique des mouvements de ce partenaire
  const partnerMovements = movements.filter(m => m.personId === partnerId)
  const lastReceived = partnerMovements.filter(m => m.type === 'il_m_a_verse' && !m.isCancelled).slice(0, 3)
  const lastPaid = partnerMovements.filter(m => m.type === 'je_lui_ai_verse' && !m.isCancelled).slice(0, 3)

  return (
    <div className="space-y-6 pb-24 md:pb-8">
      
      {/* Header avec retour */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedPersonId(null)}
          className="rounded-xl h-10 w-10 shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
              {partner.name}
            </h1>
            <Badge variant="outline" className="text-xs shrink-0">Partenaire</Badge>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
            <Phone className="w-3.5 h-3.5" /> {partner.phone}
            {partner.role && <span>· {partner.role}</span>}
          </p>
        </div>
      </div>

      {/* LES DEUX COMPTEURS SÉPARÉS & LE SOLDE NET (RÈGLE OBLIGATOIRE DE LA MISSION) */}
      <Card className="border-2 shadow-sm bg-card overflow-hidden">
        <div className="grid grid-cols-2 divide-x border-b">
          
          {/* Compteur 1 : Il me doit */}
          <div className="p-4 space-y-1 bg-credit/5">
            <span className="text-xs font-bold text-credit uppercase tracking-wider block">
              Il me doit
            </span>
            <div className="text-2xl sm:text-3xl font-black text-credit">
              {formatFCFA(owesMe)}
            </div>
            <p className="text-[11px] text-muted-foreground">Ses achats à crédit chez moi</p>
          </div>

          {/* Compteur 2 : Je lui dois */}
          <div className="p-4 space-y-1 bg-debt/5">
            <span className="text-xs font-bold text-debt uppercase tracking-wider block">
              Je lui dois
            </span>
            <div className="text-2xl sm:text-3xl font-black text-debt">
              {formatFCFA(iOweHim)}
            </div>
            <p className="text-[11px] text-muted-foreground">Mes achats à crédit chez lui</p>
          </div>

        </div>

        {/* Phrase de Solde Net */}
        <div className="p-4 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs text-muted-foreground uppercase font-bold block">
              Solde net calculé
            </span>
            <p className="text-base sm:text-lg font-bold text-foreground">
              {netBalance > 0 && (
                <span className="text-credit">
                  Au total, <span className="underline underline-offset-4">il vous doit {formatFCFA(netBalance)}</span>
                </span>
              )}
              {netBalance < 0 && (
                <span className="text-debt">
                  Au total, <span className="underline underline-offset-4">vous lui devez {formatFCFA(Math.abs(netBalance))}</span>
                </span>
              )}
              {netBalance === 0 && (
                <span className="text-muted-foreground">
                  Vos comptes sont parfaitement équilibrés (0 FCFA).
                </span>
              )}
            </p>
          </div>

          {/* Bouton Compenser (Manuel, jamais automatique) */}
          {owesMe > 0 && iOweHim > 0 && (
            <Button
              onClick={() => openCompensation(partner.id)}
              variant="outline"
              className="border-primary/30 hover:border-primary gap-2 h-11 text-xs font-bold shrink-0 shadow-sm"
            >
              <Scale className="w-4 h-4 text-primary" />
              Compenser {formatFCFA(Math.min(owesMe, iOweHim))}
            </Button>
          )}
        </div>
      </Card>

      {/* LES 4 GROS BOUTONS D'ACTION TACTILES (MINIMUM 48PX DE HAUTEUR) */}
      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
          Actions rapides sur ce compte :
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          
          {/* Action 1 : Il m'a versé */}
          <button
            type="button"
            onClick={() => openNewMovement(partner.id, 'il_m_a_verse')}
            className="h-16 px-4 rounded-xl border-2 border-credit/40 bg-credit/10 hover:bg-credit/20 active:scale-[0.98] transition-all flex items-center justify-between text-left group shadow-sm"
          >
            <div>
              <span className="text-base font-extrabold text-credit block">
                1. Il m'a versé
              </span>
              <span className="text-xs text-muted-foreground">Diminue ce qu'il me doit</span>
            </div>
            <ArrowDownLeft className="w-6 h-6 text-credit group-hover:scale-110 transition-transform" />
          </button>

          {/* Action 2 : Il a pris à crédit */}
          <button
            type="button"
            onClick={() => openNewMovement(partner.id, 'il_a_pris_credit')}
            className="h-16 px-4 rounded-xl border-2 border-credit/40 bg-card hover:bg-credit/5 active:scale-[0.98] transition-all flex items-center justify-between text-left group shadow-sm"
          >
            <div>
              <span className="text-base font-extrabold text-foreground block">
                2. Il a pris à crédit
              </span>
              <span className="text-xs text-muted-foreground">Augmente ce qu'il me doit</span>
            </div>
            <ArrowUpRight className="w-6 h-6 text-credit group-hover:scale-110 transition-transform" />
          </button>

          {/* Action 3 : Je lui ai versé */}
          <button
            type="button"
            onClick={() => openNewMovement(partner.id, 'je_lui_ai_verse')}
            className="h-16 px-4 rounded-xl border-2 border-debt/40 bg-debt/10 hover:bg-debt/20 active:scale-[0.98] transition-all flex items-center justify-between text-left group shadow-sm"
          >
            <div>
              <span className="text-base font-extrabold text-debt block">
                3. Je lui ai versé
              </span>
              <span className="text-xs text-muted-foreground">Diminue ce que je lui dois</span>
            </div>
            <ArrowUpRight className="w-6 h-6 text-debt group-hover:scale-110 transition-transform" />
          </button>

          {/* Action 4 : J'ai pris à crédit */}
          <button
            type="button"
            onClick={() => openNewMovement(partner.id, 'j_ai_pris_credit')}
            className="h-16 px-4 rounded-xl border-2 border-debt/40 bg-card hover:bg-debt/5 active:scale-[0.98] transition-all flex items-center justify-between text-left group shadow-sm"
          >
            <div>
              <span className="text-base font-extrabold text-foreground block">
                4. J'ai pris à crédit
              </span>
              <span className="text-xs text-muted-foreground">Augmente ce que je lui dois</span>
            </div>
            <ArrowDownLeft className="w-6 h-6 text-debt group-hover:scale-110 transition-transform" />
          </button>

        </div>
      </div>

      {/* DERNIERS VERSEMENTS REÇUS ET FAITS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        {/* Derniers versements reçus */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-credit flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Derniers versements reçus de lui
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {lastReceived.length === 0 ? (
              <p className="text-muted-foreground py-3">Aucun versement reçu enregistré.</p>
            ) : (
              lastReceived.map(m => (
                <div key={m.id} onClick={() => openMovementDetail(m)} className="p-2.5 rounded-lg border bg-muted/10 flex justify-between cursor-pointer hover:bg-muted/30">
                  <div>
                    <p className="font-semibold text-foreground">{m.date}</p>
                    <p className="text-muted-foreground">{m.paymentMethod === 'momo_mtn' ? 'MTN MoMo' : m.paymentMethod === 'airtel_money' ? 'Airtel Money' : 'Espèces'}</p>
                  </div>
                  <span className="font-bold text-credit text-sm">{formatFCFA(m.amount)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Derniers versements faits */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-debt flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4" /> Derniers versements que je lui ai faits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {lastPaid.length === 0 ? (
              <p className="text-muted-foreground py-3">Aucun versement fait enregistré.</p>
            ) : (
              lastPaid.map(m => (
                <div key={m.id} onClick={() => openMovementDetail(m)} className="p-2.5 rounded-lg border bg-muted/10 flex justify-between cursor-pointer hover:bg-muted/30">
                  <div>
                    <p className="font-semibold text-foreground">{m.date}</p>
                    <p className="text-muted-foreground">{m.paymentMethod === 'momo_mtn' ? 'MTN MoMo' : m.paymentMethod === 'airtel_money' ? 'Airtel Money' : 'Espèces'}</p>
                  </div>
                  <span className="font-bold text-debt text-sm">{formatFCFA(m.amount)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

      </div>

      {/* HISTORIQUE COMPLET DES MOUVEMENTS (NON SUPPRIMABLES) */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Historique complet du compte ({partnerMovements.length})
          </CardTitle>
          <span className="text-xs text-muted-foreground">Cliquez pour reçu ou annulation</span>
        </CardHeader>
        <CardContent className="space-y-2">
          {partnerMovements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucun mouvement pour l'instant.</p>
          ) : (
            partnerMovements.map(m => (
              <div
                key={m.id}
                onClick={() => openMovementDetail(m)}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  m.isCancelled ? 'bg-destructive/5 opacity-60 border-destructive/20 line-through' : 'bg-card hover:bg-muted/40'
                }`}
              >
                <div className="space-y-0.5 min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">{m.date}</span>
                    {m.isCancelled && (
                      <Badge variant="destructive" className="text-[10px] py-0 px-1.5 no-underline">
                        Annulé ({m.cancellationReason})
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-bold text-foreground truncate">{m.label}</p>
                  {m.note && <p className="text-xs text-muted-foreground truncate">{m.note}</p>}
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-base font-extrabold ${
                    m.type.includes('verse') ? 'text-credit' : 'text-foreground'
                  }`}>
                    {formatFCFA(m.amount)}
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    {m.paymentMethod === 'momo_mtn' ? 'MTN MoMo' : m.paymentMethod === 'airtel_money' ? 'Airtel Money' : 'Espèces'}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

    </div>
  )
}
