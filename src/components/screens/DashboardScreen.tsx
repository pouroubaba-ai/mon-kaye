import React from 'react'
import { Label, Pie, PieChart } from 'recharts'
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react'

import { useStore } from '@/data/store'
import { dueDayOf, payrollOf, periodBounds, toTime } from '@/data/payroll'
import { Segmented } from '@/components/segmented'
import { DateFilter, FilterOption, FilterPill } from '@/components/date-filter'
import { FlowChart } from '@/components/flow-chart'
import { ALL_TIME, inRange, isFiltered, type DateRange } from '@/lib/date-range'
import type { Person } from '@/data/mockData'
import { PaidLine } from '@/components/paid-line'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
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
  line,
}: {
  label: string
  value: number
  paid: number
  // Ligne sous le montant à la place de « Total · Versé » (tableau de bord filtré)
  line?: React.ReactNode
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
          {line ?? (value > 0 && <PaidLine remaining={value} paid={paid} tone={tone} className="mt-1.5" />)}
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
  unit = ['personne', 'personnes'],
}: {
  title: string
  slices: Slice[]
  people: number
  tone: 'credit' | 'debt'
  delay?: number
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
          // Simple lecture : pas de toucher sur le graphique (sur iPhone, un graphique qui réagit au
          // toucher obligeait à toucher deux fois les onglets du bas)
          className="pointer-events-none mx-auto aspect-square h-[220px]"
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
              // Simple lecture : la carte ne s'ouvre pas (on passe par les cartes du haut)
              <div key={s.key} className="-mx-2 flex flex-col gap-1.5 px-2 py-1 text-left">
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
                  <span className="w-11 shrink-0 text-right text-xs whitespace-nowrap tabular-nums text-muted-foreground">{pct} %</span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// Tableau de bord sans filtre (tout, ou un seul module) : ce qui reste dû aujourd'hui
const CurrentDashboard: React.FC<{ only?: 'partner' | 'employee'; extra?: React.ReactNode }> = ({ only, extra }) => {
  const store = useStore()
  const { totals: allTotals, persons, movements, monthStates, setAccountsView } = store
  // Un seul module choisi en haut : on fait comme si l'autre était coupé
  const modules = only ? { personnes: only === 'partner', employes: only === 'employee' } : store.modules
  const totals = {
    ...allTotals,
    totalOwesMe: (modules.personnes ? allTotals.partnersOwesMe : 0) + (modules.employes ? allTotals.employeesAdvanceOwed : 0),
    totalIOwe: (modules.personnes ? allTotals.partnersIOwe : 0) + (modules.employes ? allTotals.employeesSalaryDue : 0),
  }

  const partners = persons.filter(p => p.type === 'partner')
  const employees = persons.filter(p => p.type === 'employee')
  const PEOPLE: [string, string] = ['partenaire', 'partenaires']
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
      paidByMe += pr.months.filter(m => m.reste > 0 && m.state !== 'en_cours').reduce((a, m) => a + m.verse, 0)
    }
  const owesMePeople = nOwesMe + nAdvances
  const iOwePeople = nIOwe + nSalaries


  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <StatCard label="On me doit" value={totals.totalOwesMe} paid={paidToMe} tone="credit" Icon={ArrowDownLeft} onClick={() => setAccountsView({ dir: 'leurs', group: firstGroup })} />
        <StatCard label="Je dois" value={totals.totalIOwe} paid={paidByMe} tone="debt" Icon={ArrowUpRight} onClick={() => setAccountsView({ dir: 'mes', group: firstGroup })} />
      </div>

      {extra}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DonutCard
          title="Leurs comptes"
          tone="credit"
          delay={0}
          unit={modules.personnes ? PEOPLE : STAFF}
          people={owesMePeople}
          slices={[
            { key: 'partenaires', label: 'Partenaires', value: totals.partnersOwesMe, color: 'var(--color-credit)', count: nOwesMe, unit: PEOPLE },
            { key: 'avances', label: 'Avances', value: totals.employeesAdvanceOwed, color: modules.personnes ? 'color-mix(in oklch, var(--color-credit) 45%, transparent)' : 'var(--color-credit)', count: nAdvances, unit: STAFF },
          ].filter(s => on(s.key))}
        />
        <DonutCard
          title="Mes comptes"
          tone="debt"
          delay={100}
          unit={modules.personnes ? PEOPLE : STAFF}
          people={iOwePeople}
          slices={[
            { key: 'partenaires', label: 'Partenaires', value: totals.partnersIOwe, color: 'var(--color-debt)', count: nIOwe, unit: PEOPLE },
            { key: 'salaires', label: 'Salaires', value: totals.employeesSalaryDue, color: modules.personnes ? 'color-mix(in oklch, var(--color-debt) 45%, transparent)' : 'var(--color-debt)', count: nSalaries, unit: STAFF },
          ].filter(s => on(s.key))}
        />
      </div>
    </div>
  )
}

