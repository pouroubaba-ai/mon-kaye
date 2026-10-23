import React from 'react'
import { ArrowLeftRight, Banknote, ChevronLeft, ChevronUp, Eye, EyeOff, FileText, MoreVertical, Plus, Undo2 } from 'lucide-react'
import { DetailBand } from '@/components/detail-band'

import { useStore, returnedOn } from '@/data/store'
import type { Movement } from '@/data/mockData'
import { StatementDialog } from '@/components/modals/StatementDialog'
import { DateFilter } from '@/components/date-filter'
import { PersonMenu } from '@/components/person-menu'
import { PAYMENT_LABELS } from '@/components/movement-history'
import { ALL_TIME, inRange, isFiltered, opTime, type DateRange } from '@/lib/date-range'
import { daysSince } from '@/data/payHistory'
import { cn } from '@/lib/utils'
import { ago, amt, balanceOf, CREDIT_OF, il, initials, lastPayDate, PAY_OF, paidOn, RETURN_OF, sideOf, usedSides, type Side } from '@/modules/personnes/view'

// ——— Fiche d'un client ou d'un fournisseur (« Kayé simple ») ———
// - un seul côté : une grande carte « Il me doit » (ou « Je lui dois ») ; la toucher montre pris / versé ;
// - les deux côtés : deux cartes, on touche celle qu'on veut voir ; une petite ligne propose de compenser ;
// - personne neuve : « Rien d'enregistré pour l'instant » et les deux boutons Crédit / Dette.
// En bas, deux gros boutons, ceux du côté choisi.

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
export function dayLabel(d: string) {
  const n = daysSince(d)
  if (n === 0) return "Aujourd'hui"
  if (n === 1) return 'Hier'
  const [dd, mm, yy] = d.split('/').map(Number)
  return `${dd} ${MONTHS[mm - 1]}${yy !== new Date().getFullYear() ? ` ${yy}` : ''}`
}

