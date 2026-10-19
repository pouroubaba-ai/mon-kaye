import * as React from 'react'
import { formatPhone } from '@/lib/utils'
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
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
            {initials(person.name)}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="truncate text-base leading-tight font-semibold">{person.name}</h1>
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
      <PersonFormDialog person={person} open={editing} onOpenChange={setEditing} />
    </>
  )
}

// Fenêtre « Modifier » (person fourni) ou « Ajouter » (type fourni, champs vides).
export function PersonFormDialog({
  person,
  type,
  open,
  onOpenChange,
  onCreated,
}: {
  person?: Person
  type?: 'partner' | 'employee'
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated?: (id: string) => void
}) {
  const { updatePerson, addPerson } = useStore()
  const kind = person?.type ?? type ?? 'partner'
  const isEmployee = kind === 'employee'
  const [name, setName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [role, setRole] = React.useState('')
  const [salary, setSalary] = React.useState('')

  // À chaque ouverture : les valeurs actuelles (modifier) ou des champs vides (ajouter).
  React.useEffect(() => {
    if (!open) return
    setName(person?.name ?? '')
    setPhone(person?.phone ?? '')
    setRole(person?.role ?? '')
    setSalary(person?.salary ? String(person.salary) : '')
  }, [open, person])

  const dirty =
    name !== (person?.name ?? '') ||
    phone !== (person?.phone ?? '') ||
    role !== (person?.role ?? '') ||
    (isEmployee && salary !== (person?.salary ? String(person.salary) : ''))
  const valid = name.trim().length > 0 && (!isEmployee || parseInt(salary, 10) > 0)

  const save = () => {
    if (!valid) return
    const data = {
      name: name.trim(),
      phone: formatPhone(phone),
      role: role.trim() || undefined,
      ...(isEmployee ? { salary: parseInt(salary, 10) } : {}),
    }
    if (person) {
      updatePerson(person.id, data)
    } else {
      const id = addPerson({ type: kind, ...data })
      onCreated?.(id)
    }
    onOpenChange(false)
  }

  const title = person ? 'Modifier' : isEmployee ? 'Nouvel employé' : 'Nouvelle personne'

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dirty={dirty} dirtyKind={person ? 'modification' : 'ajout'}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
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
            <Input id="edit-name" value={name} onChange={e => setName(e.target.value)} autoFocus={!person} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-phone">Numéro</Label>
            <Input id="edit-phone" type="tel" inputMode="tel" placeholder="+242 06 …" value={phone} onChange={e => setPhone(e.target.value)} />
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
            // Salaire toujours mensuel, dû à la fin du mois : pas de jour de paie à choisir.
            <div className="grid gap-2">
              <Label htmlFor="edit-salary">Salaire par mois (FCFA)</Label>
              <Input id="edit-salary" inputMode="numeric" value={salary} onChange={e => setSalary(e.target.value.replace(/\D/g, ''))} />
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
