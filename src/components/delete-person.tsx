import * as React from 'react'
import { Trash2 } from 'lucide-react'

import { useStore } from '@/data/store'
import { payrollOf } from '@/data/payroll'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { formatFCFA } from '@/lib/utils'

// Bas de fiche : supprimer la personne ou l'employé, avec tout son historique.
// On demande toujours avant, et on rappelle l'argent encore en jeu pour éviter une erreur.
export function DeletePerson({ personId }: { personId: string }) {
  const { persons, movements, monthStates, deletePerson } = useStore()
  const [ask, setAsk] = React.useState(false)
  const person = persons.find(p => p.id === personId)
  if (!person) return null

  const pending: string[] = []
  if (person.type === 'employee') {
    const pr = payrollOf(person.id, movements, monthStates)
    const salary = pr.totalReste + pr.plannedRetenue
    if (salary > 0) pending.push(`Il reste ${formatFCFA(salary)} de salaire à lui payer.`)
    if (pr.advanceReste > 0) pending.push(`Il doit encore rendre ${formatFCFA(pr.advanceReste)} d'avance.`)
  } else {
    if ((person.owesMe || 0) > 0) pending.push(`Il vous doit encore ${formatFCFA(person.owesMe || 0)}.`)
    if ((person.iOweHim || 0) > 0) pending.push(`Vous lui devez encore ${formatFCFA(person.iOweHim || 0)}.`)
  }
  const history = person.type === 'employee' ? 'opérations, salaires, avances et paiements' : 'crédits, versements et retours'

  return (
    <>
      <Button variant="ghost" className="mt-4 h-11 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setAsk(true)}>
        <Trash2 /> Supprimer {person.type === 'employee' ? "l'employé" : 'le partenaire'}
      </Button>
      <Dialog open={ask} onOpenChange={setAsk}>
        <DialogContent>
          <div className="flex flex-col gap-4">
            <DialogHeader className="gap-1 p-0">
              <DialogTitle className="text-left">Supprimer {person.name} ?</DialogTitle>
              <DialogDescription className="text-left">
                Sa fiche et tout son historique seront effacés pour toujours : {history}. Les totaux de l'accueil changeront. On ne pourra pas revenir en arrière.
              </DialogDescription>
            </DialogHeader>
            {pending.length > 0 && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {pending.map(t => (
                  <p key={t}>{t}</p>
                ))}
              </div>
            )}
            <Button variant="destructive" size="lg" className="h-12" onClick={() => deletePerson(person.id)}>
              Supprimer définitivement
            </Button>
            <Button variant="outline" size="lg" className="h-12" onClick={() => setAsk(false)}>
              Annuler
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
