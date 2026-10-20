import React from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { useStore } from '@/data/store'
import { daysSince } from '@/data/payHistory'
import { payHistoryFromMovements, payrollOf } from '@/data/payroll'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useIsMobile } from '@/hooks/use-mobile'
import { DaysCard, PersonPicker, countLabel, type DayRow } from '@/components/overview-parts'
import { formatFCFA } from '@/lib/utils'

// Vue d'ensemble des employés.
// En haut : choix d'un employé (liste avec recherche, modèle shadcn « Combobox ») ;
// « Tous les employés » par défaut. Le choix s'applique aux trois cartes.
// 1. Salaires : barres empilées (gris = versé, orange = reste dû), par mois ou par année.
// 2. Avances : jours depuis le dernier remboursement + montant que l'employé doit encore.
// 3. Salaires en retard : jours depuis le dernier salaire versé + montant que je dois encore.
// Listes longues : au-delà de 7 employés, on montre les 5 premiers et un bouton « Voir plus ».

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

const payConfig = {
  paid: { label: 'Versé', color: 'color-mix(in oklch, var(--foreground) 35%, transparent)' },
  unpaid: { label: 'Reste dû', color: 'var(--color-debt)' },
} satisfies ChartConfig

const short = (v: number) => (v >= 1_000_000 ? `${Math.round(v / 100_000) / 10} M` : v >= 1000 ? `${Math.round(v / 1000)} k` : String(v))

// side = « leurs » : avances à rendre ; « mes » : salaires (graphique + salaires dus).
export const EmployeesOverview: React.FC<{ side: 'leurs' | 'mes' }> = ({ side }) => {
  const { persons, movements, monthStates } = useStore()
  // Historique calculé à partir des opérations (les mêmes chiffres que la fiche de chaque employé)
  const buildPayHistory = (list: typeof persons) => payHistoryFromMovements(list, movements, monthStates)
  const isMobile = useIsMobile()
  const employees = persons.filter(p => p.type === 'employee')
  const [who, setWho] = React.useState('tous')
  const selected = who === 'tous' ? employees : employees.filter(e => e.id === who)

  const history = buildPayHistory(selected)
  const years = [...new Set(history.map(h => h.year))]
  const [period, setPeriod] = React.useState<string>(String(new Date().getFullYear()))
  const activePeriod = period === 'tout' || years.includes(Number(period)) ? period : String(years[years.length - 1] ?? '')

  const payData =
    activePeriod === 'tout'
      ? years.map(y => {
          const rows = history.filter(h => h.year === y)
          const due = rows.reduce((a, r) => a + r.due, 0)
          const paid = rows.reduce((a, r) => a + r.paid, 0)
          return { label: String(y), paid, unpaid: due - paid }
        })
      : MONTHS.map((name, i) => {
          const r = history.find(h => h.year === Number(activePeriod) && h.month === i)
          return { label: name, paid: r?.paid ?? 0, unpaid: r ? r.due - r.paid : 0 }
        })

  // Nombre d'employés concernés par chaque total de la période choisie.
  const inPeriod = (y: number) => activePeriod === 'tout' || y === Number(activePeriod)
  const perEmployee = selected.map(e => buildPayHistory([e]).filter(r => inPeriod(r.year)))
  const countTotal = perEmployee.filter(rows => rows.some(r => r.due > 0)).length
  const countUnpaid = perEmployee.filter(rows => rows.some(r => r.due - r.paid > 0)).length
  const showCount = who === 'tous'

  const total = payData.reduce((a, d) => a + d.paid + d.unpaid, 0)
  const totalUnpaid = payData.reduce((a, d) => a + d.unpaid, 0)

  const advanceRows: DayRow[] = selected
    .filter(p => (p.advanceBalance || 0) > 0)
    .map(p => ({ id: p.id, name: p.name, days: daysSince(p.lastAdvanceRepaymentDate) ?? 0, amount: p.advanceBalance || 0, role: p.role,
      paid: payrollOf(p.id, movements, monthStates).advances.filter(a => a.etat === 'En cours').reduce((a, r) => a + r.rendu, 0) }))
    .sort((a, b) => b.days - a.days)

  const salaryRows: DayRow[] = selected
    .filter(p => p.status === 'actif' && (p.currentSalaryDue || 0) > 0)
    .map(p => ({ id: p.id, name: p.name, days: daysSince(p.lastSalaryPaymentDate) ?? 0, amount: p.currentSalaryDue || 0, role: p.role,
      paid: payrollOf(p.id, movements, monthStates).months.filter(m => m.reste > 0 && m.state !== 'en_cours').reduce((a, m) => a + m.verse, 0) }))
    .sort((a, b) => b.days - a.days)

  return (
    <div className="flex flex-col gap-4">
      <PersonPicker people={employees} value={who} onChange={setWho} allLabel="Tous les employés" searchPlaceholder="Nom ou numéro" emptyText="Aucun employé trouvé." />

      {side === 'mes' && <Card>
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">Salaires</CardTitle>
          <CardAction>
            <Select value={activePeriod} onValueChange={setPeriod}>
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
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="text-lg font-semibold tabular-nums">{formatFCFA(total)}</span>
              {showCount && <span className="text-xs text-muted-foreground">{countLabel(countTotal)}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2.5 rounded-full bg-debt" /> Reste dû
              </span>
              <span className="text-lg font-semibold tabular-nums text-debt">{formatFCFA(totalUnpaid)}</span>
              {showCount && <span className="text-xs text-muted-foreground">{countLabel(countUnpaid)}</span>}
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
                tickFormatter={(v: string) => (isMobile && activePeriod !== 'tout' ? v.charAt(0) : v)}
              />
              <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={short} fontSize={11} />
              <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.4 }} content={<ChartTooltipContent formatter={formatFCFA} />} />
              <Bar dataKey="paid" stackId="s" fill="var(--color-paid)" radius={[0, 0, 4, 4]} />
              <Bar dataKey="unpaid" stackId="s" fill="var(--color-unpaid)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>}

      {side === 'leurs' && <DaysCard
        title="Avances à rendre"
        totalLabel="On me doit"
        showCount={who === 'tous'}
        rows={advanceRows}
        tone="credit"
        amountLabel="Avance à rendre"
        empty="Aucune avance en cours."
      />}
      {side === 'mes' && <DaysCard
        title="Salaires dus"
        totalLabel="Je dois"
        showCount={who === 'tous'}
        rows={salaryRows}
        tone="debt"
        amountLabel="Salaire que je dois"
        empty="Aucun salaire en retard."
      />}
    </div>
  )
}
