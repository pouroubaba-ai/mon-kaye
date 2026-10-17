import React from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'

import { useStore } from '@/data/store'
import { buildPayHistory, daysSince } from '@/data/payHistory'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatFCFA } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

// Vue d'ensemble des employés :
// 1. Salaires : barres empilées par mois (une année choisie) ou par année (« Tout ») :
//    la partie grise = ce qui a été versé, la partie orange = ce qui reste dû.
//    La hauteur totale = le salaire à payer sur la période.
// 2. Avances : barres horizontales, nombre de jours depuis le dernier remboursement,
//    l'employé qui n'a rien rendu depuis le plus longtemps en haut.

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

const payConfig = {
  paid: { label: 'Versé', color: 'color-mix(in oklch, var(--foreground) 35%, transparent)' },
  unpaid: { label: 'Reste dû', color: 'var(--color-debt)' },
} satisfies ChartConfig

const advanceConfig = {
  days: { label: 'Jours sans remboursement', color: 'var(--color-credit)' },
} satisfies ChartConfig

const short = (v: number) => (v >= 1_000_000 ? `${Math.round(v / 100_000) / 10} M` : v >= 1000 ? `${Math.round(v / 1000)} k` : String(v))

export const EmployeesOverview: React.FC = () => {
  const { persons } = useStore()
  const isMobile = useIsMobile()
  const history = React.useMemo(() => buildPayHistory(persons), [persons])
  const years = [...new Set(history.map(h => h.year))]
  const [period, setPeriod] = React.useState<string>(String(years[years.length - 1] ?? new Date().getFullYear()))

  const payData =
    period === 'tout'
      ? years.map(y => {
          const rows = history.filter(h => h.year === y)
          const due = rows.reduce((a, r) => a + r.due, 0)
          const paid = rows.reduce((a, r) => a + r.paid, 0)
          return { label: String(y), paid, unpaid: due - paid }
        })
      : MONTHS.map((name, i) => {
          const r = history.find(h => h.year === Number(period) && h.month === i)
          return { label: name, paid: r?.paid ?? 0, unpaid: r ? r.due - r.paid : 0 }
        })

  const totalPaid = payData.reduce((a, d) => a + d.paid, 0)
  const totalUnpaid = payData.reduce((a, d) => a + d.unpaid, 0)

  const advances = persons
    .filter(p => p.type === 'employee' && (p.advanceBalance || 0) > 0)
    .map(p => ({ name: p.name.split(' ')[0], full: p.name, days: daysSince(p.lastAdvanceRepaymentDate) ?? 0, amount: p.advanceBalance || 0 }))
    .sort((a, b) => b.days - a.days)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">Salaires</CardTitle>
          <CardAction>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger size="sm" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {[...years].reverse().map(y => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
                <SelectItem value="tout">Tout</SelectItem>
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2.5 rounded-full" style={{ background: payConfig.paid.color }} /> Versé
              </span>
              <span className="text-lg font-semibold tabular-nums">{formatFCFA(totalPaid)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2.5 rounded-full bg-debt" /> Reste dû
              </span>
              <span className="text-lg font-semibold tabular-nums text-debt">{formatFCFA(totalUnpaid)}</span>
            </div>
          </div>

          <ChartContainer config={payConfig} className="aspect-auto h-[220px] w-full">
            <BarChart data={payData} margin={{ left: 0, right: 0, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={0}
                fontSize={11}
                tickFormatter={(v: string) => (isMobile && period !== 'tout' ? v.charAt(0) : v)}
              />
              <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={short} fontSize={11} />
              <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.4 }} content={<ChartTooltipContent formatter={formatFCFA} />} />
              <Bar dataKey="paid" stackId="s" fill="var(--color-paid)" radius={[0, 0, 4, 4]} />
              <Bar dataKey="unpaid" stackId="s" fill="var(--color-unpaid)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">Avances : jours depuis le dernier remboursement</CardTitle>
        </CardHeader>
        <CardContent>
          {advances.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune avance en cours.</p>
          ) : (
            <ChartContainer config={advanceConfig} className="aspect-auto w-full" style={{ height: advances.length * 48 + 8 }}>
              <BarChart data={advances} layout="vertical" margin={{ left: 0, right: 48 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={72} fontSize={12} />
                <ChartTooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    const d = payload?.[0]?.payload as (typeof advances)[number] | undefined
                    if (!active || !d) return null
                    return (
                      <div className="grid gap-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
                        <span className="font-medium">{d.full}</span>
                        <span className="text-muted-foreground">Avance à rendre : {formatFCFA(d.amount)}</span>
                        <span className="text-muted-foreground">Dernier remboursement : il y a {d.days} jours</span>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="days" fill="var(--color-days)" radius={4} barSize={22}>
                  <LabelList dataKey="days" position="right" formatter={(v: unknown) => `${v} j`} className="fill-foreground" fontSize={12} />
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
