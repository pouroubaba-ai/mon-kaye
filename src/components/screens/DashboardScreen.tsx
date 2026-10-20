import React from 'react'
import { Label, Pie, PieChart, Sector, type PieSectorDataItem } from 'recharts'
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react'

import { useStore } from '@/data/store'
import { payrollOf } from '@/data/payroll'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { formatFCFA } from '@/lib/utils'

// Tableau de bord léger :
// 1. deux cartes côte à côte : « On me doit » / « Je dois », avec en petit le total et le versé
//    (des comptes pas encore finis : total − versé = le grand montant) ;
// 2. deux anneaux : de qui vient ce qu'on me doit, à qui va ce que je dois (le détail) ;
// Chaque montant n'apparaît qu'une fois.

const amount = (v: number) => formatFCFA(v).replace(/\s?FCFA$/, '')

function StatCard({
  label,
  value,
  paid,
  tone,
  Icon,
  onClick,
}: {
  label: string
  value: number
  paid: number
  tone: 'credit' | 'debt'
  Icon: React.ComponentType<{ className?: string }>
  onClick: () => void
}) {
  const base = tone === 'credit' ? 'var(--color-credit)' : 'var(--color-debt)'
  // Carte « vivante » : fond en dégradé de la couleur du compte, bordure teintée,
  // pastille d'icône pleine et halo lumineux dans le coin.
  return (
    // Toucher la carte ouvre la liste des comptes : on voit le total, puis tout de suite « qui ».
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick()}
      className="relative cursor-pointer gap-6 overflow-hidden py-4 transition-transform active:scale-[0.98]"
      style={{
        background: `linear-gradient(145deg, color-mix(in srgb, ${base} 22%, var(--card)) 0%, var(--card) 70%)`,
        borderColor: `color-mix(in srgb, ${base} 35%, transparent)`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full blur-2xl"
        style={{ background: `color-mix(in srgb, ${base} 40%, transparent)` }}
      />
      <CardContent className="relative flex flex-col gap-6 px-4">
        <ChevronRight className="absolute top-0 right-3 size-5 text-muted-foreground" />
        <div
          className="flex size-10 items-center justify-center rounded-xl text-white"
          style={{ background: base, boxShadow: `0 6px 18px -4px color-mix(in srgb, ${base} 60%, transparent)` }}
        >
          <Icon className="size-5" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="whitespace-nowrap text-xl font-semibold tabular-nums leading-none sm:text-2xl">
            {amount(value)} <span className="text-xs font-normal text-muted-foreground sm:text-sm">FCFA</span>
          </span>
          {value > 0 && (
            <span className="mt-1 flex flex-col text-xs leading-snug text-muted-foreground tabular-nums">
              <span>Total {amount(value + paid)}</span>
              <span>Versé {amount(paid)}</span>
            </span>
          )}
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
  onOpen,
  unit = ['personne', 'personnes'],
}: {
  title: string
  slices: Slice[]
  people: number
  tone: 'credit' | 'debt'
  delay?: number
  onOpen: (group: 'partner' | 'employee') => void
  unit?: [string, string]
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
                        {people > 1 ? unit[1] : unit[0]}
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
              // Toucher une ligne ouvre directement ce côté (Personnes ou Employés).
              <button
                type="button"
                key={s.key}
                onClick={() => onOpen(s.key === 'partenaires' ? 'partner' : 'employee')}
                className="-mx-2 flex flex-col gap-1.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-muted/50"
              >
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
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export const DashboardScreen: React.FC = () => {
  const { totals, persons, movements, monthStates, setAccountsView, modules } = useStore()

  const partners = persons.filter(p => p.type === 'partner')
  const employees = persons.filter(p => p.type === 'employee')
  const PEOPLE: [string, string] = ['personne', 'personnes']
  const STAFF: [string, string] = ['employé', 'employés']
  // Un module coupé n'apparaît pas (ses données restent)
  const nOwesMe = modules.personnes ? partners.filter(p => (p.owesMe || 0) > 0).length : 0
  const nAdvances = modules.employes ? employees.filter(p => (p.advanceBalance || 0) > 0).length : 0
  const nIOwe = modules.personnes ? partners.filter(p => (p.iOweHim || 0) > 0).length : 0
  const nSalaries = modules.employes ? employees.filter(p => (p.currentSalaryDue || 0) > 0).length : 0
  const firstGroup = modules.personnes ? 'partner' : 'employee'
  // Seul, le côté Employés prend la couleur pleine (sa couleur pâle ne sert qu'à le distinguer de Personnes)
  const on = (k: string) => (k === 'partenaires' ? modules.personnes : modules.employes)
  // Déjà versé sur les comptes pas encore finis (pour « Total » et « Versé » des deux cartes)
  const paidOf = (p: { id: string }, type: string) =>
    movements.filter(m => m.personId === p.id && m.type === type && !m.isCancelled).reduce((a, m) => a + m.amount, 0)
  let paidToMe = 0
  let paidByMe = 0
  if (modules.personnes)
    for (const p of partners) {
      if ((p.owesMe || 0) > 0) paidToMe += paidOf(p, 'il_m_a_verse')
      if ((p.iOweHim || 0) > 0) paidByMe += paidOf(p, 'je_lui_ai_verse')
    }
  if (modules.employes)
    for (const e of employees) {
      const pr = payrollOf(e.id, movements, monthStates)
      paidToMe += pr.advances.filter(a => a.etat === 'En cours').reduce((a, r) => a + r.rendu, 0)
      paidByMe += pr.months.filter(m => m.reste > 0 || m.state === 'en_cours').reduce((a, m) => a + m.verse, 0)
    }
  const owesMePeople = nOwesMe + nAdvances
  const iOwePeople = nIOwe + nSalaries


  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <StatCard label="On me doit" value={totals.totalOwesMe} paid={paidToMe} tone="credit" Icon={ArrowDownLeft} onClick={() => setAccountsView({ dir: 'leurs', group: firstGroup })} />
        <StatCard label="Je dois" value={totals.totalIOwe} paid={paidByMe} tone="debt" Icon={ArrowUpRight} onClick={() => setAccountsView({ dir: 'mes', group: firstGroup })} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DonutCard
          title="Leurs comptes"
          tone="credit"
          delay={0}
          onOpen={group => setAccountsView({ dir: 'leurs', group })}
          unit={modules.personnes ? PEOPLE : STAFF}
          people={owesMePeople}
          slices={[
            { key: 'partenaires', label: 'Personnes', value: totals.partnersOwesMe, color: 'var(--color-credit)', count: nOwesMe, unit: PEOPLE },
            { key: 'avances', label: 'Avances', value: totals.employeesAdvanceOwed, color: modules.personnes ? 'color-mix(in oklch, var(--color-credit) 45%, transparent)' : 'var(--color-credit)', count: nAdvances, unit: STAFF },
          ].filter(s => on(s.key))}
        />
        <DonutCard
          title="Mes comptes"
          tone="debt"
          delay={100}
          onOpen={group => setAccountsView({ dir: 'mes', group })}
          unit={modules.personnes ? PEOPLE : STAFF}
          people={iOwePeople}
          slices={[
            { key: 'partenaires', label: 'Personnes', value: totals.partnersIOwe, color: 'var(--color-debt)', count: nIOwe, unit: PEOPLE },
            { key: 'salaires', label: 'Salaires', value: totals.employeesSalaryDue, color: modules.personnes ? 'color-mix(in oklch, var(--color-debt) 45%, transparent)' : 'var(--color-debt)', count: nSalaries, unit: STAFF },
          ].filter(s => on(s.key))}
        />
      </div>
    </div>
  )
}
