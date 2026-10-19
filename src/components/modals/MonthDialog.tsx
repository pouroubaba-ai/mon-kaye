import * as React from 'react'
import { Ban, CircleMinus, CirclePlus, Lock, Pause, X } from 'lucide-react'

import { useStore } from '@/data/store'
import type { Movement } from '@/data/mockData'
import { currentPeriod, daysInPeriod, ofMonth, payrollOf } from '@/data/payroll'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn, formatFCFA } from '@/lib/utils'

// Fiche d'un mois de salaire.
// - Toujours : le détail (base, ajouts, retenues, à payer, versé, reste).
// - Mois en cours seulement : ajouter au salaire, ajouter une retenue, annuler une ligne
//   (dont la retenue d'avance automatique), arrêter le mois, annuler le mois.
// - Mois passé : scellé ; on peut seulement le payer.

const thousands = (s: string) => (s ? Number(s).toLocaleString('fr-FR').replace(/\s/g, ' ') : '')
const digits = (s: string) => s.replace(/\D/g, '').slice(0, 9)

type Panel = 'none' | 'arreter' | 'annuler'
type Basis = 'complet' | 'prorata' | 'fixe'

export function MonthDialog({
  empId,
  period,
  open,
  onOpenChange,
}: {
  empId: string
  period: string | null
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { persons, movements, monthStates, cancelMovement, openNewMovement, openMovementDetail, stopMonth, cancelMonth } = useStore()
  const [panel, setPanel] = React.useState<Panel>('none')
  const [basis, setBasis] = React.useState<Basis>('prorata')
  const [daysStr, setDaysStr] = React.useState('')
  const [fixedStr, setFixedStr] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [cancelling, setCancelling] = React.useState<string | null>(null) // ligne en cours d'annulation
  const [lineReason, setLineReason] = React.useState('')
  const [askSurplus, setAskSurplus] = React.useState<{ amount: number; apply: (c: 'avance' | 'rendu') => void } | null>(null)

  React.useEffect(() => {
    if (!open) return
    setPanel('none')
    setBasis('prorata')
    setDaysStr(String(new Date().getDate()))
    setFixedStr('')
    setReason('')
    setCancelling(null)
    setLineReason('')
    setAskSurplus(null)
  }, [open, period])

  const emp = persons.find(p => p.id === empId)
  if (!emp || !period) return null
  const pr = payrollOf(empId, movements, monthStates)
  const row = pr.months.find(m => m.period === period)
  if (!row) return null
  const isOpen = row.state === 'en_cours' && period === currentPeriod()
  const salary = emp.salary || 0
  const dim = daysInPeriod(period)

  // Nouveau salaire de base si on arrête le mois
  const days = Math.min(dim, parseInt(daysStr, 10) || 0)
  const newBase = basis === 'complet' ? salary : basis === 'prorata' ? Math.round((salary * days) / dim) : parseInt(fixedStr, 10) || 0
  const basisLabel = basis === 'complet' ? 'mois complet' : basis === 'prorata' ? `prorata ${days}/${dim} j` : 'montant fixe'

  // Surplus : ce qu'il a déjà reçu au-delà de ce qui sera dû après le changement.
  const totalPaid = pr.months.reduce((a, m) => a + m.verse, 0) + pr.surplus
  const totalAPayer = pr.months.reduce((a, m) => a + m.aPayer, 0)
  const surplusIf = (newAPayerOfMonth: number) => Math.max(0, totalPaid - (totalAPayer - row.aPayer + newAPayerOfMonth))

  const runOrAsk = (newAPayerOfMonth: number, apply: (c?: 'avance' | 'rendu') => void) => {
    const s = surplusIf(newAPayerOfMonth)
    if (s > 0) setAskSurplus({ amount: s, apply })
    else apply()
  }

  const doStop = () => {
    if (newBase <= 0 && basis !== 'complet') return
    const newAPayer = Math.max(0, newBase + row.ajouts - row.retenues)
    runOrAsk(newAPayer, c => {
      stopMonth(empId, period, newBase, basisLabel, c)
      setPanel('none')
      setAskSurplus(null)
    })
  }
  const doCancel = () => {
    if (!reason.trim()) return
    runOrAsk(0, c => {
      cancelMonth(empId, period, reason.trim(), c)
      setReason('') // fait : rien à « abandonner » en fermant
      setPanel('none')
      setAskSurplus(null)
    })
  }

  const lines = [...row.items].sort((a, b) => order(a) - order(b))
  const canCancelLine = (m: Movement) => isOpen && !m.isCancelled && m.type !== 'salaire_du'

  const stateBadge = {
    en_cours: <Badge variant="outline">En cours</Badge>,
    passe: <Badge variant="secondary"><Lock /> Scellé</Badge>,
    arrete: <Badge variant="secondary"><Pause /> Arrêté</Badge>,
    annule: <Badge variant="destructive">Annulé</Badge>,
  }[row.state]

  const goAdd = (type: 'ajout_salaire' | 'retenue_manuelle') => {
    onOpenChange(false)
    window.setTimeout(() => openNewMovement(empId, type), 150)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dirty={reason.trim() !== '' || lineReason.trim() !== ''} dirtyKind="modification">
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>Salaire {ofMonth(period)}</DialogTitle>
            {stateBadge}
          </div>
          <DialogDescription>{emp.name}</DialogDescription>
        </DialogHeader>

        {/* Lignes du mois */}
        <div className="flex flex-col divide-y rounded-lg border text-sm">
          {lines.map(m => (
            <div key={m.id} className="flex flex-col gap-1.5 px-3 py-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => (m.note || m.items || m.receiptPhoto ? openMovementDetail(m) : undefined)}
                  className={cn('min-w-0 flex-1 truncate text-left', m.isCancelled && 'text-muted-foreground line-through')}
                >
                  {m.label}
                  {m.items?.length ? <span className="text-xs text-muted-foreground"> · {m.items.length} lignes</span> : null}
                </button>
                <span
                  className={cn(
                    'shrink-0 tabular-nums',
                    m.isCancelled ? 'text-destructive line-through' : m.type === 'salaire_du' ? '' : m.type === 'ajout_salaire' ? 'text-credit' : 'text-debt'
                  )}
                >
                  {m.type === 'salaire_du' ? '' : m.type === 'ajout_salaire' ? '+ ' : '− '}
                  {formatFCFA(m.amount)}
                </span>
                {canCancelLine(m) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="-mr-1.5 size-7 shrink-0 text-muted-foreground"
                    aria-label={`Annuler : ${m.label}`}
                    onClick={() => {
                      setCancelling(m.id)
                      setLineReason(m.type === 'retenue_salaire' ? 'Pas de retenue ce mois-ci' : '')
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
              {m.isCancelled && m.cancellationReason && <p className="text-xs text-muted-foreground">Annulé : {m.cancellationReason}</p>}
              {cancelling === m.id && (
                <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2">
                  {m.type === 'retenue_salaire' && (
                    <p className="text-xs text-muted-foreground">L'avance reste due : elle sera retenue un autre mois.</p>
                  )}
                  <Input placeholder="Motif" value={lineReason} onChange={e => setLineReason(e.target.value)} className="h-8 text-xs" />
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="flex-1" onClick={() => setCancelling(null)}>
                      Garder
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      disabled={!lineReason.trim()}
                      onClick={() => {
                        cancelMovement(m.id, lineReason.trim())
                        setCancelling(null)
                        setLineReason('')
                      }}
                    >
                      Annuler la ligne
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Totaux du mois */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Total label="À payer" value={row.aPayer} />
          <Total label="Versé" value={row.verse} />
          <Total label="Reste" value={row.reste} tone={row.reste > 0 ? 'debt' : undefined} />
        </div>

        {!isOpen && row.state !== 'annule' && (
          <p className="flex items-center gap-2 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
            <Lock className="size-3.5 shrink-0" /> Mois scellé : on peut seulement le payer (« Verser le salaire »).
          </p>
        )}

        {/* Trop reçu : on prévient avant d'arrêter ou d'annuler */}
        {askSurplus ? (
          <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <div>
              <p className="text-sm font-semibold">Il a déjà reçu {formatFCFA(askSurplus.amount)} de trop</p>
              <p className="text-xs text-muted-foreground">Après ce changement, ses versements dépassent ce qui lui est dû.</p>
            </div>
            <div className="grid gap-2">
              <Button onClick={() => askSurplus.apply('avance')}>Ça devient une avance à rendre</Button>
              <Button variant="outline" onClick={() => askSurplus.apply('rendu')}>Il l'a déjà rendu</Button>
              <Button variant="ghost" onClick={() => setAskSurplus(null)}>
                {panel === 'annuler' ? 'Ne pas annuler' : 'Ne pas arrêter'}
              </Button>
            </div>
          </div>
        ) : panel === 'arreter' ? (
          <div className="flex flex-col gap-3 rounded-xl border p-3">
            <p className="text-sm font-semibold">Arrêter le mois</p>
            <Tabs value={basis} onValueChange={v => setBasis(v as Basis)}>
              <TabsList className="w-full">
                <TabsTrigger value="complet">Mois complet</TabsTrigger>
                <TabsTrigger value="prorata">Prorata</TabsTrigger>
                <TabsTrigger value="fixe">Montant fixe</TabsTrigger>
              </TabsList>
            </Tabs>
            {basis === 'prorata' && (
              <label className="flex items-center gap-2 text-sm">
                Jours travaillés
                <Input inputMode="numeric" value={daysStr} onChange={e => setDaysStr(digits(e.target.value).slice(0, 2))} className="h-8 w-16 text-center" />
                <span className="text-muted-foreground">sur {dim}</span>
              </label>
            )}
            {basis === 'fixe' && (
              <Input inputMode="numeric" placeholder="Montant convenu" value={thousands(fixedStr)} onChange={e => setFixedStr(digits(e.target.value))} className="h-9" />
            )}
            <p className="text-sm">
              Salaire de base du mois : <span className="font-semibold tabular-nums">{formatFCFA(newBase)}</span>
              <span className="text-muted-foreground"> (au lieu de {formatFCFA(row.base)})</span>
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setPanel('none')}>
                Fermer
              </Button>
              <Button className="flex-1" disabled={basis !== 'complet' && newBase <= 0} onClick={doStop}>
                Arrêter le mois
              </Button>
            </div>
          </div>
        ) : panel === 'annuler' ? (
          <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm font-semibold text-destructive">Annuler le mois</p>
            <p className="text-xs text-muted-foreground">Base, ajouts et retenues du mois sont annulés et restent barrés ; l'avance reste due.</p>
            <Input placeholder="Motif obligatoire" value={reason} onChange={e => setReason(e.target.value)} className="h-9" />
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setPanel('none')}>
                Garder
              </Button>
              <Button variant="destructive" className="flex-1" disabled={!reason.trim()} onClick={doCancel}>
                Annuler le mois
              </Button>
            </div>
          </div>
        ) : (
          isOpen && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => goAdd('ajout_salaire')}>
                <CirclePlus /> Ajouter au salaire
              </Button>
              <Button variant="outline" onClick={() => goAdd('retenue_manuelle')}>
                <CircleMinus /> Ajouter une retenue
              </Button>
              <Button variant="ghost" onClick={() => setPanel('arreter')}>
                <Pause /> Arrêter le mois
              </Button>
              <Button variant="ghost" className="text-destructive" onClick={() => setPanel('annuler')}>
                <Ban /> Annuler le mois
              </Button>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  )
}

const order = (m: Movement) =>
  ({ salaire_du: 0, ajout_salaire: 1, retenue_salaire: 2, retenue_manuelle: 3 } as Record<string, number>)[m.type] ?? 9

function Total({ label, value, tone }: { label: string; value: number; tone?: 'debt' }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-muted/40 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-semibold tabular-nums', tone === 'debt' && 'text-debt')}>{formatFCFA(value)}</span>
    </div>
  )
}