// Petite ligne « ● Versé 45 000 ● Retours 5 000 » sous un montant de période
function DotLine({ items }: { items: { label: string; value: number; color: string }[] }) {
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-semibold leading-none whitespace-nowrap text-muted-foreground tabular-nums">
      {items.map(i => (
        <span key={i.label} className="flex items-center gap-1">
          <span className="size-1.5 shrink-0 rounded-full" style={{ background: i.color }} />
          {i.label} {amount(i.value)}
        </span>
      ))}
    </span>
  )
}

// Partenaires, avec un filtre par date : ce qui s'est passé pendant la période
const PartnerPeriod: React.FC<{ range: DateRange }> = ({ range }) => {
  const { persons, movements, setAccountsView } = useStore()
  const ids = new Set(persons.filter(p => p.type === 'partner').map(p => p.id))
  const inP = movements.filter(m => ids.has(m.personId) && !m.isCancelled && inRange(m.date, range))
  const sum = (t: string) => inP.filter(m => m.type === t).reduce((a, m) => a + m.amount, 0)
  const line = (pay: string, ret: string, tone: 'credit' | 'debt') => {
    const base = tone === 'credit' ? 'var(--color-credit)' : 'var(--color-debt)'
    return (
      <DotLine
        items={[
          { label: 'Versé', value: sum(pay), color: base },
          ...(sum(ret) > 0 ? [{ label: 'Retours', value: sum(ret), color: '#a78bfa' }] : []),
        ]}
      />
    )
  }
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4">
      <StatCard label="Ils ont pris" value={sum('il_a_pris_credit')} paid={0} tone="credit" Icon={ArrowDownLeft} onClick={() => setAccountsView({ dir: 'leurs', group: 'partner' })} line={line('il_m_a_verse', 'il_a_retourne', 'credit')} />
      <StatCard label="J'ai pris" value={sum('j_ai_pris_credit')} paid={0} tone="debt" Icon={ArrowUpRight} onClick={() => setAccountsView({ dir: 'mes', group: 'partner' })} line={line('je_lui_ai_verse', 'j_ai_retourne', 'debt')} />
    </div>
  )
}

// ——— Employés : filtre par période de paie ———
const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
// « Septembre – Octobre » (paie le 25) ; « Octobre » (paie le dernier jour du mois). La période porte le mois de son échéance.
function periodName(period: string, emps: Person[]) {
  const [y, m] = period.split('-').map(Number)
  const year = y !== new Date().getFullYear() ? ` ${y}` : ''
  const allLastDay = emps.length > 0 && emps.every(e => dueDayOf(e.id) >= 29)
  if (allLastDay) return `${MONTH_NAMES[m - 1]}${year}`
  return `${MONTH_NAMES[(m + 10) % 12]} – ${MONTH_NAMES[m - 1]}${year}`
}

function usePayPeriods() {
  const { persons, movements, monthStates } = useStore()
  const employees = persons.filter(p => p.type === 'employee')
  const rows = employees.map(e => ({ e, pr: payrollOf(e.id, movements, monthStates) }))
  const periods = [...new Set(rows.flatMap(r => r.pr.months.map(m => m.period)))].sort().reverse()
  return { rows, periods, nameOf: (p: string) => periodName(p, rows.filter(r => r.pr.months.some(m => m.period === p)).map(r => r.e)) }
}

function PeriodFilter({ value, onChange }: { value: string | null; onChange: (p: string | null) => void }) {
  const [open, setOpen] = React.useState(false)
  const { periods, nameOf } = usePayPeriods()
  const pick = (p: string | null) => {
    onChange(p)
    setOpen(false)
  }
  return (
    <FilterPill label={value ? nameOf(value) : 'Toutes les périodes'} active={!!value} onClear={() => onChange(null)} open={open} onOpenChange={setOpen}>
      <div className="flex max-h-72 flex-col overflow-y-auto">
        <FilterOption label="Toutes les périodes" selected={!value} onClick={() => pick(null)} />
        {periods.map(p => (
          <FilterOption key={p} label={nameOf(p)} selected={value === p} onClick={() => pick(p)} />
        ))}
      </div>
    </FilterPill>
  )
}