export const PartnerDetailScreen: React.FC<{ partnerId: string }> = ({ partnerId }) => {
  const { persons, movements, openNewMovement, openCompensation, openMovementDetail, setSelectedPersonId } = useStore()
  const partner = persons.find(p => p.id === partnerId)
  const sides = partner ? usedSides(partner, movements) : []
  const [chosen, setChosen] = React.useState<Side | null>(null)
  const [detail, setDetail] = React.useState(false)
  const [range, setRange] = React.useState<DateRange>(ALL_TIME)
  const [statement, setStatement] = React.useState(false)
  const [menu, setMenu] = React.useState(false)
  if (!partner) return null

  const side: Side = chosen && sides.includes(chosen) ? chosen : sides[0] ?? 'lui'
  const lui = side === 'lui'
  const Il = il(partner)
  const owes = partner.owesMe || 0
  const iOwe = partner.iOweHim || 0
  const net = owes - iOwe

  const mine = movements.filter(m => m.personId === partner.id)
  const lastPay = (s: Side) => lastPayDate(movements, partner, s)
  const payLine = (s: Side) => {
    const d = lastPay(s)
    return d ? `Dernier versement ${ago(d)}` : 'Jamais versé'
  }

  // L'historique du côté choisi (le plus récent en haut)
  const shown = mine
    .filter(m => sideOf(m) === side && inRange(m.date, range))
    .sort((a, b) => opTime(b.date) - opTime(a.date) || (b.id > a.id ? 1 : -1))

  const header = (
    <header className="flex items-center gap-2 px-3 pt-[calc(0.875rem+env(safe-area-inset-top))] pb-2">
      <button type="button" aria-label="Retour" onClick={() => setSelectedPersonId(null)} className="flex size-11 items-center justify-center rounded-full hover:bg-muted">
        <ChevronLeft className="size-6" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xl font-bold">{partner.name}</span>
        {partner.phone && <span className="truncate text-[13px] text-muted-foreground">{partner.phone}</span>}
      </div>
      <button type="button" aria-label="Plus d'options" onClick={() => setMenu(true)} className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
        <MoreVertical className="size-5" />
      </button>
    </header>
  )

  const menuEl = <PersonMenu person={partner} open={menu} onOpenChange={setMenu} />

  // ——— Personne neuve
  if (sides.length === 0)
    return (
      <div className="flex min-h-dvh flex-col">
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <span className="flex size-[72px] items-center justify-center rounded-full bg-muted text-2xl font-bold text-muted-foreground">{initials(partner.name)}</span>
          <span className="text-lg font-semibold">Rien d'enregistré pour l'instant</span>
          <span className="max-w-[260px] text-sm leading-relaxed text-muted-foreground">
            Note sa première opération : {Il.toLowerCase()} prend chez toi, ou tu prends chez {Il === 'Elle' ? 'elle' : 'lui'}.
          </span>
        </div>
        <Bottom>
          <button type="button" onClick={() => openNewMovement(partner.id, 'il_a_pris_credit')} className="flex h-[68px] flex-col items-center justify-center gap-0.5 rounded-2xl bg-kgreen-solid text-white active:scale-[0.98]">
            <span className="text-lg font-bold">+ Crédit</span>
            <span className="text-xs opacity-85">{Il.toLowerCase()} prend chez moi</span>
          </button>
          <button type="button" onClick={() => openNewMovement(partner.id, 'j_ai_pris_credit')} className="flex h-[68px] flex-col items-center justify-center gap-0.5 rounded-2xl bg-kred-solid text-white active:scale-[0.98]">
            <span className="text-lg font-bold">+ Dette</span>
            <span className="text-xs opacity-85">je prends chez {Il === 'Elle' ? 'elle' : 'lui'}</span>
          </button>
        </Bottom>
        {menuEl}
      </div>
    )

  const versé = paidOn(movements, partner.id, side)
  const reste = balanceOf(partner, side)
  const pris = reste + versé
  const pct = pris > 0 ? Math.round((versé / pris) * 100) : 0
  const color = lui ? 'text-kgreen' : 'text-kred'
  const nShown = shown.filter(m => !m.isCancelled).length

  return (
    <div className="flex min-h-dvh flex-col">
      {header}
      <div className="flex flex-1 flex-col gap-3 px-4 pt-2 pb-[calc(7rem+env(safe-area-inset-bottom))]">
        {sides.length === 2 ? (
          <>
            {/* Les deux côtés : deux cartes, celle qu'on regarde est allumée */}
            <div className="grid grid-cols-2 gap-2.5">
              {(['lui', 'moi'] as Side[]).map(s => {
                const on = s === side
                const g = s === 'lui'
                const d = lastPay(s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => (on ? setDetail(d => !d) : (setChosen(s), setDetail(false)))}
                    aria-pressed={on}
                    className={cn(
                      'flex flex-col gap-1 rounded-2xl p-3.5 text-left transition-all',
                      on
                        ? g
                          ? 'border-2 border-kgreen bg-gradient-to-br from-kgreen/20 to-card to-75%'
                          : 'border-2 border-kred bg-gradient-to-br from-kred/20 to-card to-75%'
                        : cn('border bg-card opacity-80', g ? 'border-kgreen/30' : 'border-kred/30')
                    )}
                  >
                    <span className="text-[13px] text-muted-foreground">{g ? `${Il} me doit` : 'Je lui dois'}</span>
                    <span className={cn('flex items-center gap-1.5 text-2xl font-bold tabular-nums', g ? 'text-kgreen' : 'text-kred')}>
                      {amt(balanceOf(partner, s))}
                      {on && (detail ? <EyeOff className="size-4 opacity-70" /> : <Eye className="size-4 opacity-70" />)}
                    </span>
                    <span className="text-xs text-muted-foreground">{d ? `versé ${ago(d)}` : 'jamais versé'}</span>
                  </button>
                )
              })}
            </div>
            {/* Toucher la carte choisie une deuxième fois : Total, Versé, Reste */}
            {detail && <DetailBand total={pris} paid={versé} rest={reste} tone={lui ? 'green' : 'red'} />}
            {/* Compenser : une ligne discrète, seulement quand chacun doit à l'autre */}
            {owes > 0 && iOwe > 0 && (
              <button type="button" onClick={() => openCompensation(partner.id)} className="flex min-h-9 flex-wrap items-center gap-1.5 self-start px-1 text-left text-[13px] text-muted-foreground">
                <ArrowLeftRight className="size-4" />
                {net === 0 ? (
                  <>Vous êtes quittes ·</>
                ) : net > 0 ? (
                  <>
                    Au total {Il.toLowerCase()} te doit <span className="font-semibold text-kgreen">{amt(net)}</span> ·
                  </>
                ) : (
                  <>
                    Au total tu lui dois <span className="font-semibold text-kred">{amt(-net)}</span> ·
                  </>
                )}
                <span className="font-semibold text-foreground underline underline-offset-[3px]">Compenser</span>
              </button>
            )}
          </>
        ) : (
          // Un seul côté : la grande carte ; la toucher montre pris / versé
          <button
            type="button"
            onClick={() => setDetail(d => !d)}
            aria-expanded={detail}
            className={cn('flex flex-col gap-1.5 rounded-[18px] border p-[18px] text-left', lui ? 'border-kgreen/30 bg-gradient-to-br from-kgreen/20 to-card to-70%' : 'border-kred/30 bg-gradient-to-br from-kred/20 to-card to-70%')}
          >
            <span className="flex w-full items-center justify-between text-sm text-muted-foreground">
              {lui ? `${Il} me doit` : 'Je lui dois'}
              <ChevronUp className={cn('size-[18px] transition-transform', !detail && 'rotate-180')} />
            </span>
            <span className={cn('text-[34px] leading-tight font-bold tracking-tight tabular-nums', color)}>
              {amt(reste)} <span className="text-base font-medium text-muted-foreground">FCFA</span>
            </span>
            {detail && (
              <span className="flex w-full flex-col gap-1.5 animate-in fade-in duration-200">
                <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-foreground/10">
                  <span className="bg-kblue" style={{ width: `${pct}%` }} />
                </span>
                <span className="mt-1 grid grid-cols-2 gap-2">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Total</span>
                    <span className="text-base font-bold tabular-nums">{amt(pris)}</span>
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Versé · {pct} %</span>
                    <span className="text-base font-bold text-kblue tabular-nums">{amt(versé)}</span>
                  </span>
                </span>
              </span>
            )}
            <span className="text-[13px] text-muted-foreground">{payLine(side)}</span>
          </button>
        )}

        {/* Historique du côté choisi ; filtre par période et fiche de compte */}
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold text-muted-foreground">
            {sides.length === 2 ? (lui ? `Ce qu'${Il === 'Elle' ? 'elle' : 'il'} me doit` : 'Ce que je lui dois') : 'Historique'}
          </span>
          <div className="flex items-center gap-1">
            {!isFiltered(range) && <DateFilter iconOnly value={range} onChange={setRange} align="end" />}
            <button type="button" onClick={() => setStatement(true)} className="flex h-9 items-center gap-1.5 rounded-[10px] border px-3 text-[13px] font-semibold text-muted-foreground hover:bg-muted">
              <FileText className="size-4" /> Fiche de compte
            </button>
          </div>
        </div>
        {isFiltered(range) && (
          <div className="flex items-center justify-between gap-2">
            <DateFilter value={range} onChange={setRange} />
            <span className="text-[13px] text-muted-foreground">
              {nShown} opération{nShown > 1 ? 's' : ''}
            </span>
          </div>
        )}

        <div className="flex flex-col">
          {shown.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{isFiltered(range) ? 'Rien sur cette période.' : 'Aucune opération.'}</p>}
          {shown.map((m, i) => (
            <Line key={m.id} m={m} side={side} returned={m.type === CREDIT_OF[side] ? returnedOn(movements, m.id) : 0} last={i === shown.length - 1} onOpen={() => openMovementDetail(m)} />
          ))}
        </div>
      </div>

      <Bottom>
        <button
          type="button"
          onClick={() => openNewMovement(partner.id, CREDIT_OF[side])}
          className={cn('flex h-[60px] items-center justify-center gap-2 rounded-2xl text-lg font-bold text-white active:scale-[0.98]', lui ? 'bg-kgreen-solid' : 'bg-kred-solid')}
        >
          <Plus className="size-[22px]" strokeWidth={2.6} />
          {lui ? 'Crédit' : 'Dette'}
        </button>
        <button
          type="button"
          onClick={() => openNewMovement(partner.id, PAY_OF[side])}
          className={cn('flex h-[60px] items-center justify-center gap-2 rounded-2xl border-2 text-lg font-bold active:scale-[0.98]', lui ? 'border-kgreen-solid text-kgreen' : 'border-kred-solid text-kred')}
        >
          <Banknote className="size-6" />
          Versement
        </button>
      </Bottom>

      <StatementDialog person={partner} open={statement} onOpenChange={setStatement} />
      {menuEl}
    </div>
  )
}

