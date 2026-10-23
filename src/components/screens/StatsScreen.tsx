import React from 'react'
import { ChevronRight } from 'lucide-react'

import { useStore } from '@/data/store'
import type { Movement } from '@/data/mockData'
import { SubHeader } from '@/components/layout/AppLayout'
import { DateFilter } from '@/components/date-filter'
import { inRange, opTime, rangeBounds, type DateRange } from '@/lib/date-range'
import { daysSince } from '@/data/payHistory'
import { cn } from '@/lib/utils'
import { amt, CREDIT_OF, lastPayDate, PAY_OF, type Side } from '@/modules/personnes/view'

// ——— Statistiques « Kayé simple » ———
// Pour la période choisie (ce mois par défaut) : ce que les clients ont pris à crédit et ce qu'ils ont versé,
// la même chose pour les fournisseurs, puis ceux qui tardent à payer. Employés : seulement si le module est allumé.

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const DAY = 86_400_000
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export const StatsScreen: React.FC = () => {
  const { movements, persons, modules, totals, lateDays, setSelectedPersonId, navigate } = useStore()
  const [range, setRange] = React.useState<DateRange>({ key: 'mois' })

  // Début et fin de la période (pour « Toute la période » : depuis la première opération)
  const partnerMoves = movements.filter(m => !m.isCancelled && persons.find(p => p.id === m.personId)?.type === 'partner')
  const b = rangeBounds(range)
  const first = partnerMoves.reduce((a, m) => Math.min(a, opTime(m.date)), Date.now())
  const start = b.start ?? midnight(new Date(first))
  const end = b.end ?? midnight(new Date())

  // Ceux qui tardent : un client qui doit et n'a rien versé depuis « lateDays » jours (ou jamais)
  const late = persons
    .filter(p => p.type === 'partner' && !p.archived && (p.owesMe || 0) > 0)
    .map(p => {
      const d = lastPayDate(movements, p, 'lui')
      return { p, days: d ? daysSince(d) : null }
    })
    .filter(x => x.days === null || x.days >= lateDays)
    .sort((a, b) => (b.days ?? 1e9) - (a.days ?? 1e9) || (b.p.owesMe || 0) - (a.p.owesMe || 0))

  return (
    <div className="flex min-h-dvh flex-col">
      <SubHeader title="Statistiques" right={<DateFilter value={range} onChange={setRange} align="end" />} />
      <div className="flex flex-col gap-4 px-4 pt-2 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {modules.personnes && (
          <>
            <Flow title="Clients" side="lui" moves={partnerMoves} range={range} start={start} end={end} />
            <Flow title="Fournisseurs" side="moi" moves={partnerMoves} range={range} start={start} end={end} />

            <section className="flex flex-col gap-1 rounded-[18px] border bg-card p-4">
              <span className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-[15px] font-semibold">Ceux qui tardent à payer</span>
                <span className="text-xs text-muted-foreground">plus de {lateDays} j</span>
              </span>
              {late.length === 0 && <p className="py-3 text-sm text-muted-foreground">Personne n'est en retard.</p>}
              {late.map((x, i) => (
                <button
                  key={x.p.id}
                  type="button"
                  onClick={() => setSelectedPersonId(x.p.id)}
                  className={cn('flex items-center gap-2.5 py-2.5 text-left', i < late.length - 1 && 'border-b border-border')}
                >
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{x.p.name}</span>
                  <span className={cn('shrink-0 text-[13px] font-semibold', x.days === null ? 'text-muted-foreground' : 'text-kgold')}>{x.days === null ? 'jamais' : `${x.days} j`}</span>
                  <span className="w-[84px] shrink-0 text-right text-[15px] font-bold text-kgreen tabular-nums">{amt(x.p.owesMe || 0)}</span>
                </button>
              ))}
            </section>
          </>
        )}

        {modules.employes && (
          <button type="button" onClick={() => navigate('salaires')} className="flex flex-col gap-3 rounded-[18px] border bg-card p-4 text-left">
            <span className="flex w-full items-center justify-between text-[15px] font-semibold">
              Employés <ChevronRight className="size-4 text-muted-foreground" />
            </span>
            <span className="grid w-full grid-cols-2 gap-2.5">
              <span className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Salaires à payer</span>
                <span className="text-[22px] font-bold text-kred tabular-nums">{amt(totals.employeesSalaryDue)}</span>
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Avances à rendre</span>
                <span className="text-[22px] font-bold text-kgreen tabular-nums">{amt(totals.employeesAdvanceOwed)}</span>
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

// Une carte : pris à crédit et versé sur la période, et la courbe des deux (cumulés jour après jour)
function Flow({ title, side, moves, range, start, end }: { title: string; side: Side; moves: Movement[]; range: DateRange; start: Date; end: Date }) {
  const credit = CREDIT_OF[side]
  const pay = PAY_OF[side]
  const inP = moves.filter(m => inRange(m.date, range))
  const pris = inP.filter(m => m.type === credit).reduce((a, m) => a + m.amount, 0)
  const versé = inP.filter(m => m.type === pay).reduce((a, m) => a + m.amount, 0)
  const lui = side === 'lui'

  // Cumul jour par jour
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY) + 1)
  const daily = (type: Movement['type']) => {
    const arr = new Array(days).fill(0)
    for (const m of inP) {
      if (m.type !== type) continue
      const i = Math.round((opTime(m.date) - start.getTime()) / DAY)
      if (i >= 0 && i < days) arr[i] += m.amount
    }
    let s = 0
    return arr.map(v => (s += v))
  }
  const a = daily(credit)
  const v = daily(pay)
  const max = Math.max(1, ...a, ...v)
  const W = 340
  const H = 100
  const pt = (arr: number[]) => arr.map((y, i) => [days === 1 ? W / 2 : (i / (days - 1)) * W, H - 6 - (y / max) * (H - 16)] as const)
  const line = (arr: number[]) => pt(arr).map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = (arr: number[]) => `${line(arr)} L${W} ${H} L0 ${H} Z`
  const ticks = [0, 1, 2, 3].map(k => {
    const d = new Date(start.getTime() + Math.round(((days - 1) * k) / 3) * DAY)
    return { x: (k / 3) * W, label: `${d.getDate()} ${MONTHS[d.getMonth()]}` }
  })
  const stroke = lui ? 'var(--k-green)' : 'var(--k-red)'

  return (
    <section className="flex flex-col gap-3 rounded-[18px] border bg-card p-4">
      <span className={cn('text-[15px] font-semibold', lui ? 'text-kgreen' : 'text-kred')}>{title}</span>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Pris à crédit</span>
          <span className="text-[22px] font-bold tabular-nums">{amt(pris)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Versé</span>
          <span className="text-[22px] font-bold text-kblue tabular-nums">{amt(versé)}</span>
        </div>
      </div>
      {pris + versé > 0 ? (
        <svg width="100%" viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label={`${title} : pris et versé jour après jour`} className="overflow-visible">
          <path d={area(a)} fill={stroke} fillOpacity={0.16} />
          <path d={line(a)} fill="none" stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" />
          <path d={area(v)} fill="var(--k-blue)" fillOpacity={0.14} />
          <path d={line(v)} fill="none" stroke="var(--k-blue)" strokeWidth={2.5} strokeLinejoin="round" />
          {ticks.map((t, i) => (
            <text key={i} x={t.x} y={H + 15} textAnchor={i === 0 ? 'start' : i === 3 ? 'end' : 'middle'} className="fill-muted-foreground" fontSize={11}>
              {t.label}
            </text>
          ))}
        </svg>
      ) : (
        <div style={{ aspectRatio: `${W} / ${H + 18}` }} className="flex items-center justify-center text-sm text-muted-foreground">
          Rien sur cette période.
        </div>
      )}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-full', lui ? 'bg-kgreen' : 'bg-kred')} />
          Pris
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-kblue" />
          Versé
        </span>
      </div>
    </section>
  )
}
