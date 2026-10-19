import * as React from 'react'
import { Ban, ChevronRight, CircleMinus, CirclePlus, Lock, Pause } from 'lucide-react'

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
  const { persons, movements, monthStates, cancelMovement, openNewMovement, openMovementDetail, stopMonth, cancelMonth, setMonthRetenue } = useStore()
  const [panel, setPanel] = React.useState<Panel>('none')
  const [basis, setBasis] = React.useState<Basis>('prorata')
  const [daysStr, setDaysStr] = React.useState('')
  const [fixedStr, setFixedStr] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [cancelling, setCancelling] = React.useState<string | null>(null) // ligne en cours d'annulation
  const [lineReason, setLineReason] = React.useState('')
  const [retStr, setRetStr] = React.useState('')
  const [openGroups, setOpenGroups] = React.useState<{ payer: boolean; retenues: boolean }>({ payer: false, retenues: false }) // nouveau montant de la retenue d'avance
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
    setOpenGroups({ payer: false, retenues: false })
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

  // Une retenue d'avance dont seul le montant a changé n'est pas affichée barrée : la nouvelle ligne dit « au lieu de … ».
  const REPLACED = ['Montant modifié pour ce mois', 'Façon de rendre modifiée']
  const lines = [...row.items]
    .filter(m => !(m.isCancelled && m.type === 'retenue_salaire' && REPLACED.includes(m.cancellationReason ?? '')))
    .sort((a, b) => order(a) - order(b))
  const canCancelLine = (m: Movement) => isOpen && !m.isCancelled && m.type !== 'salaire_du'

  // Totaux des deux lignes repliables
  const gross = lines.filter(m => !m.isCancelled && (m.type === 'salaire_du' || m.type === 'ajout_salaire')).reduce((a, m) => a + m.amount, 0)
  const deducted = Math.min(gross, row.retenues + row.verse)

  // Une ligne du mois (salaire, ajout, retenue) ; touchable dans le mois en cours pour la changer ou l'annuler.
  const renderLine = (m: Movement) => {
    const tappable = canCancelLine(m)
    return (
              <div key={m.id} className="flex flex-col border-b border-dashed py-2 last:border-0">
                <button
                  type="button"
                  disabled={!tappable && !(m.note || m.items || m.receiptPhoto)}
                  onClick={() => {
                    if (tappable) {
                      setCancelling(cancelling === m.id ? null : m.id)
                      setLineReason(m.type === 'retenue_salaire' ? 'Pas de retenue ce mois-ci' : '')
                      setRetStr(String(m.amount))
                    } else openMovementDetail(m)
                  }}
                  className="flex items-baseline gap-3 text-left disabled:cursor-default"
                >
                  <span className={cn('min-w-0 flex-1 truncate', m.isCancelled && 'text-muted-foreground line-through')}>
                    {m.label}
                    {m.items?.length ? <span className="text-xs text-muted-foreground"> · {m.items.length} lignes</span> : null}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 tabular-nums',
                      m.isCancelled ? 'text-muted-foreground line-through' : m.type === 'ajout_salaire' ? 'text-credit' : m.type === 'salaire_du' ? '' : 'text-debt'
                    )}
                  >
                    {m.type === 'salaire_du' ? '' : m.type === 'ajout_salaire' ? '+ ' : '− '}
                    {formatFCFA(m.amount)}
                  </span>
                </button>
                {!m.isCancelled && m.note?.startsWith('Montant changé') && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{m.note.replace('Montant changé ', '').replace(/[()]/g, '')}</p>
                )}
                {m.isCancelled && m.cancellationReason && <p className="mt-0.5 text-xs text-muted-foreground">Annulé : {m.cancellationReason}</p>}
                {cancelling === m.id && (
                  <div className="mt-2 flex flex-col gap-2 rounded-lg bg-muted/50 p-2.5">
                    {m.type === 'retenue_salaire' && (
                      // Retenue d'avance : changer son montant pour ce mois (plus ou moins), ou l'annuler.
                      <form
                        className="flex items-center gap-2"
                        onSubmit={e => {
                          e.preventDefault()
                          setMonthRetenue(empId, parseInt(retStr, 10) || 0)
                          setCancelling(null)
                        }}
                      >
                        <span className="shrink-0 text-xs text-muted-foreground">Ce mois-ci</span>
                        <Input
                          autoFocus
                          inputMode="numeric"
                          aria-label="Montant de la retenue ce mois-ci"
                          value={thousands(retStr)}
                          onFocus={e => e.currentTarget.select()}
                          onChange={e => setRetStr(digits(e.target.value))}
                          className="h-8 flex-1 text-right text-xs"
                        />
                        <Button type="submit" size="sm" disabled={(parseInt(retStr, 10) || 0) === m.amount}>
                          Changer
                        </Button>
                      </form>
                    )}
                    {m.type === 'retenue_salaire' && (
                      <p className="text-xs text-muted-foreground">Ou l'annuler : l'avance reste due, elle sera retenue un autre mois.</p>
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
    )
  }

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
    <Dialog open={open} onOpenChange={onOpenChange} dirty={reason.trim() !== '' || (cancelling !== null && lineReason.trim() !== '' && lineReason !== 'Pas de retenue ce mois-ci')} dirtyKind="modification">
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        {/* Mise en page : en-tête, résumé (le reste en grand), détail façon reçu, puis les actions. */}
        <div className="flex flex-col gap-5">
        <DialogHeader className="gap-1 p-0">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>Salaire {ofMonth(period)}</DialogTitle>
            {stateBadge}
          </div>
          <DialogDescription className="text-left">{emp.name}</DialogDescription>
        </DialogHeader>

        {/* Résumé : le reste à payer en grand ; la barre montre la part déjà déduite */}
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-xs text-muted-foreground">Reste à payer</p>
            <p className={cn('text-3xl font-bold tabular-nums', row.reste > 0 ? 'text-debt' : 'text-credit')}>{formatFCFA(row.reste)}</p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-credit" style={{ width: `${gross ? Math.round((deducted / gross) * 100) : 0}%` }} />
          </div>
        </div>

        {/* Deux lignes repliables, comme une fiche de paie :
            À payer (salaire + ajouts) − Retenues et versements = Reste à payer */}
        <div className="flex flex-col divide-y rounded-xl border text-sm">
          <Group
            title="À payer"
            total={gross}
            open={openGroups.payer}
            onToggle={() => setOpenGroups(g => ({ ...g, payer: !g.payer }))}
          >
            {lines.filter(m => m.type === 'salaire_du' || m.type === 'ajout_salaire').map(renderLine)}
          </Group>
          <Group
            title="Retenues et versements"
            total={deducted}
            minus
            open={openGroups.retenues}
            onToggle={() => setOpenGroups(g => ({ ...g, retenues: !g.retenues }))}
          >
            {lines.filter(m => m.type === 'retenue_salaire' || m.type === 'retenue_manuelle').map(renderLine)}
            {row.paymentParts.map(({ mov, amount }) => (
              <button
                key={mov.id}
                type="button"
                onClick={() => openMovementDetail(mov)}
                className="flex items-baseline gap-3 border-b border-dashed py-2 text-left last:border-0"
              >
                <span className="min-w-0 flex-1 truncate">
                  Versement du {mov.date.slice(0, 5)}
                  {amount < mov.amount && <span className="text-xs text-muted-foreground"> (en partie)</span>}
                </span>
                <span className="shrink-0 tabular-nums text-debt">− {formatFCFA(amount)}</span>
              </button>
            ))}
            {lines.every(m => m.type !== 'retenue_salaire' && m.type !== 'retenue_manuelle') && row.paymentParts.length === 0 && (
              <p className="py-2 text-xs text-muted-foreground">Rien pour l'instant.</p>
            )}
          </Group>
        </div>
        {isOpen && lines.some(canCancelLine) && (
          <p className="-mt-3 text-xs text-muted-foreground">Touchez un ajout ou une retenue pour le changer ou l'annuler.</p>
        )}

        {!isOpen && row.state !== 'annule' && (
          <p className="flex items-center gap-2 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
            <Lock className="size-3.5 shrink-0" /> Mois scellé : on peut seulement le payer.
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
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-11" onClick={() => goAdd('ajout_salaire')}>
                  <CirclePlus className="text-credit" /> Ajout
                </Button>
                <Button variant="outline" className="h-11" onClick={() => goAdd('retenue_manuelle')}>
                  <CircleMinus className="text-debt" /> Retenue
                </Button>
              </div>
              {/* Actions plus rares, plus discrètes */}
              <div className="flex items-center justify-center gap-1 text-xs">
                <Button variant="link" size="sm" className="h-auto px-2 text-muted-foreground" onClick={() => setPanel('arreter')}>
                  <Pause className="size-3.5" /> Arrêter le mois
                </Button>
                <span className="text-muted-foreground/50">·</span>
                <Button variant="link" size="sm" className="h-auto px-2 text-destructive" onClick={() => setPanel('annuler')}>
                  <Ban className="size-3.5" /> Annuler le mois
                </Button>
              </div>
            </div>
          )
        )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

const order = (m: Movement) =>
  ({ salaire_du: 0, ajout_salaire: 1, retenue_salaire: 2, retenue_manuelle: 3 } as Record<string, number>)[m.type] ?? 9

// Ligne repliable : titre et total ; on la touche pour voir le détail.
function Group({
  title,
  total,
  minus,
  open,
  onToggle,
  children,
}: {
  title: string
  total: number
  minus?: boolean
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex items-center gap-2 px-3 py-3 text-left">
        <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
        <span className="flex-1 font-medium">{title}</span>
        <span className={cn('font-semibold tabular-nums', minus && total > 0 && 'text-debt')}>
          {minus && total > 0 ? '− ' : ''}
          {formatFCFA(total)}
        </span>
      </button>
      {open && <div className="flex flex-col px-3 pb-2 pl-9">{children}</div>}
    </div>
  )
}