function Bottom({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-x-0 bottom-0 z-30 mx-auto grid w-full max-w-xl grid-cols-2 gap-3 border-t bg-background px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">{children}</div>
}

// Une ligne de l'historique : icône, ce que c'est, quand, et le montant
function Line({ m, side, returned, last, onOpen }: { m: Movement; side: Side; returned: number; last: boolean; onOpen: () => void }) {
  const isCredit = m.type === CREDIT_OF[side]
  const isReturn = m.type === RETURN_OF[side]
  const isComp = m.paymentMethod === 'compensation'
  const title = isComp ? 'Compensation' : isCredit ? (m.label?.startsWith('Trop versé') ? m.label : side === 'lui' ? 'Crédit' : 'Dette') : isReturn ? 'Retour' : m.label?.startsWith('Trop versé') ? m.label : 'Versement'
  const what = m.items?.length ? m.items.map(l => l.label).join(', ') : m.note || (m.paymentMethod && !isComp ? PAYMENT_LABELS[m.paymentMethod] : '')
  const Icon = isCredit ? Plus : isReturn ? Undo2 : isComp ? ArrowLeftRight : Banknote
  return (
    <button type="button" onClick={onOpen} className={cn('flex items-center gap-3 px-1 py-3 text-left', !last && 'border-b border-border', m.isCancelled && 'opacity-50')}>
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-[10px]',
          isCredit ? (side === 'lui' ? 'bg-kgreen/15 text-kgreen' : 'bg-kred/15 text-kred') : isReturn ? 'bg-muted text-muted-foreground' : 'bg-kblue/10 text-kblue'
        )}
      >
        <Icon className="size-[18px]" strokeWidth={isCredit ? 2.4 : 2} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 text-[15px] font-semibold">
          <span className={cn('truncate', m.isCancelled && 'line-through')}>{title}</span>
          {m.isCancelled && <span className="shrink-0 rounded-full bg-muted px-2 py-px text-[11px] font-semibold text-muted-foreground">Annulé</span>}
          {returned > 0 && !m.isCancelled && <span className="shrink-0 rounded-full bg-kred/15 px-2 py-px text-[11px] font-semibold text-kred">Retour {amt(returned)}</span>}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {dayLabel(m.date)}
          {what ? ` · ${what}` : ''}
        </span>
      </span>
      <span className={cn('shrink-0 text-[15px] font-bold tabular-nums', m.isCancelled && 'line-through', isCredit ? '' : isReturn ? 'text-muted-foreground' : 'text-kblue')}>
        {isCredit ? '+' : '−'} {amt(m.amount)}
      </span>
    </button>
  )
}
