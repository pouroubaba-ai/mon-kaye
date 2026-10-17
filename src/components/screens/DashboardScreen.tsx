import React from 'react'
import { Label, Pie, PieChart } from 'recharts'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'

import { useStore } from '@/data/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { cn, formatFCFA } from '@/lib/utils'

// Tableau de bord léger :
// 1. deux cartes côte à côte : « On me doit » / « Je dois » (le total, rien d'autre) ;
// 2. deux anneaux : de qui vient ce qu'on me doit, à qui va ce que je dois (le détail) ;
// Chaque montant n'apparaît qu'une fois.

const amount = (v: number) => formatFCFA(v).replace(/\s?FCFA$/, '')

function StatCard({
  label,
  value,
  tone,
  Icon,
  onClick,
}: {
  label: string
  value: number
  tone: 'credit' | 'debt'
  Icon: React.ComponentType<{ className?: string }>
  onClick: () => void
}) {
  return (
    <Card className="cursor-pointer gap-6 py-4 transition-colors hover:bg-muted/40" onClick={onClick}>
      <CardContent className="flex flex-col gap-6 px-4">
        <div className={cn('flex size-9 items-center justify-center rounded-lg bg-muted', tone === 'credit' ? 'text-credit' : 'text-debt')}>
          <Icon className="size-5" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-2xl font-semibold tabular-nums leading-none">
            {amount(value)} <span className="text-sm font-normal text-muted-foreground">FCFA</span>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

type Slice = { key: string; label: string; value: number; color: string }

function DonutCard({ title, slices, people, delay = 0 }: { title: string; slices: Slice[]; people: number; delay?: number }) {
  const total = slices.reduce((a, s) => a + s.value, 0)
  const config = Object.fromEntries(slices.map(s => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig
  const data = slices.filter(s => s.value > 0).map(s => ({ key: s.key, value: s.value, fill: `var(--color-${s.key})` }))

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ChartContainer config={config} className="mx-auto aspect-square h-[180px]">
          <PieChart>
            <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={formatFCFA} />} />
            <Pie data={data} dataKey="value" nameKey="key" innerRadius={58} outerRadius={84} strokeWidth={3} isAnimationActive animationBegin={delay + 150} animationDuration={900} animationEasing="ease-out">
              <Label
                content={({ viewBox }) =>
                  viewBox && 'cx' in viewBox && 'cy' in viewBox ? (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-semibold">
                        {people}
                      </tspan>
                      <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="fill-muted-foreground text-xs">
                        {people > 1 ? 'personnes' : 'personne'}
                      </tspan>
                    </text>
                  ) : null
                }
              />
            </Pie>
          </PieChart>
        </ChartContainer>

        <div className="flex flex-col gap-2.5">
          {total === 0 && <p className="text-center text-sm text-muted-foreground">Rien pour l'instant.</p>}
          {slices.filter(s => s.value > 0).map(s => (
            <div key={s.key} className="flex items-center gap-2 text-sm">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="flex-1 text-muted-foreground">{s.label}</span>
              <span className="font-medium tabular-nums">{formatFCFA(s.value)}</span>
              <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                {total > 0 ? Math.round((s.value / total) * 100) : 0} %
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export const DashboardScreen: React.FC = () => {
  const { totals, persons, setActiveTab } = useStore()

  const partners = persons.filter(p => p.type === 'partner')
  const employees = persons.filter(p => p.type === 'employee')
  const owesMePeople = partners.filter(p => (p.owesMe || 0) > 0).length + employees.filter(p => (p.advanceBalance || 0) > 0).length
  const iOwePeople = partners.filter(p => (p.iOweHim || 0) > 0).length + employees.filter(p => (p.currentSalaryDue || 0) > 0).length


  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <StatCard label="On me doit" value={totals.totalOwesMe} tone="credit" Icon={ArrowDownLeft} onClick={() => setActiveTab('personnes')} />
        <StatCard label="Je dois" value={totals.totalIOwe} tone="debt" Icon={ArrowUpRight} onClick={() => setActiveTab('personnes')} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DonutCard
          title="Qui me doit"
          delay={0}
          people={owesMePeople}
          slices={[
            { key: 'partenaires', label: 'Partenaires', value: totals.partnersOwesMe, color: 'var(--color-credit)' },
            { key: 'avances', label: 'Avances des employés', value: totals.employeesAdvanceOwed, color: 'color-mix(in oklch, var(--color-credit) 45%, var(--muted))' },
          ]}
        />
        <DonutCard
          title="À qui je dois"
          delay={100}
          people={iOwePeople}
          slices={[
            { key: 'partenaires', label: 'Partenaires', value: totals.partnersIOwe, color: 'var(--color-debt)' },
            { key: 'salaires', label: 'Salaires dus', value: totals.employeesSalaryDue, color: 'color-mix(in oklch, var(--color-debt) 45%, var(--muted))' },
          ]}
        />
      </div>
    </div>
  )
}
