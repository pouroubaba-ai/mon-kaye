import React, { useState } from 'react'
import { useStore } from '@/data/store'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmployeesOverview } from '@/components/screens/EmployeesOverview'
import { PartnersOverview } from '@/components/screens/PartnersOverview'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatFCFA } from '@/lib/utils'
import { Search, UserCheck, PlusCircle, ArrowDownLeft, ArrowUpRight, Phone, Briefcase } from 'lucide-react'

export const PersonsListScreen: React.FC = () => {
  const { persons, setSelectedPersonId, activeTab } = useStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [employeeView, setEmployeeView] = useState<'liste' | 'ensemble'>('liste')
  const [filterType, setFilterType] = useState<'all' | 'owes_me' | 'i_owe' | 'employees'>('all')

  // Filter list
  const filteredPersons = persons.filter(p => {
    // If we came directly from Employes tab, default filter to employee
    if (activeTab === 'employes' && p.type !== 'employee') return false

    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.phone.includes(searchQuery) ||
                          (p.role && p.role.toLowerCase().includes(searchQuery.toLowerCase()))

    if (!matchesSearch) return false

    if (filterType === 'owes_me') {
      if (p.type === 'partner') return (p.owesMe || 0) > 0
      if (p.type === 'employee') return (p.advanceBalance || 0) > 0
    }
    if (filterType === 'i_owe') {
      if (p.type === 'partner') return (p.iOweHim || 0) > 0
      if (p.type === 'employee') return (p.currentSalaryDue || 0) > 0
    }
    if (filterType === 'employees') {
      return p.type === 'employee'
    }

    return true
  }).sort((a, b) => {
    // Employés : ordre alphabétique (la liste n'affiche plus de montants)
    if (activeTab === 'employes') return a.name.localeCompare(b.name, 'fr')
    // Tri par défaut : plus gros montant en jeu
    const maxA = Math.max(a.owesMe || 0, a.iOweHim || 0, a.currentSalaryDue || 0, a.advanceBalance || 0)
    const maxB = Math.max(b.owesMe || 0, b.iOweHim || 0, b.currentSalaryDue || 0, b.advanceBalance || 0)
    return maxB - maxA
  })

  // Personnes et Employés : deux onglets, « Liste » et « Vue d'ensemble ».
  const employeeTabs = (
    <Tabs value={employeeView} onValueChange={v => setEmployeeView(v as 'liste' | 'ensemble')}>
      <TabsList className="w-full">
        <TabsTrigger value="liste">Liste</TabsTrigger>
        <TabsTrigger value="ensemble">Vue d'ensemble</TabsTrigger>
      </TabsList>
    </Tabs>
  )

  if (employeeView === 'ensemble') {
    return (
      <div className="space-y-4">
        {employeeTabs}
        {activeTab === 'employes' ? <EmployeesOverview /> : <PartnersOverview />}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {employeeTabs}
      {/* Barre de Recherche instantanée */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom ou numéro de téléphone..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-10 h-12 text-sm bg-card border shadow-sm rounded-xl"
        />
      </div>

      {/* Filtres par Onglets / Boutons Rapides */}
      {activeTab !== 'employes' && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <Button
            variant={filterType === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('all')}
            className="rounded-full px-3 h-8 text-xs shrink-0"
          >
            Tous ({persons.length})
          </Button>
          <Button
            variant={filterType === 'owes_me' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('owes_me')}
            className={`rounded-full px-3 h-8 text-xs shrink-0 ${filterType === 'owes_me' ? 'bg-credit text-white hover:bg-credit/90' : 'text-credit border-credit/30'}`}
          >
            Me doivent ({persons.filter(p => (p.owesMe || 0) > 0 || (p.advanceBalance || 0) > 0).length})
          </Button>
          <Button
            variant={filterType === 'i_owe' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('i_owe')}
            className={`rounded-full px-3 h-8 text-xs shrink-0 ${filterType === 'i_owe' ? 'bg-debt text-white hover:bg-debt/90' : 'text-debt border-debt/30'}`}
          >
            Je leur dois ({persons.filter(p => (p.iOweHim || 0) > 0 || (p.currentSalaryDue || 0) > 0).length})
          </Button>
          <Button
            variant={filterType === 'employees' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('employees')}
            className="rounded-full px-3 h-8 text-xs shrink-0"
          >
            Employés ({persons.filter(p => p.type === 'employee').length})
          </Button>
        </div>
      )}

      {activeTab === 'employes' && (
        <p className="text-sm text-muted-foreground">
          {filteredPersons.length} {filteredPersons.length > 1 ? 'employés' : 'employé'}
        </p>
      )}

      {/* Liste des personnes triée */}
      <div className="space-y-2.5">
        {filteredPersons.length === 0 ? (
          <Card className="border shadow-sm p-8 text-center space-y-3">
            <p className="text-muted-foreground text-sm">
              Aucune personne ne correspond à votre recherche.
            </p>
            <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
              Effacer la recherche
            </Button>
          </Card>
        ) : (
          filteredPersons.map(p => {
            const isEmployee = p.type === 'employee'
            const netPartner = (p.owesMe || 0) - (p.iOweHim || 0)

            return (
              <Card
                key={p.id}
                onClick={() => setSelectedPersonId(p.id)}
                className="cursor-pointer gap-0 p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-3">
                  
                  {/* Avatar / Initiales + Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold">
                      {p.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="truncate text-sm font-medium">
                          {p.name}
                        </span>
                        {isEmployee && activeTab !== 'employes' && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {p.status === 'inactif' ? 'Inactif' : 'Employé'}
                          </Badge>
                        )}
                      </div>
                      {activeTab === 'employes' ? (
                        <>
                          {p.role && <p className="truncate text-xs text-muted-foreground">{p.role}</p>}
                          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <Phone className="size-3" /> {p.phone}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {p.phone}
                          {p.role && <span>· {p.role}</span>}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Montants : uniquement dans Personnes (la liste Employés n'en affiche plus) */}
                  {activeTab !== 'employes' && (
                  <div className="text-right shrink-0">
                    {!isEmployee ? (
                      <div>
                        {netPartner > 0 ? (
                          <div className="flex items-center justify-end gap-2" title="Il me doit">
                            <span className="flex size-6 items-center justify-center rounded-md bg-muted text-credit" aria-label="Il me doit">
                              <ArrowDownLeft className="size-3.5" />
                            </span>
                            <span className="text-sm font-medium tabular-nums text-credit">{formatFCFA(netPartner)}</span>
                          </div>
                        ) : netPartner < 0 ? (
                          <div className="flex items-center justify-end gap-2" title="Je lui dois">
                            <span className="flex size-6 items-center justify-center rounded-md bg-muted text-debt" aria-label="Je lui dois">
                              <ArrowUpRight className="size-3.5" />
                            </span>
                            <span className="text-sm font-medium tabular-nums text-debt">{formatFCFA(Math.abs(netPartner))}</span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Comptes soldés
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {(p.currentSalaryDue || 0) > 0 && (
                          <div className="flex items-center justify-end gap-2" title="Salaire dû">
                            <span className="flex size-6 items-center justify-center rounded-md bg-muted text-debt" aria-label="Salaire dû">
                              <ArrowUpRight className="size-3.5" />
                            </span>
                            <span className="text-sm font-medium tabular-nums text-debt">{formatFCFA(p.currentSalaryDue || 0)}</span>
                          </div>
                        )}
                        {(p.advanceBalance || 0) > 0 && (
                          <div className="flex items-center justify-end gap-2" title="Avance à rendre">
                            <span className="flex size-6 items-center justify-center rounded-md bg-muted text-credit" aria-label="Avance à rendre">
                              <ArrowDownLeft className="size-3.5" />
                            </span>
                            <span className="text-sm font-medium tabular-nums text-credit">{formatFCFA(p.advanceBalance || 0)}</span>
                          </div>
                        )}
                        {(p.currentSalaryDue || 0) === 0 && (p.advanceBalance || 0) === 0 && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            À jour
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  )}

                </div>
              </Card>
            )
          })
        )}
      </div>

    </div>
  )
}
