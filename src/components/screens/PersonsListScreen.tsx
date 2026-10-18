import React, { useState } from 'react'
import { useStore } from '@/data/store'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Search, Phone, Plus } from 'lucide-react'
import { PersonFormDialog } from '@/components/person-header'

export const PersonsListScreen: React.FC = () => {
  const { persons, setSelectedPersonId, activeTab } = useStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [adding, setAdding] = useState(false)

  // Filter list
  const filteredPersons = persons.filter(p => {
    // If we came directly from Employes tab, default filter to employee
    if (activeTab === 'employes' && p.type !== 'employee') return false
    // La liste Personnes ne contient que les clients, fournisseurs… : les employés ont leur page.
    if (activeTab !== 'employes' && p.type === 'employee') return false

    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.phone.includes(searchQuery) ||
                          (p.role && p.role.toLowerCase().includes(searchQuery.toLowerCase()))

    if (!matchesSearch) return false

    return true
  }).sort((a, b) => {
    // Ordre alphabétique : les listes n'affichent plus de montants (ils sont dans la vue d'ensemble)
    return a.name.localeCompare(b.name, 'fr')
  })

  // Personnes et Employés : un simple carnet d'adresses. Qui doit quoi se voit depuis le
  // tableau de bord (« Leurs comptes » / « Mes comptes »).
  return (
    <div className="space-y-4">
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


      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {filteredPersons.length}{' '}
          {activeTab === 'employes'
            ? filteredPersons.length > 1 ? 'employés' : 'employé'
            : filteredPersons.length > 1 ? 'personnes' : 'personne'}
        </p>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus /> Ajouter
        </Button>
      </div>
      <PersonFormDialog
        type={activeTab === 'employes' ? 'employee' : 'partner'}
        open={adding}
        onOpenChange={setAdding}
        onCreated={id => setSelectedPersonId(id)}
      />

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
          filteredPersons.map((p, index) => {
            const isEmployee = p.type === 'employee'

            return (
              // Arrivée en cascade : chaque ligne glisse en place 40 ms après la précédente
              // (au plus 0,4 s d'attente), pour que la liste ne tombe pas d'un bloc.
              <Card
                key={p.id}
                onClick={() => setSelectedPersonId(p.id)}
                className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both cursor-pointer gap-0 p-3 duration-300 transition-colors hover:bg-muted/40 motion-reduce:animate-none"
                style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
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
                      {p.role && <p className="truncate text-xs text-muted-foreground">{p.role}</p>}
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Phone className="size-3" /> {p.phone}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>

    </div>
  )
}
