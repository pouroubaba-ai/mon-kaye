import * as React from 'react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'

import type { Movement } from '@/data/mockData'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { Segmented } from '@/components/segmented'
import { formatFCFA } from '@/lib/utils'
import { opTime, rangeBounds, type DateRange } from '@/lib/date-range'

// Graphique en aires (courbes lissées) des partenaires :
// « Ils prennent chez moi » ou « Je prends chez eux », avec trois courbes :
// ce qui est pris (crédits), les versements, et les retours (seulement s'il y en a).
// Il suit le filtre par date : par jour sur une courte période, par semaine, ou par mois.

const MONTHS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']
const DAY = 86_400_000
const amount = (v: number) => formatFCFA(v).replace(/\s?FCFA$/, '')
const dd = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

type Side = 'chez_moi' | 'chez_eux'
const TYPES: Record<Side, { credit: string; pay: string; ret: string }> = {
  chez_moi: { credit: 'il_a_pris_credit', pay: 'il_m_a_verse', ret: 'il_a_retourne' },
  chez_eux: { credit: 'j_ai_pris_credit', pay: 'je_lui_ai_verse', ret: 'j_ai_retourne' },
}

export function FlowChart({ movements, range }: { movements: Movement[]; range: DateRange }) {
  const [side, setSide] = React.useState<Side>('chez_moi')
  const t = TYPES[side]
  const live = movements.filter(m => !m.isCancelled && (m.type === t.credit || m.type === t.pay || m.type === t.ret))

  // Début et fin du graphique
  const today = new Date(new Date().toDateString())
  const b = rangeBounds(range)
  const end = b.end ?? today
  const first = live.length ? Math.min(...live.map(m => opTime(m.date))) : today.getTime() - 29 * DAY
  const start = b.start ?? new Date(Math.min(first, end.getTime() - 6 * DAY))
  const days = Math.round((end.getTime() - start.getTime()) / DAY) + 1
  const by: 'jour' | 'semaine' | 'mois' = days <= 31 ? 'jour' : days <= 120 ? 'semaine' : 'mois'

  // Les cases du graphique (jours, semaines ou mois)
  const buckets: { key: number; label: string }[] = []
  const keyOf = (time: number) => {
    const d = new Date(time)
    if (by === 'jour') return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    if (by === 'semaine') {
      const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
      return monday.getTime()
    }
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  }
  const years = start.getFullYear() !== end.getFullYear()
  for (let k = keyOf(start.getTime()); k <= end.getTime(); ) {
    const d = new Date(k)
    buckets.push({ key: k, label: by === 'mois' ? `${MONTHS[d.getMonth()]}${years ? ` ${String(d.getFullYear()).slice(2)}` : ''}` : dd(d) })
    k = by === 'jour' ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() : by === 'semaine' ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7).getTime() : new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
  }
  const rows = buckets.map(x => ({ label: x.label, credit: 0, verse: 0, retour: 0, key: x.key }))
  const index = new Map(rows.map((r, i) => [r.key, i]))
  let tc = 0
  let tv = 0
  let tr = 0
  for (const m of live) {
    const time = opTime(m.date)
    if (time < start.getTime() || time > end.getTime()) continue
    const i = index.get(keyOf(time))
    if (i === undefined) continue
    if (m.type === t.credit) (rows[i].credit += m.amount), (tc += m.amount)
    else if (m.type === t.pay) (rows[i].verse += m.amount), (tv += m.amount)
    else (rows[i].retour += m.amount), (tr += m.amount)
  }

  // Couleurs écrites en clair : le dessin du graphique (SVG) ne lit pas les variables CSS
  const main = side === 'chez_moi' ? '#16a34a' : '#ea580c'
  const series = [
    { key: 'credit', label: side === 'chez_moi' ? 'Crédits' : 'Dettes', color: main, total: tc },
    { key: 'verse', label: 'Versements', color: '#38bdf8', total: tv },
    ...(tr > 0 ? [{ key: 'retour', label: 'Retours', color: '#a78bfa', total: tr }] : []),
  ]
  const config = Object.fromEntries(series.map(s => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig
  const uid = React.useId().replace(/:/g, '')
  // Pas trop d'étiquettes sous le graphique
  const step = Math.max(1, Math.ceil(rows.length / 6))

  return (
    <Card>
      <CardHeader className="gap-3">
        <CardTitle className="text-sm font-normal text-muted-foreground">Ce qui est pris et versé{by !== 'jour' ? ` (par ${by})` : ''}</CardTitle>
        <Segmented
          options={[
            { value: 'chez_moi', label: 'Ils prennent chez moi' },
            { value: 'chez_eux', label: 'Je prends chez eux' },
          ]}
          value={side}
          onChange={setSide}
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Simple lecture : pas de toucher sur le graphique (sur iPhone, un graphique qui réagit au toucher gêne les onglets du bas) */}
        <ChartContainer config={config} className="pointer-events-none aspect-auto h-[200px] w-full">
          <AreaChart data={rows} margin={{ left: 16, right: 16, top: 8 }}>
            <defs>
              {series.map(s => (
                <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={s.color} stopOpacity={0.45} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0.03} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.4} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
              tick={({ x, y, payload, index }) =>
                index === rows.length - 1 || (index % step === 0 && rows.length - 1 - index >= step * 0.7) ? (
                  <text x={x} y={Number(y) + 10} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                    {payload.value}
                  </text>
                ) : (
                  <g />
                )
              }
            />
            {series.map(s => (
              <Area
                key={s.key}
                dataKey={s.key}
                type="monotone"
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#${uid}-${s.key})`}
                isAnimationActive
                animationDuration={800}
              />
            ))}
          </AreaChart>
        </ChartContainer>
        {/* Les totaux de la période, sous le graphique */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {series.map(s => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: s.color }} />
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-semibold tabular-nums">{amount(s.total)}</span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
