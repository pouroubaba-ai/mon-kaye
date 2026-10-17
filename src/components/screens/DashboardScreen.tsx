import React from 'react'
import { Label, Pie, PieChart, Sector, type PieSectorDataItem } from 'recharts'
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

type Slice = { key: string; label: string; value: number; color: string; count: number; unit: [string, string] }

// Anneau « percutant » : anneau fin et large, fond complet discret, parts arrondies et séparées,
// léger dégradé et halo de la couleur du compte, part survolée qui grossit,
// légende avec une barre de proportion sous chaque ligne.
function DonutCard({
  title,
  slices,
  people,
  tone,
  delay = 0,
}: {
  title: string
  slices: Slice[]
  people: number
  tone: 'credit' | 'debt'
  delay?: number
}) {
  const total = slices.reduce((a, s) => a + s.value, 0)
  const shown = slices.filter(s => s.value > 0)
  const config = Object.fromEntries(slices.map(s => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig
  const uid = React.useId().replace(/:/g, '')
  const data = shown.map(s => ({ key: s.key, value: s.value, fill: `url(#${uid}-${s.key})` }))
  const base = tone === 'credit' ? 'var(--color-credit)' : 'var(--color-debt)'

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ChartContainer
          config={config}
          className="mx-auto aspect-square h-[220px]"
          style={{ filter: `drop-shadow(0 0 18px color-mix(in oklch, ${base} 28%, transparent))` }}
        >
          <PieChart>
            <defs>
              {shown.map(s => (
                <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" style={{ stopColor: `color-mix(in oklch, ${s.color} 100%, white 18%)` }} />
                  <stop offset="100%" style={{ stopColor: s.color }} />
                </linearGradient>
              ))}
            </defs>
            <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={formatFCFA} />} />
            {/* Fond : l'anneau complet, très discret */}
            <Pie
              data={[{ key: 'fond', value: 1 }]}
              dataKey="value"
              innerRadius={72}
              outerRadius={96}
              fill="var(--muted)"
              stroke="none"
              isAnimationActive={false}
              tooltipType="none"
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="key"
              innerRadius={72}
              outerRadius={96}
              startAngle={90}
              endAngle={-270}
              paddingAngle={data.length > 1 ? 4 : 0}
              cornerRadius={data.length > 1 ? 10 : 0}
              stroke="none"
              activeShape={(props: PieSectorDataItem) => <Sector {...props} outerRadius={(props.outerRadius ?? 96) + 6} />}
              isAnimationActive
              animationBegin={delay + 150}
              animationDuration={1000}
              animationEasing="ease-out"
            >
              <Label
                content={({ viewBox }) =>
                  viewBox && 'cx' in viewBox && 'cy' in viewBox ? (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 4} className="fill-foreground text-4xl font-semibold">
                        {people}
                      </tspan>
                      <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 22} className="fill-muted-foreground text-xs">
                        {people > 1 ? 'personnes' : 'personne'}
                      </tspan>
                    </text>
                  ) : null
                }
              />
            </Pie>
          </PieChart>
        </ChartContainer>

        <div className="flex flex-col gap-4">
          {total === 0 && <p className="text-center text-sm text-muted-foreground">Rien pour l'instant.</p>}
          {shown.map(s => {
            const pct = total > 0 ? Math.round((s.value / total) * 100) : 0
            return (
              <div key={s.key} className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="size-2.5 shrink-0 translate-y-px rounded-full" style={{ background: s.color }} />
                  <span className="flex-1 text-muted-foreground">{s.label}</span>
                  <span className="font-medium tabular-nums">{formatFCFA(s.value)}</span>
                </div>
                <div className="flex items-center gap-2 pl-[18px]">
                  <span className="w-20 shrink-0 text-xs text-muted-foreground/70">
                    {s.count} {s.count > 1 ? s.unit[1] : s.unit[0]}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full transition-[width] duration-1000" style={{ width: `${pct}%`, background: s.color }} />
                  </div>
                  <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{pct} %</span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export const DashboardScreen: React.FC = () => {
  const { totals, persons, setActiveTab } = useStore()

  const partners = persons.filter(p => p.type === 'partner')
  const employees = persons.filter(p => p.type === 'employee')
  const PEOPLE: [string, string] = ['personne', 'personnes']
  const STAFF: [string, string] = ['employé', 'employés']
  const nOwesMe = partners.filter(p => (p.owesMe || 0) > 0).length
  const nAdvances = employees.filter(p => (p.advanceBalance || 0) > 0).length
  const nIOwe = partners.filter(p => (p.iOweHim || 0) > 0).length
  const nSalaries = employees.filter(p => (p.currentSalaryDue || 0) > 0).length
  const owesMePeople = nOwesMe + nAdvances
  const iOwePeople = nIOwe + nSalaries


  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <StatCard label="On me doit" value={totals.totalOwesMe} tone="credit" Icon={ArrowDownLeft} onClick={() => setActiveTab('personnes')} />
        <StatCard label="Je dois" value={totals.totalIOwe} tone="debt" Icon={ArrowUpRight} onClick={() => setActiveTab('personnes')} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DonutCard
          title="Qui me doit"
          tone="credit"
          delay={0}
          people={owesMePeople}
          slices={[
            { key: 'partenaires', label: 'Personnes', value: totals.partnersOwesMe, color: 'var(--color-credit)', count: nOwesMe, unit: PEOPLE },
            { key: 'avances', label: 'Avances', value: totals.employeesAdvanceOwed, color: 'color-mix(in oklch, var(--color-credit) 45%, transparent)', count: nAdvances, unit: STAFF },
          ]}
        />
        <DonutCard
          title="À qui je dois"
          tone="debt"
          delay={100}
          people={iOwePeople}
          slices={[
            { key: 'partenaires', label: 'Personnes', value: totals.partnersIOwe, color: 'var(--color-debt)', count: nIOwe, unit: PEOPLE },
            { key: 'salaires', label: 'Salaires', value: totals.employeesSalaryDue, color: 'color-mix(in oklch, var(--color-debt) 45%, transparent)', count: nSalaries, unit: STAFF },
          ]}
        />
      </div>
    </div>
  )
}
