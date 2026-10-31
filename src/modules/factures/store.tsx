// ——— Factures : la liste, mes infos de facture, et les actions ———
// Séparé du store principal : les factures ont leurs propres données (shops/{uid}/invoices, meta/invoiceProfile).
// Lien avec les comptes : « il paie plus tard » ajoute le montant au crédit du client (une opération Crédit).
import React from 'react'
import { useStore } from '@/data/store'
import { deleteInvoiceDoc, loadInvoices, saveInvoiceDoc, saveInvoiceProfile } from '@/lib/firebase'
import { newId } from '@/modules/mouvements'
import { plain } from '@/lib/utils'
import type { Invoice, InvoiceProfile, InvoiceStatus } from './types'
import { defaultProfile, lineTotal, numberOf, totals } from './view'

// Ce qu'on donne pour créer : tout sauf ce que l'app met elle-même
export type InvoiceDraft = Omit<Invoice, 'id' | 'number' | 'createdAt' | 'date'> & { date?: string }

type Ctx = {
  invoices: Invoice[]
  profile: InvoiceProfile
  profileSet: boolean // le commerçant a déjà rempli ses infos
  saveProfile: (p: InvoiceProfile) => void
  create: (d: InvoiceDraft) => Invoice
  update: (inv: Invoice) => void
  setStatus: (id: string, status: InvoiceStatus) => void
  remove: (id: string) => void
}
// « 2026-10-31 »
export const todayIso = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const C = React.createContext<Ctx | null>(null)
export const useInvoices = () => {
  const c = React.useContext(C)
  if (!c) throw new Error('useInvoices hors de InvoicesProvider')
  return c
}

const DEMO_PROFILE = (): InvoiceProfile => ({
  ...defaultProfile('Alimentation Générale La Grâce'),
  activities: 'Alimentation générale · Boissons · Livraison',
  address: 'Marché Total, Bacongo\nBrazzaville, République du Congo',
  phone: '06 654 32 10',
  prefix: 'LG/2026-',
  next: 4,
  quotePrefix: 'LG-D/2026-',
  quoteNext: 2,
})
const DEMO_INVOICES: Invoice[] = [
  {
    id: 'inv-demo-1', kind: 'facture', number: 'LG/2026-003', date: '2026-10-21', status: 'credit',
    client: { personId: 'part-1', name: 'Boutique La Bénédiction', lines: ['Moungali, Brazzaville'] },
    objet: 'Approvisionnement de la boutique', createdAt: '2026-10-21T10:00:00',
    lines: [{ d: 'Riz parfumé', x: 'Sacs de 25 kg', q: 4, u: 'sac', p: 17500 }, { d: 'Huile végétale', q: 2, u: 'carton', p: 24000 }],
  },
  {
    id: 'inv-demo-2', kind: 'facture', number: 'LG/2026-002', date: '2026-10-02', status: 'payee',
    client: { name: 'Hôtel Le Fleuve', lines: ['Centre-ville, Brazzaville'] },
    createdAt: '2026-10-02T10:00:00',
    lines: [{ d: 'Eau minérale 1,5 L', q: 10, u: 'carton', p: 3500 }, { d: 'Livraison', q: 1, u: 'forfait', p: 5000 }],
  },
  {
    id: 'inv-demo-3', kind: 'devis', number: 'LG-D/2026-001', date: '2026-10-28', status: 'devis',
    client: { name: 'Mairie de Moungali', lines: ['Bd Denis Sassou Nguesso'] },
    objet: 'Boissons pour la fête du quartier', createdAt: '2026-10-28T10:00:00',
    lines: [{ d: 'Jus de fruits', q: 15, u: 'carton', p: 9000 }, { d: 'Eau minérale 1,5 L', q: 20, u: 'carton', p: 3500 }],
  },
]

