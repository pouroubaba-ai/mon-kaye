import React from 'react'
import { useStore } from '@/data/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatFCFA } from '@/lib/utils'
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  AlertTriangle, 
  Clock, 
  ChevronRight, 
  Users, 
  Briefcase, 
  PlusCircle, 
  CheckCircle2, 
  WalletCards 
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

export const DashboardScreen: React.FC = () => {
  const { totals, persons, setActiveTab, setSelectedPersonId, openNewMovement } = useStore()

  // Chart data for "On me doit" breakdown
  const owesMeChartData = [
    { name: 'Partenaires (crédits)', value: totals.partnersOwesMe, color: '#16a34a' },
    { name: 'Employés (avances)', value: totals.employeesAdvanceOwed, color: '#4ade80' },
  ]

  // Chart data for "Je dois" breakdown
  const iOweChartData = [
    { name: 'Partenaires (achats)', value: totals.partnersIOwe, color: '#ea580c' },
    { name: 'Employés (salaires)', value: totals.employeesSalaryDue, color: '#fb923c' },
  ]

  // "À payer bientôt" (Salaires dus et retards)
  const soonPayEmployees = persons
    .filter(p => p.type === 'employee' && p.status === 'actif' && (p.currentSalaryDue || 0) > 0)

  // "Ils tardent à payer" (> 30 jours sans versement)
  const latePartners = persons
    .filter(p => p.type === 'partner' && (p.owesMe || 0) > 0 && (p.daysSinceLastPayment || 0) >= 30)

  return (
    <div className="space-y-6 pb-24 md:pb-8">
      
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">
            Aperçu immédiat de la situation financière de votre commerce
          </p>
        </div>
        <Button
          onClick={() => openNewMovement()}
          size="lg"
          className="h-12 px-6 gap-2 text-base font-semibold shadow-md active:scale-95 transition-all"
        >
          <PlusCircle className="w-5 h-5" />
          Nouveau versement
        </Button>
      </div>

      {/* LES DEUX GRANDES CARTES GÉANTES : ON ME DOIT & JE DOIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* CARTE 1 : ON ME DOIT (VERT) */}
        <Card 
          onClick={() => {
            setActiveTab('personnes')
          }}
          className="cursor-pointer border-2 border-credit/30 bg-card hover:border-credit transition-all shadow-sm group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-credit" />
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-credit/10 text-credit flex items-center justify-center font-bold">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-credit block">
                  Argent attendu
                </span>
                <CardTitle className="text-lg font-bold text-foreground">
                  ON ME DOIT
                </CardTitle>
              </div>
            </div>
            <Badge className="bg-credit text-white text-xs px-2.5 py-0.5">
              À encaisser
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl sm:text-4xl font-extrabold text-credit tracking-tight">
              {formatFCFA(totals.totalOwesMe)}
            </div>
            
            {/* Répartition Partenaires & Employés */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t text-sm">
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-credit" /> Partenaires :
                </span>
                <p className="font-bold text-foreground">{formatFCFA(totals.partnersOwesMe)}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-credit" /> Avances employés :
                </span>
                <p className="font-bold text-foreground">{formatFCFA(totals.employeesAdvanceOwed)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground group-hover:text-foreground pt-1">
              <span>Voir la liste des personnes qui me doivent</span>
              <ChevronRight className="w-4 h-4 text-credit transition-transform group-hover:translate-x-1" />
            </div>
          </CardContent>
        </Card>

        {/* CARTE 2 : JE DOIS (ORANGE) */}
        <Card 
          onClick={() => {
            setActiveTab('personnes')
          }}
          className="cursor-pointer border-2 border-debt/30 bg-card hover:border-debt transition-all shadow-sm group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-debt" />
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-debt/10 text-debt flex items-center justify-center font-bold">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-debt block">
                  Engagements à honorer
                </span>
                <CardTitle className="text-lg font-bold text-foreground">
                  JE DOIS
                </CardTitle>
              </div>
            </div>
            <Badge className="bg-debt text-white text-xs px-2.5 py-0.5">
              À payer
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl sm:text-4xl font-extrabold text-debt tracking-tight">
              {formatFCFA(totals.totalIOwe)}
            </div>

            {/* Répartition Partenaires & Employés */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t text-sm">
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-debt" /> Partenaires :
                </span>
                <p className="font-bold text-foreground">{formatFCFA(totals.partnersIOwe)}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-debt" /> Salaires échus :
                </span>
                <p className="font-bold text-foreground">{formatFCFA(totals.employeesSalaryDue)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground group-hover:text-foreground pt-1">
              <span>Voir la liste de mes dettes</span>
              <ChevronRight className="w-4 h-4 text-debt transition-transform group-hover:translate-x-1" />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* CARTE D'INDICATEUR AVEC ANNEAU RECHARTS (RÉFÉRENCE MISSION SHADCN) */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <WalletCards className="w-5 h-5 text-muted-foreground" />
            Répartition globale des flux en jeu
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
            
            {/* Anneau 1 : ON ME DOIT */}
            <div className="flex items-center gap-4 bg-muted/20 p-3 rounded-xl border">
              <div className="w-24 h-24 shrink-0 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={owesMeChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={26}
                      outerRadius={40}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {owesMeChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [formatFCFA(Number(val) || 0), "Montant"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 text-xs">
                <span className="font-bold text-credit block text-sm">Part On me doit :</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-credit shrink-0" />
                  <span className="text-muted-foreground">Partenaires :</span>
                  <span className="font-semibold text-foreground">{formatFCFA(totals.partnersOwesMe)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-muted-foreground">Avances employés :</span>
                  <span className="font-semibold text-foreground">{formatFCFA(totals.employeesAdvanceOwed)}</span>
                </div>
              </div>
            </div>

            {/* Anneau 2 : JE DOIS */}
            <div className="flex items-center gap-4 bg-muted/20 p-3 rounded-xl border">
              <div className="w-24 h-24 shrink-0 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={iOweChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={26}
                      outerRadius={40}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {iOweChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [formatFCFA(Number(val) || 0), "Montant"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 text-xs">
                <span className="font-bold text-debt block text-sm">Part Je dois :</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-debt shrink-0" />
                  <span className="text-muted-foreground">Fournisseurs :</span>
                  <span className="font-semibold text-foreground">{formatFCFA(totals.partnersIOwe)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-muted-foreground">Salaires dus :</span>
                  <span className="font-semibold text-foreground">{formatFCFA(totals.employeesSalaryDue)}</span>
                </div>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* SECTIONS ALERTES : « À PAYER BIENTÔT » ET « ILS TARDENT À PAYER » */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* À PAYER BIENTÔT */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-debt" />
              <CardTitle className="text-base font-bold text-foreground">
                À payer bientôt
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-xs text-debt border-debt/30">
              {soonPayEmployees.length} salaires à solder
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {soonPayEmployees.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-credit" />
                Aucun salaire en attente de paiement.
              </div>
            ) : (
              soonPayEmployees.slice(0, 3).map(emp => (
                <div
                  key={emp.id}
                  onClick={() => {
                    setSelectedPersonId(emp.id)
                    setActiveTab('employes')
                  }}
                  className="p-3 rounded-xl border bg-muted/10 hover:bg-muted/40 cursor-pointer flex items-center justify-between transition-all"
                >
                  <div className="space-y-0.5">
                    <p className="font-bold text-sm text-foreground">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Échéance le {emp.dueDay} du mois · {emp.role}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-debt block">
                      {formatFCFA(emp.currentSalaryDue || 0)}
                    </span>
                    <span className="text-xs text-muted-foreground hover:underline">
                      Payer →
                    </span>
                  </div>
                </div>
              ))
            )}
            {soonPayEmployees.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => setActiveTab('employes')}
              >
                Voir tous les employés ({soonPayEmployees.length})
              </Button>
            )}
          </CardContent>
        </Card>

        {/* ILS TARDENT À PAYER */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <CardTitle className="text-base font-bold text-foreground">
                Ils tardent à payer
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30">
              Sans versement &gt; 30j
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {latePartners.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-credit" />
                Tous vos partenaires sont à jour de leurs versements.
              </div>
            ) : (
              latePartners.map(p => (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedPersonId(p.id)
                    setActiveTab('personnes')
                  }}
                  className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer flex items-center justify-between transition-all"
                >
                  <div className="space-y-0.5">
                    <p className="font-bold text-sm text-foreground">{p.name}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      Dernier versement il y a {p.daysSinceLastPayment} jours ({p.lastPaymentDate})
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-credit block">
                      {formatFCFA(p.owesMe || 0)}
                    </span>
                    <span className="text-xs text-muted-foreground hover:underline">
                      Relancer →
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

      </div>

    </div>
  )
}
