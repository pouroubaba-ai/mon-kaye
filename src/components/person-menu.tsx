import * as React from 'react'
import { Archive, ArchiveRestore, MessageCircle, Pencil, Phone, Trash2 } from 'lucide-react'

import { useStore } from '@/data/store'
import type { Person } from '@/data/mockData'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { PersonFormDialog } from '@/components/person-header'
import { DeletePerson } from '@/components/delete-person'
import { cn, formatFCFA, waNumber } from '@/lib/utils'
import { il } from '@/modules/personnes/view'

// Menu ⋯ d'une personne (client ou fournisseur) : Modifier ses infos, WhatsApp, Appeler, Ranger, Supprimer.
export function PersonMenu({ person, open, onOpenChange }: { person: Person; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { updatePerson, setSelectedPersonId, shop } = useStore()
  const [editing, setEditing] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const owes = person.owesMe || 0
  const iOwe = person.iOweHim || 0
  const elle = il(person) === 'Elle'

  // Le message WhatsApp : ce qui reste, des deux côtés
  const text = [
    `Bonjour ${person.name},`,
    owes > 0 && `selon mon cahier, vous me devez ${formatFCFA(owes)}.`,
    iOwe > 0 && `${owes > 0 ? 'De mon côté, je' : 'Selon mon cahier, je'} vous dois ${formatFCFA(iOwe)}.`,
    owes === 0 && iOwe === 0 && 'selon mon cahier, nous sommes à jour.',
    shop.name ? `— ${shop.name}` : '',
  ]
    .filter(Boolean)
    .join('\n')
  const wa = `https://wa.me/${waNumber(person.phone)}?text=${encodeURIComponent(text)}`
  const sub = owes > 0 ? `${elle ? 'Elle' : 'Il'} me doit ${formatFCFA(owes)}` : iOwe > 0 ? `Je lui dois ${formatFCFA(iOwe)}` : 'À jour'

  const close = () => onOpenChange(false)
  const item = (Icon: React.ComponentType<{ className?: string }>, label: string, hint: string, onClick: () => void, opts: { danger?: boolean; green?: boolean; last?: boolean; href?: string } = {}) => {
    const inner = (
      <>
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl',
            opts.danger ? 'bg-kred/10 text-kred' : opts.green ? 'bg-kgreen/10 text-kgreen' : 'bg-muted text-muted-foreground'
          )}
        >
          <Icon className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn('text-base font-semibold', opts.danger && 'text-kred')}>{label}</span>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </span>
      </>
    )
    const cls = cn('flex w-full items-center gap-3.5 py-3 text-left', !opts.last && 'border-b border-border/60')
    return opts.href ? (
      <a href={opts.href} target={opts.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" onClick={close} className={cls}>
        {inner}
      </a>
    ) : (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader className="gap-0.5 text-left">
            <DialogTitle className="text-lg">{person.name}</DialogTitle>
            <DialogDescription className="text-left">{sub}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col px-1 pb-2">
            {item(Pencil, 'Modifier ses infos', 'Nom, homme ou femme, numéro', () => {
              close()
              setEditing(true)
            })}
            {item(MessageCircle, 'Envoyer sur WhatsApp', owes > 0 ? 'Un rappel de ce qu’' + (elle ? 'elle' : 'il') + ' doit' : 'Ce qui reste entre vous', () => {}, { green: true, href: wa })}
            {person.phone && item(Phone, 'Appeler', person.phone, () => {}, { href: `tel:${person.phone.replace(/\s/g, '')}` })}
            {person.archived
              ? item(ArchiveRestore, 'Remettre dans la liste', 'Ses comptes n’ont pas bougé', () => {
                  updatePerson(person.id, { archived: false })
                  close()
                })
              : item(Archive, 'Ranger', `${elle ? 'Elle' : 'Il'} ne s’affiche plus dans la liste · on garde ses comptes`, () => {
                  updatePerson(person.id, { archived: true })
                  close()
                  setSelectedPersonId(null)
                })}
            {item(
              Trash2,
              'Supprimer',
              'Seulement en cas d’erreur',
              () => {
                close()
                setDeleting(true)
              },
              { danger: true, last: true }
            )}
          </div>
        </DialogContent>
      </Dialog>
      <PersonFormDialog person={person} open={editing} onOpenChange={setEditing} />
      <DeletePerson personId={person.id} open={deleting} onOpenChange={setDeleting} />
    </>
  )
}