export function InvoicesProvider({ uid, children }: { uid: string | null; children: React.ReactNode }) {
  const { shop, addMovement, addPerson, persons, isDemo } = useStore()
  // Sans compte (démonstration) : rien n'est enregistré ; les exemples seulement dans la vraie démonstration
  const demo = isDemo || !uid
  const [invoices, setInvoices] = React.useState<Invoice[]>(() => (isDemo ? DEMO_INVOICES : []))
  const [profile, setProfile] = React.useState<InvoiceProfile | null>(() => (isDemo ? DEMO_PROFILE() : null))

  // Chargement : d'abord ce qui est sur le téléphone, puis la version en ligne
  React.useEffect(() => {
    if (demo || !uid) return
    let alive = true
    const apply = (r: Awaited<ReturnType<typeof loadInvoices>>) => {
      if (!alive) return
      setInvoices(r.invoices)
      if (r.profile) setProfile(r.profile)
    }
    loadInvoices(uid, 'cache').then(apply).catch(() => {})
    loadInvoices(uid).then(apply).catch(e => console.error('[Kayé] Factures', e))
    return () => {
      alive = false
    }
  }, [uid, demo])

  const prof = profile ?? defaultProfile(shop.name)
  const keep = (inv: Invoice) => {
    if (!demo && uid) void saveInvoiceDoc(uid, inv)
  }
  const saveProfile = (p: InvoiceProfile) => {
    setProfile(p)
    if (!demo && uid) void saveInvoiceProfile(uid, p)
  }

  // « Il paie plus tard » : le montant devient un crédit sur le compte du client
  // Le client n'est pas encore dans Kayé : il y est ajouté (Clients et fournisseurs). Renvoie son identifiant.
  const addCredit = (inv: Invoice): string => {
    const key = (s: string) => plain(s).replace(/\s+/g, ' ').trim()
    const person =
      (inv.client.personId && persons.find(p => p.id === inv.client.personId)) ||
      persons.find(p => p.type === 'partner' && key(p.name) === key(inv.client.name))
    const personId = person ? person.id : addPerson({ type: 'partner', name: inv.client.name.trim(), phone: inv.client.phone ?? '' })
    addMovement({
      personId,
      personName: person ? person.name : inv.client.name.trim(),
      type: 'il_a_pris_credit',
      label: 'Crédit',
      amount: totals(inv).net,
      note: `${inv.kind === 'devis' ? 'Devis' : 'Facture'} ${inv.number}`,
      items: inv.lines.map(l => ({ label: l.d, qty: l.q, price: l.p, total: lineTotal(l) })),
    })
    return personId
  }

  const create: Ctx['create'] = d => {
    let inv: Invoice = { ...d, id: newId('inv'), number: numberOf(prof, d.kind), date: d.date ?? todayIso(), createdAt: new Date().toISOString() }
    if (inv.kind === 'facture' && inv.status === 'credit') inv = { ...inv, client: { ...inv.client, personId: addCredit(inv) } }
    setInvoices(prev => [inv, ...prev])
    keep(inv)
    // Le numéro suivant
    saveProfile(d.kind === 'devis' ? { ...prof, quoteNext: prof.quoteNext + 1 } : { ...prof, next: prof.next + 1 })
    // Facture née d'un devis : le devis est accepté
    if (inv.fromQuote)
      setInvoices(prev =>
        prev.map(x => {
          if (x.kind !== 'devis' || x.number !== inv.fromQuote) return x
          const y = { ...x, status: 'accepte' as const }
          keep(y)
          return y
        })
      )
    return inv
  }
  const update: Ctx['update'] = inv => {
    setInvoices(prev => prev.map(x => (x.id === inv.id ? inv : x)))
    keep(inv)
  }
  const setStatus: Ctx['setStatus'] = (id, status) => {
    const inv = invoices.find(x => x.id === id)
    if (!inv) return
    let next = { ...inv, status }
    if (inv.kind === 'facture' && status === 'credit' && inv.status !== 'credit') next = { ...next, client: { ...next.client, personId: addCredit(next) } }
    update(next)
  }
  const remove: Ctx['remove'] = id => {
    setInvoices(prev => prev.filter(x => x.id !== id))
    if (!demo && uid) void deleteInvoiceDoc(uid, id)
  }

  return <C.Provider value={{ invoices, profile: prof, profileSet: !!profile, saveProfile, create, update, setStatus, remove }}>{children}</C.Provider>
}
