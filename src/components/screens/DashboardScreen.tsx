import React from 'react'
import { Label, Pie, PieChart } from 'recharts'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, ChevronRight, Clock } from 'lucide-react'

import { useStore } from '@/data/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { formatFCFA } from '@/lib/utils'

// Accueil construit sur les modèles shadcn/ui :
// - cartes d'indicateurs « section-cards » du bloc dashboard-01 ;
// - graphique en anneau « chart-pie-donut-text » ;
// - listes dans des Card standard.
// Chaque chiffre n'apparaît qu'une fois à l'écran.

const chartConfig = {
  partenairesMeDoivent: { label: 'Partenaires qui me doivent', color: 'var(--color-credit)' },
  avancesEmployes: { label: 'Avances des employés', color: 'color-mix(in oklch, var(--color-credit) 50%, transparent)' },
  jeDoisPartenaires: { label: 'Ce que je dois aux partenaires', color: 'var(--color-debt)' },
  salairesDus: { label: 'Salaires dus', color: 'color-mix(in oklch, var(--color-debt) 50%, transparent)' },
} satisfies ChartConfig

export const DashboardScreen: React.FC = () => {
  const { totals, persons, setActiveTab, setSelectedPersonId, openNewMovement } = useStore()

  const soonPayEmployees = persons.filter(
    p => p.type === 'employee' && p.status === 'actif' && (p.currentSalaryDue || 0) > 0
  )
  const latePartners = persons.filter(
    p => p.type === 'partner' && (p.owesMe || 0) > 0 && (p.daysSinceLastPayment || 0) >= 30
  )

  const chartData = [
    { key: 'partenairesMeDoivent', value: totals.partnersOwesMe, fill: 'var(--color-partenairesMeDoivent)' },
    { key: 'avancesEmployes', value: totals.employeesAdvanceOwed, fill: 'var(--color-avancesEmployes)' },
    { key: 'jeDoisPartenaires', value: totals.partnersIOwe, fill: 'var(--color-jeDoisPartenaires)' },
    { key: 'salairesDus', value: totals.employeesSalaryDue, fill: 'var(--color-salairesDus)' },
  ].filter(d => d.value > 0)

  const net = totals.totalOwesMe - totals.totalIOwe

  const openPerson = (id: string, tab: 'personnes' | 'employes') => {
    setSelectedPersonId(id)
    setActiveTab(tab)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Qui me doit, à qui je dois.</p>
      </div>

      {/* Cartes d'indicateurs (section-cards) */}
      <div className="grid grid-cols-1 gap-4 @container/main sm:grid-cols-2">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <ArrowDownLeft className="size-4 text-credit" />
              On me doit
            </CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums text-credit">
              {formatFCFA(totals.totalOwesMe)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">À encaisser</Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="flex w-full justify-between">
              <span className="text-muted-foreground">Partenaires</span>
              <span className="font-medium tabular-nums">{formatFCFA(totals.partnersOwesMe)}</span>
            </div>
            <div className="flex w-full justify-between">
              <span className="text-muted-foreground">Avances des employés</span>
              <span className="font-medium tabular-nums">{formatFCFA(totals.employeesAdvanceOwed)}</span>
            </div>
            <Button variant="link" className="h-auto px-0" onClick={() => setActiveTab('personnes')}>
              Voir qui me doit <ChevronRight />
            </Button>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <ArrowUpRight className="size-4 text-debt" />
              Je dois
            </CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums text-debt">
              {formatFCFA(totals.totalIOwe)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">À payer</Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="flex w-full justify-between">
              <span className="text-muted-foreground">Partenaires</span>
              <span className="font-medium tabular-nums">{formatFCFA(totals.partnersIOwe)}</span>
            </div>
            <div className="flex w-full justify-between">
              <span className="text-muted-foreground">Salaires dus</span>
              <span className="font-medium tabular-nums">{formatFCFA(totals.employeesSalaryDue)}</span>
            </div>
            <Button variant="link" className="h-auto px-0" onClick={() => setActiveTab('personnes')}>
              Voir à qui je dois <ChevronRight />
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Anneau (chart-pie-donut-text) : seule nouvelle information = le solde net */}
        <Card>
          <CardHeader>
            <CardTitle>Solde net</CardTitle>
            <CardDescription>Ce qu'on me doit moins ce que je dois</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="mx-auto aspect-auto h-[240px] w-full max-w-[280px]">
              <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={formatFCFA} />} />
                <Pie data={chartData} dataKey="value" nameKey="key" cx="50%" cy="50%" innerRadius={72} outerRadius={105} strokeWidth={4} isAnimationActive={false}>
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy}
                              className={net >= 0 ? 'fill-credit text-xl font-bold' : 'fill-debt text-xl font-bold'}
                            >
                              {(net >= 0 ? '+' : '−') + formatFCFA(Math.abs(net)).replace(' FCFA', '')}
                            </tspan>
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 22} className="fill-muted-foreground text-xs">
                              FCFA au net
                            </tspan>
                          </text>
                        )
                      }
                      return null
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="flex-col items-start gap-1 text-sm text-muted-foreground">
            {net >= 0 ? 'On vous doit plus que vous ne devez.' : 'Vous devez plus qu’on ne vous doit.'}
          </CardFooter>
        </Card>

        {/* À payer bientôt */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4 text-debt" /> À payer bientôt
            </CardTitle>
            <CardDescription>Salaires dus</CardDescription>
            <CardAction>
              <Badge variant="outline">{soonPayEmployees.length}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {soonPayEmployees.length === 0 && <p className="text-sm text-muted-foreground">Aucun salaire en attente.</p>}
            {soonPayEmployees.map(emp => (
              <div key={emp.id} className="flex items-center gap-2 rounded-lg border p-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openPerson(emp.id, 'employes')}>
                  <p className="truncate font-medium">{emp.name}</p>
                  <p className="text-xs text-muted-foreground">Le {emp.dueDay} du mois</p>
                </button>
                <span className="font-medium tabular-nums text-debt">{formatFCFA(emp.currentSalaryDue || 0)}</span>
                <Button size="sm" variant="outline" onClick={() => openNewMovement(emp.id, 'je_lui_ai_verse')}>
                  Payer
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Ils tardent à payer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-debt" /> Ils tardent à payer
            </CardTitle>
            <CardDescription>Rien versé depuis plus de 30 jours</CardDescription>
            <CardAction>
              <Badge variant="outline">{latePartners.length}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {latePartners.length === 0 && <p className="text-sm text-muted-foreground">Personne en retard.</p>}
            {latePartners.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => openPerson(p.id, 'personnes')}
                className="flex items-center gap-2 rounded-lg border p-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">Dernier versement il y a {p.daysSinceLastPayment} jours</p>
                </div>
                <span className="font-medium tabular-nums text-credit">{formatFCFA(p.owesMe || 0)}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
