import * as React from 'react'
import { Pencil, Phone } from 'lucide-react'

import { useStore } from '@/data/store'
import type { Person } from '@/data/mockData'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'

// En-tête des fiches (personne ou employé) : une petite carte d'identité.
// Initiales dans un rond, nom, rôle, numéro qu'on touche pour appeler, et un bouton « Modifier ».

const initials = (name: string) =>
  name
    .replace(/\(.*\)/, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

export function PersonHeader({ person, badge }: { person: Person; badge?: React.ReactNode }) {
  const [editing, setEditing] = React.useState(false)
  return (
    <>
      <Card className="py-4">
        <CardContent className="flex items-center gap-4 px-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
            {initials(person.name)}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="truncate text-lg leading-tight font-semibold">{person.name}</h1>
            {(person.role || badge) && (
              <div className="flex min-w-0 items-center gap-2">
                {person.role && <p className="truncate text-sm text-muted-foreground">{person.role}</p>}
                {badge}
              </div>
            )}
            <a
              href={`tel:${person.phone.replace(/\s/g, '')}`}
              className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Phone className="size-3.5" /> {person.phone}
            </a>
          </div>
          <Button variant="outline" size="icon" onClick={() => setEditing(true)} aria-label="Modifier">
            <Pencil />
          </Button>
        </CardContent>
      </Card>
      <EditPersonDialog person={person} open={editing} onOpenChange={setEditing} />
    </>
  )
}

function EditPersonDialog({ person, open, onOpenChange }: { person: Person; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { updatePerson } = useStore()
  const isEmployee = person.type === 'employee'
  const [name, setName] = React.useState(person.name)
  const [phone, setPhone] = React.useState(person.phone)
  const [role, setRole] = React.useState(person.role ?? '')
  const [salary, setSalary] = React.useState(String(person.salary ?? ''))
  const [dueDay, setDueDay] = React.useState(String(person.dueDay ?? ''))

  // À chaque ouverture, on repart des valeurs actuelles.
  React.useEffect(() => {
    if (!open) return
    setName(person.name)
    setPhone(person.phone)
    setRole(person.role ?? '')
    setSalary(String(person.salary ?? ''))
    setDueDay(String(person.dueDay ?? ''))
  }, [open, person])

  const day = parseInt(dueDay, 10)
  const valid = name.trim().length > 0 && (!isEmployee || (parseInt(salary, 10) > 0 && day >= 1 && day <= 31))

  const save = () => {
    if (!valid) return
    updatePerson(person.id, {
      name: name.trim(),
      phone: phone.trim(),
      role: role.trim() || undefined,
      ...(isEmployee ? { salary: parseInt(salary, 10), dueDay: day } : {}),
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier</DialogTitle>
          <DialogDescription className="sr-only">Modifier les informations</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={e => {
            e.preventDefault()
            save()
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Nom</Label>
            <Input id="edit-name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-phone">Numéro</Label>
            <Input id="edit-phone" type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-role">{isEmployee ? 'Poste' : 'Rôle'}</Label>
            <Input
              id="edit-role"
              placeholder={isEmployee ? 'Ex : Caissière' : 'Ex : Client, Fournisseur'}
              value={role}
              onChange={e => setRole(e.target.value)}
            />
          </div>
          {isEmployee && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="edit-salary">Salaire (FCFA)</Label>
                <Input id="edit-salary" inputMode="numeric" value={salary} onChange={e => setSalary(e.target.value.replace(/\D/g, ''))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-day">Jour de paie</Label>
                <Input id="edit-day" inputMode="numeric" maxLength={2} value={dueDay} onChange={e => setDueDay(e.target.value.replace(/\D/g, ''))} />
              </div>
            </div>
          )}
          <Button type="submit" size="lg" className="h-12" disabled={!valid}>
            Enregistrer
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