// Employés, sur une période de paie : avances données et rendues, salaires à payer et versés
const EmployeePeriod: React.FC<{ period: string }> = ({ period }) => {
  const { movements, setAccountsView } = useStore()
  const { rows } = usePayPeriods()
  let brut = 0
  let verse = 0
  let reste = 0
  let given = 0
  let rendu = 0
  for (const { e, pr } of rows) {
    const row = pr.months.find(m => m.period === period)
    if (!row) continue
    if (row.state !== 'annule') {
      brut += row.brut
      verse += row.verse
      reste += row.reste
    }
    const { start, end } = periodBounds(period, dueDayOf(e.id))
    const inside = (d: string) => toTime(d) >= start.getTime() && toTime(d) < end.getTime()
    for (const m of movements) {
      if (m.personId !== e.id || m.isCancelled) continue
      if (m.type === 'avance_salaire' && inside(m.date)) given += m.amount
      if (m.type === 'remboursement_direct' && inside(m.date)) rendu += m.amount
      // Retenue : seulement quand le salaire de la période est tombé
      if (m.type === 'retenue_salaire' && m.period === period && row.state !== 'en_cours') rendu += m.amount
    }
  }
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4">
      <StatCard
        label="Avances données"
        value={given}
        paid={0}
        tone="credit"
        Icon={ArrowDownLeft}
        onClick={() => setAccountsView({ dir: 'leurs', group: 'employee' })}
        line={<DotLine items={[{ label: 'Rendu', value: rendu, color: 'var(--color-credit)' }]} />}
      />
      <StatCard
        label="Salaires"
        value={brut}
        paid={0}
        tone="debt"
        Icon={ArrowUpRight}
        onClick={() => setAccountsView({ dir: 'mes', group: 'employee' })}
        line={
          <DotLine
            items={[
              { label: 'Versé', value: verse, color: 'var(--color-debt)' },
              { label: 'Reste', value: reste, color: 'color-mix(in srgb, var(--color-debt) 45%, transparent)' },
            ]}
          />
        }
      />
    </div>
  )
}

// Tableau de bord :
// - deux modules allumés : « Tout » (comme avant), « Partenaires » ou « Employés » ; le filtre n'apparaît
//   qu'avec un seul module (les partenaires se comptent en jours, les employés en périodes de paie) ;
// - Partenaires : filtre par date + graphique ; Employés : filtre par période de paie.
export const DashboardScreen: React.FC = () => {
  const { modules, movements, persons } = useStore()
  const both = modules.personnes && modules.employes
  const [pick, setPick] = React.useState<'tout' | 'partner' | 'employee'>('tout')
  const scope = both ? pick : modules.personnes ? 'partner' : 'employee'
  const [range, setRange] = React.useState<DateRange>(ALL_TIME)
  const [period, setPeriod] = React.useState<string | null>(null)
  const partnerIds = new Set(persons.filter(p => p.type === 'partner').map(p => p.id))
  const partnerMovs = movements.filter(m => partnerIds.has(m.personId))

  return (
    <div className="flex flex-col gap-4">
      {(both || scope !== 'tout') && (
        <div className="flex flex-wrap items-center gap-2">
          {both && (
            <Segmented
              options={[
                { value: 'tout', label: 'Tout' },
                { value: 'partner', label: 'Partenaires' },
                { value: 'employee', label: 'Employés' },
              ]}
              value={pick}
              onChange={setPick}
            />
          )}
          {scope === 'partner' && <DateFilter value={range} onChange={setRange} />}
          {scope === 'employee' && <PeriodFilter value={period} onChange={setPeriod} />}
        </div>
      )}

      {scope === 'tout' && <CurrentDashboard />}
      {scope === 'partner' &&
        (isFiltered(range) ? (
          <div className="flex flex-col gap-6">
            <PartnerPeriod range={range} />
            <FlowChart movements={partnerMovs} range={range} />
          </div>
        ) : (
          <CurrentDashboard only="partner" extra={<FlowChart movements={partnerMovs} range={range} />} />
        ))}
      {scope === 'employee' && (period ? <EmployeePeriod period={period} /> : <CurrentDashboard only="employee" />)}
    </div>
  )
}
