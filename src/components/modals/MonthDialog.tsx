import * as React from 'react'
import { Ban, CircleMinus, CirclePlus, Eye, FileText, Lock, Pause, Pencil } from 'lucide-react'

import { useStore } from '@/data/store'
import { PAYMENT_LABELS } from '@/components/movement-history'
import type { Movement } from '@/data/mockData'
import { currentPeriod, daysInPeriod, ofMonth, payrollOf, planCancelMonth, planStopMonth } from '@/data/payroll'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PayslipDialog } from '@/components/modals/PayslipDialog'
import { cn, formatFCFA, useKept } from '@/lib/utils'

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
  empId: empIdProp,
  period: periodProp,
  open,
  onOpenChange,
}: {
  empId: string
  period: string | null
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  // Pendant la fermeture, on garde le mois affiché (sinon la fenêtre disparaît d'un coup)
  const empId = useKept(empIdProp || null) ?? ''
  const period = useKept(periodProp)
  const { persons, movements, monthStates, cancelMovement, openNewMovement, openMovementDetail, stopMonth, cancelMonth, setMonthRetenue } = useStore()
  const [panel, setPanel] = React.useState<Panel>('none')
  const [slip, setSlip] = React.useState(false) // fiche de paie ouverte par-dessus
  const [basis, setBasis] = React.useState<Basis>('complet')
  const [daysStr, setDaysStr] = React.useState('')
  const [fixedStr, setFixedStr] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [cancelling, setCancelling] = React.useState<string | null>(null) // ligne en cours d'annulation
  const keptCancelling = useKept(cancelling)
  const [lineReason, setLineReason] = React.useState('')
  const [retStr, setRetStr] = React.useState('')
  const [askSurplus, setAskSurplus] = React.useState<{ amount: number; apply: (c: 'avance' | 'rendu') => void } | null>(null)

  React.useEffect(() => {
    if (!open) return
    setPanel('none')
    setSlip(false)
    setBasis('complet')
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
  const basisLabel = basis === 'complet' ? 'montant complet' : basis === 'prorata' ? `${days} jours sur ${dim}` : 'montant convenu'

  // Trop reçu : calculé exactement comme à l'enregistrement (même calcul), pour annoncer le vrai montant.
  const runOrAsk = (plan: { next: Movement[]; states: Record<string, 'arrete' | 'annule'> }, apply: (c?: 'avance' | 'rendu') => void) => {
    const s = payrollOf(empId, plan.next, plan.states).surplus
    if (s > 0) setAskSurplus({ amount: s, apply })
    else apply()
  }

  const doStop = () => {
    if (newBase <= 0 && basis !== 'complet') return
    runOrAsk(planStopMonth(empId, movements, monthStates, period, newBase, basisLabel, ''), c => {
      stopMonth(empId, period, newBase, basisLabel, c)
      setPanel('none')
      setAskSurplus(null)
    })
  }
  const doCancel = () => {
    if (!reason.trim()) return
    runOrAsk(planCancelMonth(empId, movements, monthStates, period, reason.trim(), ''), c => {
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
  // Crayon : ajouts et retenues du mois en cours ; la retenue d'avance reste modifiable même mise à 0
  const canCancelLine = (m: Movement) => isOpen && m.type !== 'salaire_du' && (!m.isCancelled || m.type === 'retenue_salaire')

  // Totaux des deux lignes repliables
  const gross = lines.filter(m => !m.isCancelled && (m.type === 'salaire_du' || m.type === 'ajout_salaire')).reduce((a, m) => a + m.amount, 0)
  const deducted = Math.min(gross, row.retenues + row.verse)

  // Une ligne du mois (salaire, ajout, retenue) ; touchable dans le mois en cours pour la changer ou l'annuler.
  const renderLine = (m: Movement) => {
    const tappable = canCancelLine(m)
    // Retenue prévue : on montre ce qu'elle vaut vraiment (limitée à l'avance, baissée par un versement en plus)
    const plannedLive = m.type === 'retenue_salaire' && isOpen && !m.isCancelled
    const shown = plannedLive ? pr.plannedRetenue : m.amount
    const why = !plannedLive || shown === m.amount
      ? null
      : pr.plannedCap < m.amount && shown === pr.plannedCap
        ? pr.plannedCap === 0 ? "Plus d'avance à rendre" : `Il ne doit plus que ${formatFCFA(pr.plannedCap)}`
        : `Baissée par un versement en plus (au lieu de ${formatFCFA(m.amount)})`
    return (
              <div key={m.id} className="flex flex-col border-b border-dashed py-2 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="flex min-w-0 flex-1 items-baseline gap-3">
                    <span className={cn('min-w-0 flex-1 truncate', m.isCancelled && 'text-muted-foreground line-through')}>
                      {m.label}
                      {m.type === 'retenue_salaire' && isOpen && !m.isCancelled && <span className="text-xs text-muted-foreground"> · prévue</span>}
                      {m.items?.length ? <span className="text-xs text-muted-foreground"> · {m.items.length} lignes</span> : null}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 tabular-nums',
                        m.isCancelled ? 'text-muted-foreground line-through' : m.type === 'ajout_salaire' ? 'text-credit' : m.type === 'salaire_du' ? '' : 'text-debt'
                      )}
                    >
                      {m.type === 'salaire_du' ? '' : m.type === 'ajout_salaire' ? '+ ' : '− '}
                      {formatFCFA(shown)}
                    </span>
                  </div>
                  {/* Bouton visible pour modifier la ligne (mois en cours) */}
                  {tappable && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn('-my-1 -mr-2 size-7 shrink-0 text-muted-foreground', cancelling === m.id && 'bg-muted text-foreground')}
                      aria-label={`Modifier : ${m.label}`}
                      onClick={() => {
                        setCancelling(m.id)
                        setLineReason('')
                        setRetStr(String(m.amount))
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  )}
                </div>
                {why && <p className="mt-0.5 text-xs text-muted-foreground">{why}</p>}
                {!why && !m.isCancelled && m.note?.startsWith('Montant changé') && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{m.note.replace('Montant changé ', '').replace(/[()]/g, '')}</p>
                )}
                {m.isCancelled && m.cancellationReason && <p className="mt-0.5 text-xs text-muted-foreground">Annulé : {m.cancellationReason}</p>}
              </div>
    )
  }

  const stateBadge = {
    en_cours: <Badge variant="outline">En cours</Badge>,
    passe: <Badge variant="secondary"><Lock /> Scellé</Badge>,
    arrete: <Badge variant="secondary"><Pause /> Arrêté</Badge>,
    annule: <Badge variant="destructive">Annulé</Badge>,
  }[row.state]

  // La fenêtre d'ajout s'ouvre par-dessus ; en se fermant, on retrouve la fiche du mois.
  const goAdd = (type: 'ajout_salaire' | 'retenue_manuelle') => openNewMovement(empId, type)

  // Ligne en cours de modification (petite fenêtre à part)
  const editing = keptCancelling ? row.items.find(m => m.id === keptCancelling) : undefined
  // Retenue d'avance : jamais plus que ce qu'il doit encore sur ses avances
  const maxRetenue = editing?.type === 'retenue_salaire' ? pr.advanceReste : 0
  const retAmount = parseInt(retStr, 10) || 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dirty={reason.trim() !== ''} dirtyKind="modification">
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

        {/* Deux lignes, comme une fiche de paie : Salaire et ajouts − Retenues et versements = Reste à payer.
            L'œil ouvre le détail dans une fenêtre à part (rien ne se déplie ici). */}
        <div className="flex flex-col divide-y rounded-xl border text-sm">
          <Group
            title="Salaire et ajouts"
            total={gross}
            subtitle={`${emp.name} · salaire ${ofMonth(period)}`}
          >
            {lines.filter(m => m.type === 'salaire_du' || m.type === 'ajout_salaire').map(renderLine)}
          </Group>
          <Group
            title="Retenues et versements"
            total={deducted}
            minus
            subtitle={`${emp.name} · salaire ${ofMonth(period)}`}
          >
            {lines.filter(m => m.type === 'retenue_salaire' || m.type === 'retenue_manuelle').map(renderLine)}
            {row.paymentParts.map(({ mov, amount }) => (
              <div key={mov.id} className="flex items-baseline gap-3 border-b border-dashed py-2 last:border-0">
                <span className="min-w-0 flex-1 truncate">
                  Versement du {mov.date.slice(0, 5)} · {PAYMENT_LABELS[mov.paymentMethod || 'especes']}
                  {amount < mov.amount && <span className="text-xs text-muted-foreground"> (en partie)</span>}
                </span>
                <span className="shrink-0 tabular-nums text-debt">− {formatFCFA(amount)}</span>
              </div>
            ))}
            {row.movedParts.map(({ mov, amount, to }) => (
              // Mois arrêté ou annulé : le versement reste visible ici, barré, avec ce qu'il est devenu
              <div key={`m-${mov.id}`} className="flex flex-col border-b border-dashed py-2 last:border-0">
                <div className="flex items-baseline gap-3 text-muted-foreground">
                  <span className="min-w-0 flex-1 truncate line-through">
                    Versement du {mov.date.slice(0, 5)} · {PAYMENT_LABELS[mov.paymentMethod || 'especes']}
                  </span>
                  <span className="shrink-0 tabular-nums line-through">− {formatFCFA(amount)}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{to === 'avance' ? 'Passé en avance à rendre' : 'Rendu par l’employé'}</p>
              </div>
            ))}
            {row.cancelledParts.map(({ mov, amount }) => (
              // Versement annulé : il reste visible ici, barré, et ne compte plus
              <div key={`x-${mov.id}`} className="flex flex-col border-b border-dashed py-2 last:border-0">
                <div className="flex items-baseline gap-3 text-muted-foreground">
                  <span className="min-w-0 flex-1 truncate line-through">Versement du {mov.date.slice(0, 5)}</span>
                  <span className="shrink-0 tabular-nums line-through">− {formatFCFA(amount)}</span>
                </div>
                {mov.cancellationReason && <p className="mt-0.5 text-xs text-muted-foreground">Annulé : {mov.cancellationReason}</p>}
              </div>
            ))}
            {lines.every(m => m.type !== 'retenue_salaire' && m.type !== 'retenue_manuelle') && row.paymentParts.length === 0 && row.cancelledParts.length === 0 && row.movedParts.length === 0 && (
              <p className="py-2 text-xs text-muted-foreground">Rien pour l'instant.</p>
            )}
          </Group>
        </div>

        {/* Fiche de paie du mois (pas pour un mois annulé) */}
        {row.state !== 'annule' && (
          <Button variant="outline" className="h-11" onClick={() => setSlip(true)}>
            <FileText /> Fiche de paie
          </Button>
        )}

        {!isOpen && row.state !== 'annule' && (
          <p className="flex items-center gap-2 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
            <Lock className="size-3.5 shrink-0" /> {row.state === 'arrete' ? 'Mois arrêté' : 'Mois scellé'} : on peut seulement le payer.
          </p>
        )}

        {/* Actions du mois en cours : chacune ouvre sa propre fenêtre */}
        {isOpen && (
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
        )}
        </div>
      </DialogContent>

      {/* Arrêter ou annuler le mois : une fenêtre à part ; la question du trop reçu s'y affiche à la place du formulaire */}
      <Dialog
        open={panel !== 'none'}
        onOpenChange={o => {
          if (!o) {
            setPanel('none')
            setAskSurplus(null)
          }
        }}
      >
        <DialogContent>
          <div className="flex flex-col gap-4">
            <DialogHeader className="gap-1 p-0">
              <DialogTitle className="text-left">{panel === 'annuler' ? 'Annuler le mois' : 'Arrêter le mois'}</DialogTitle>
              <DialogDescription className="text-left">
                {emp.name} · {ofMonth(period)}
              </DialogDescription>
            </DialogHeader>

            {askSurplus ? (
              <div className="flex flex-col gap-3">
                <div className="rounded-xl bg-destructive/10 p-3">
                  <p className="text-sm font-semibold">Il a déjà reçu {formatFCFA(askSurplus.amount)} de trop</p>
                  <p className="text-xs text-muted-foreground">Après ce changement, ses versements dépassent ce qui lui est dû.</p>
                </div>
                <Button size="lg" className="h-12" onClick={() => askSurplus.apply('avance')}>
                  Ça devient une avance à rendre
                </Button>
                <Button variant="outline" size="lg" className="h-12" onClick={() => askSurplus.apply('rendu')}>
                  Il l'a déjà rendu
                </Button>
                <Button variant="ghost" onClick={() => setAskSurplus(null)}>
                  Revenir
                </Button>
              </div>
            ) : panel === 'arreter' ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">Combien doit-il toucher pour ce mois ?</p>
                {/* Trois choix, chacun dit ce qu'il fait ; le champ utile s'ouvre sous le choix */}
                <div className="flex flex-col gap-2" role="radiogroup" aria-label="Montant du mois">
                  {([
                    { v: 'complet', title: 'Montant complet', hint: `Tout son salaire : ${formatFCFA(salary)}` },
                    { v: 'prorata', title: 'Selon les jours travaillés', hint: 'Le salaire est partagé selon les jours' },
                    { v: 'fixe', title: 'Montant convenu', hint: 'Vous tapez le montant décidé ensemble' },
                  ] as const).map(o => {
                    const on = basis === o.v
                    return (
                      <div key={o.v} className={cn('rounded-xl border transition-colors', on && 'border-primary bg-muted/40')}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => setBasis(o.v)}
                          className="flex w-full items-center gap-3 p-3 text-left"
                        >
                          <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-primary' : 'border-muted-foreground/40')}>
                            {on && <span className="size-2.5 rounded-full bg-primary" />}
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="text-sm font-medium">{o.title}</span>
                            <span className="text-xs text-muted-foreground">{o.hint}</span>
                          </span>
                        </button>
                        {on && o.v === 'prorata' && (
                          <label className="flex items-center gap-2 px-3 pb-3 pl-11 text-sm">
                            Il a travaillé
                            <Input
                              autoFocus
                              inputMode="numeric"
                              aria-label="Jours travaillés"
                              value={daysStr}
                              onFocus={e => e.currentTarget.select()}
                              onChange={e => setDaysStr(digits(e.target.value).slice(0, 2))}
                              className="h-10 w-16 text-center"
                            />
                            jours sur {dim}
                          </label>
                        )}
                        {on && o.v === 'fixe' && (
                          <div className="px-3 pb-3 pl-11">
                            <Input
                              autoFocus
                              inputMode="numeric"
                              placeholder="Montant"
                              aria-label="Montant convenu"
                              value={thousands(fixedStr)}
                              onChange={e => setFixedStr(digits(e.target.value))}
                              className="h-10"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-baseline justify-between rounded-xl bg-muted/50 p-3 text-sm">
                  <span className="text-muted-foreground">Il touchera pour ce mois</span>
                  <span className="text-base font-semibold tabular-nums">{formatFCFA(newBase)}</span>
                </div>
                <Button size="lg" className="h-12" disabled={basis !== 'complet' && newBase <= 0} onClick={doStop}>
                  Arrêter le mois
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">Base, ajouts et retenues du mois sont annulés et restent barrés. L'avance reste due.</p>
                <Input autoFocus placeholder="Motif obligatoire" value={reason} onChange={e => setReason(e.target.value)} className="h-11" />
                <Button variant="destructive" size="lg" className="h-12" disabled={!reason.trim()} onClick={doCancel}>
                  Annuler le mois
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modifier une ligne : une petite fenêtre isolée, par-dessus la fiche du mois */}
      <Dialog open={!!cancelling} onOpenChange={o => !o && setCancelling(null)}>
        <DialogContent>
          {editing && (
            <div className="flex flex-col gap-4">
              <DialogHeader className="gap-1 p-0">
                <DialogTitle className="text-left">{editing.type === 'retenue_salaire' ? "Retenue pour l'avance" : editing.label}</DialogTitle>
                <DialogDescription className="text-left">
                  {editing.type === 'retenue_salaire' ? `Ce mois-ci · il doit encore ${formatFCFA(maxRetenue)}` : `${formatFCFA(editing.amount)} · ${ofMonth(period)}`}
                </DialogDescription>
              </DialogHeader>

              {editing.type === 'retenue_salaire' ? (
                <form
                  className="flex flex-col gap-3"
                  onSubmit={e => {
                    e.preventDefault()
                    if (retAmount <= 0 || retAmount > maxRetenue) return
                    setMonthRetenue(empId, retAmount)
                    setCancelling(null)
                  }}
                >
                  <Input
                    autoFocus
                    inputMode="numeric"
                    aria-label="Montant de la retenue ce mois-ci"
                    value={thousands(retStr)}
                    onFocus={e => e.currentTarget.select()}
                    onChange={e => setRetStr(digits(e.target.value))}
                    className={cn('h-12 text-right text-lg', retAmount > maxRetenue && 'border-destructive')}
                  />
                  {retAmount > maxRetenue && <p className="text-xs text-destructive">Pas plus de {formatFCFA(maxRetenue)} : c'est ce qu'il doit encore.</p>}
                  <Button type="submit" size="lg" className="h-12" disabled={retAmount <= 0 || retAmount > maxRetenue || (retAmount === editing.amount && !editing.isCancelled)}>
                    Enregistrer
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      setMonthRetenue(empId, 0)
                      setCancelling(null)
                    }}
                  >
                    Pas de retenue ce mois-ci
                  </Button>
                </form>
              ) : (
                <div className="flex flex-col gap-3">
                  <Input autoFocus placeholder="Motif de l'annulation" value={lineReason} onChange={e => setLineReason(e.target.value)} className="h-11" />
                  <Button
                    variant="destructive"
                    size="lg"
                    className="h-12"
                    disabled={!lineReason.trim()}
                    onClick={() => {
                      cancelMovement(editing.id, lineReason.trim())
                      setCancelling(null)
                      setLineReason('')
                    }}
                  >
                    Annuler cette ligne
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <PayslipDialog empId={empId} period={period} open={slip} onOpenChange={setSlip} />
    </Dialog>
  )
}

const order = (m: Movement) =>
  ({ salaire_du: 0, ajout_salaire: 1, retenue_salaire: 2, retenue_manuelle: 3 } as Record<string, number>)[m.type] ?? 9

// Une ligne : titre, total et un œil. L'œil ouvre le détail dans sa propre fenêtre.
function Group({
  title,
  subtitle,
  total,
  minus,
  children,
}: {
  title: string
  subtitle: string
  total: number
  minus?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const amount = (
    <span className={cn('font-semibold tabular-nums', minus && total > 0 && 'text-debt')}>
      {minus && total > 0 ? '− ' : ''}
      {formatFCFA(total)}
    </span>
  )
  return (
    <>
      <div className="flex items-center gap-2 py-1.5 pr-1.5 pl-3">
        <span className="flex-1 font-medium">{title}</span>
        {amount}
        <Button variant="ghost" size="icon" className="size-9 text-muted-foreground" aria-label={`Voir le détail : ${title}`} onClick={() => setOpen(true)}>
          <Eye />
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <div className="flex flex-col gap-4">
            <DialogHeader className="gap-1 p-0">
              <DialogTitle className="text-left">{title}</DialogTitle>
              <DialogDescription className="text-left">{subtitle}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col rounded-xl border px-3 py-1 text-sm">{children}</div>
            <div className="flex items-baseline justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2.5 text-sm">
              <span className="font-medium">Total</span>
              {amount}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
