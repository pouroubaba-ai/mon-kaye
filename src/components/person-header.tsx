import * as React from 'react'
import { formatPhone, nameTaken } from '@/lib/utils'
import { Pencil, Phone } from 'lucide-react'

import { useStore } from '@/data/store'
import type { Person } from '@/data/mockData'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
  side,
}: {
  side?: 'lui' | 'moi' // ajouté depuis « On me doit » (client) ou « Je dois » (fournisseur) : seulement le titre
  person?: Person
  type?: 'partner' | 'employee'
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated?: (id: string) => void
}) {
  const { updatePerson, addPerson, persons } = useStore()
  const kind = person?.type ?? type ?? 'partner'
  const isEmployee = kind === 'employee'
  const [name, setName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [role, setRole] = React.useState('')
  const [salary, setSalary] = React.useState('')
  const [sex, setSex] = React.useState<'h' | 'f' | undefined>()

  // À chaque ouverture : les valeurs actuelles (modifier) ou des champs vides (ajouter).
  React.useEffect(() => {
    if (!open) return
    setName(person?.name ?? '')
    setPhone(person?.phone ?? '')
    setRole(person?.role ?? '')
    setSalary(person?.salary ? String(person.salary) : '')
    setSex(person?.sex)
  }, [open, person])

  const dirty =
    name !== (person?.name ?? '') ||
    phone !== (person?.phone ?? '') ||
    role !== (person?.role ?? '') ||
    sex !== person?.sex ||
    (isEmployee && salary !== (person?.salary ? String(person.salary) : ''))
  const taken = nameTaken(persons, name, person?.id)
  const valid = name.trim().length > 0 && !taken && (!isEmployee || parseInt(salary, 10) > 0)

  const save = () => {
    if (!valid) return
    const data = {
      name: name.trim(),
      phone: formatPhone(phone),
      role: role.trim() || undefined,
      ...(sex ? { sex } : {}),
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

  const title = person ? 'Modifier ses infos' : isEmployee ? 'Nouvel employé' : side === 'moi' ? 'Nouveau fournisseur' : side === 'lui' ? 'Nouveau client' : 'Nouveau partenaire'

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dirty={dirty} dirtyKind={person ? 'modification' : 'ajout'}>
      <DialogContent>
        <DialogHeader className="text-left">
          <DialogTitle className="text-left text-xl">{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4 pb-2"
          onSubmit={e => {
            e.preventDefault()
            save()
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="edit-name" className="text-[13px] font-normal text-muted-foreground">Nom</Label>
            <input id="edit-name" value={name} onChange={e => setName(e.target.value)} aria-invalid={!!taken} className="h-12 rounded-xl border bg-background px-3.5 text-base outline-none focus-visible:border-ring" />
            {taken && <p className="text-xs text-destructive">{taken}</p>}
          </div>
          {/* Homme ou Femme : pour écrire « Il me doit » ou « Elle me doit » (rien n'est choisi d'avance) */}
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Homme ou femme">
            {(
              [
                ['h', 'Homme'],
                ['f', 'Femme'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={sex === v}
                onClick={() => setSex(sex === v ? undefined : v)}
                className={
                  sex === v
                    ? 'h-11 rounded-full border-[1.5px] border-kgold bg-kgold text-sm font-bold text-white dark:text-black'
                    : 'h-11 rounded-full border text-sm font-semibold text-muted-foreground'
                }
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-phone" className="text-[13px] font-normal text-muted-foreground">Numéro</Label>
            <input id="edit-phone" type="tel" inputMode="tel" placeholder="+242 06 …" value={phone} onChange={e => setPhone(e.target.value)} className="h-12 rounded-xl border bg-background px-3.5 text-base outline-none focus-visible:border-ring" />
          </div>
          {isEmployee && (
          <div className="grid gap-2">
            <Label htmlFor="edit-role" className="text-[13px] font-normal text-muted-foreground">Poste</Label>
            <input
              className="h-12 rounded-xl border bg-background px-3.5 text-base outline-none focus-visible:border-ring"
              id="edit-role"
              placeholder={isEmployee ? 'Ex : Caissière' : 'Ex : Client, Fournisseur'}
              value={role}
              onChange={e => setRole(e.target.value)}
            />
          </div>
          )}
          {isEmployee && (
            // Salaire toujours mensuel, dû à la fin du mois : pas de jour de paie à choisir.
            <div className="grid gap-2">
              <Label htmlFor="edit-salary" className="text-[13px] font-normal text-muted-foreground">Salaire par mois (FCFA)</Label>
              <input id="edit-salary" inputMode="numeric" value={salary} onChange={e => setSalary(e.target.value.replace(/\D/g, ''))} className="h-12 rounded-xl border bg-background px-3.5 text-base outline-none focus-visible:border-ring font-bold tabular-nums" />
              {person && <p className="text-xs text-muted-foreground">Un nouveau salaire compte à partir de la prochaine paie.</p>}
            </div>
          )}
          <button type="submit" disabled={!valid} className="h-[58px] rounded-2xl bg-kgreen-solid text-lg font-bold text-white disabled:opacity-40">
            Enregistrer
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
