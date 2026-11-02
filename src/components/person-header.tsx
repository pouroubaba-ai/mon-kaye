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
  noSex,
}: {
  noSex?: boolean // ouvert depuis Factures : souvent une entreprise, pas d'« homme ou femme »
  side?: 'lui' | 'moi' // ajouté depuis « On me doit » (client) ou « Je dois » (fournisseur) : seulement le titre
  person?: Person
  type?: 'partner' | 'employee'
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated?: (id: string) => void
}) {
  const { updatePerson, addPerson, persons, modules } = useStore()
  const kind = person?.type ?? type ?? 'partner'
  const isEmployee = kind === 'employee'
  const [name, setName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [role, setRole] = React.useState('')
  const [salary, setSalary] = React.useState('')
  const [sex, setSex] = React.useState<'h' | 'f' | undefined>()
  // Ses infos pour les factures : chacune dans son champ
  const emptyBilling = { forme: '', rccm: '', niu: '', adresse: '', ville: '', email: '' }
  const [billing, setBilling] = React.useState(emptyBilling)
  // Module Factures allumé : ses infos pour les factures (une fois pour toutes)
  const withDetails = !isEmployee && modules.factures
  // Les infos de facture restent rangées derrière un bouton tant qu'on ne les ouvre pas
  const [showBill, setShowBill] = React.useState(false)

  // À chaque ouverture : les valeurs actuelles (modifier) ou des champs vides (ajouter).
  React.useEffect(() => {
    if (!open) return
    setName(person?.name ?? '')
    setPhone(person?.phone ?? '')
    setRole(person?.role ?? '')
    setSalary(person?.salary ? String(person.salary) : '')
    setSex(person?.sex)
    setBilling({ ...emptyBilling, ...(person?.billing ?? {}) })
    setShowBill(false)
  }, [open, person])

  const dirty =
    name !== (person?.name ?? '') ||
    phone !== (person?.phone ?? '') ||
    role !== (person?.role ?? '') ||
    sex !== person?.sex ||
    (withDetails && JSON.stringify({ ...emptyBilling, ...(person?.billing ?? {}) }) !== JSON.stringify(billing)) ||
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
      ...(withDetails ? { billing: Object.fromEntries(Object.entries(billing).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)) } : {}),
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
          {!noSex && (
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
          )}
          <div className="grid gap-2">
            <Label htmlFor="edit-phone" className="text-[13px] font-normal text-muted-foreground">Numéro</Label>
            <input id="edit-phone" type="tel" inputMode="tel" placeholder="+242 06 …" value={phone} onChange={e => setPhone(e.target.value)} className="h-12 rounded-xl border bg-background px-3.5 text-base outline-none focus-visible:border-ring" />
          </div>
          {withDetails &&
            (() => {
              const filled = Object.values(billing).some(v => v.trim())
              const field = (k: keyof typeof billing, label: string, ph: string) => (
                <input
                  key={k}
                  id={`bill-${k}`}
                  aria-label={label}
                  type={k === 'email' ? 'email' : 'text'}
                  value={billing[k]}
                  placeholder={ph ? `${label} — ${ph}` : label}
                  onChange={e => setBilling(b => ({ ...b, [k]: e.target.value }))}
                  className="h-11 rounded-xl border bg-background px-3.5 text-[15px] outline-none focus-visible:border-ring"
                />
              )
              const card = (title: string, children: React.ReactNode) => (
                <div className="grid gap-2.5 rounded-2xl border bg-muted/30 p-3">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">{title}</span>
                    <span className="text-xs font-semibold text-muted-foreground">facultatif</span>
                  </div>
                  {children}
                </div>
              )
              if (showBill)
                return (
                  <div className="grid gap-3 animate-in fade-in duration-200">
                    {card('Où le trouver', [field('adresse', 'Adresse', 'avenue, quartier'), field('ville', 'Ville', 'ex : Brazzaville'), field('email', 'E-mail', '')])}
                    {card('Son entreprise', [field('forme', 'Forme', 'ex : SARL, Ets, SA'), field('rccm', 'RCCM', 'ex : CG-BZV-01-…'), field('niu', 'NIU', '')])}
                  </div>
                )
              // Déjà rempli : un résumé ; sinon : un seul bouton
              const line1 = [billing.adresse, billing.ville].map(v => v.trim()).filter(Boolean).join(' · ')
              const line2 = [billing.forme, billing.rccm && `RCCM ${billing.rccm}`, billing.niu && `NIU ${billing.niu}`, billing.email].map(v => (v || '').trim()).filter(Boolean).join(' · ')
              return filled ? (
                <button type="button" onClick={() => setShowBill(true)} className="flex items-center gap-3 rounded-2xl border bg-muted/30 p-3.5 text-left">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-bold">Infos pour la facture</span>
                    {line1 && <span className="truncate text-[13px] text-muted-foreground">{line1}</span>}
                    {line2 && <span className="truncate text-[13px] text-muted-foreground">{line2}</span>}
                  </span>
                  <span className="shrink-0 text-sm font-bold text-kgold">Modifier</span>
                </button>
              ) : (
                <button type="button" onClick={() => setShowBill(true)} className="flex items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-kgold/60 p-3.5 text-left">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-kgold/15 text-lg font-extrabold text-kgold">+</span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px] font-bold">Infos pour la facture</span>
                    <span className="truncate text-[13px] text-muted-foreground">Adresse, ville, e-mail, RCCM, NIU</span>
                  </span>
                </button>
              )
            })()}
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
          {/* Les infos de facture ouvertes : « Enregistrer » reste visible en bas pendant qu'on fait défiler */}
          <div className={withDetails && showBill ? 'sticky -bottom-6 -mx-4 bg-background px-4 pt-2 pb-6 dark:bg-card' : 'contents'}>
            <button type="submit" disabled={!valid} className="h-[58px] w-full rounded-2xl bg-kgreen-solid text-lg font-bold text-white disabled:opacity-40">
              Enregistrer
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
