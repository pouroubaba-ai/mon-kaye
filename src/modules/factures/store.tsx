// ——— Factures : la liste, mes infos de facture, et les actions ———
// Séparé du store principal : les factures ont leurs propres données (shops/{uid}/invoices, meta/invoiceProfile).
// Lien avec les comptes : « il paie plus tard » ajoute le montant au crédit du client (une opération Crédit).
import React from 'react'
import { useStore } from '@/data/store'
import { deleteInvoiceDoc, deletePaymentDoc, loadInvoices, saveInvoiceDoc, saveInvoiceProfile, savePaymentDoc } from '@/lib/firebase'
import { newId } from '@/modules/mouvements'
import { plain } from '@/lib/utils'
import type { Invoice, InvoicePayment, InvoiceProfile, InvoiceStatus } from './types'
import { clientKeyOf, defaultProfile, lineTotal, numberOf, paidByInvoice, totals } from './view'

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
  payments: InvoicePayment[]
  paid: Map<string, number> // payé sur chaque facture
  // Un versement : sur une facture précise (invoiceId), sinon sur ses factures les plus anciennes
  addPayment: (p: { clientKey: string; personId?: string; clientName: string; amount: number; invoiceId?: string; note?: string }) => void
  // Annuler (jamais supprimer) : barré, avec son motif
  cancelPayment: (id: string, reason: string) => void
  cancelInvoice: (id: string, reason: string) => void
  // Un client qui n'est pas dans Kayé (seulement sur des factures) : effacer ses factures, devis et versements
  removeClient: (clientKey: string) => void
  adoptClient: (key: string) => string | null // un client de passage devient un de mes clients (ses factures et versements avec lui)
}
// « 2026-10-31 »
export const todayIso = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const C = React.createContext<Ctx | null>(null)
export const useInvoices = () => {
  const c = React.useContext(C)
  if (!c) throw new Error('useInvoices hors de InvoicesProvider')
  return c
}

const DEMO_PROFILE = (): InvoiceProfile => defaultProfile()
const DEMO_INVOICES: Invoice[] = [
  {
    id: 'inv-demo-1', kind: 'facture', number: 'LG/2026-003', date: '2026-10-21', status: 'credit',
    client: { personId: 'part-1', name: 'Maman Sylvie (Épicerie du Marché)', lines: ['Marché Total, Brazzaville'] },
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

const DEMO_PAYMENTS: InvoicePayment[] = [
  { id: 'pay-demo-1', clientKey: 'part-1', personId: 'part-1', clientName: 'Maman Sylvie (Épicerie du Marché)', amount: 50000, date: '2026-10-25', createdAt: '2026-10-25T10:00:00' },
]

export function InvoicesProvider({ uid, children }: { uid: string | null; children: React.ReactNode }) {
  const { shop, addMovement, addPerson, persons, isDemo } = useStore()
  // Sans compte (démonstration) : rien n'est enregistré ; les exemples seulement dans la vraie démonstration
  const demo = isDemo || !uid
  const [invoices, setInvoices] = React.useState<Invoice[]>(() => (isDemo ? DEMO_INVOICES : []))
  const [profile, setProfile] = React.useState<InvoiceProfile | null>(() => (isDemo ? DEMO_PROFILE() : null))
  const [payments, setPayments] = React.useState<InvoicePayment[]>(() => (isDemo ? DEMO_PAYMENTS : []))
  const paid = React.useMemo(() => paidByInvoice(invoices, payments), [invoices, payments])

  // Chargement : d'abord ce qui est sur le téléphone, puis la version en ligne
  React.useEffect(() => {
    if (demo || !uid) return
    let alive = true
    const apply = (r: Awaited<ReturnType<typeof loadInvoices>>) => {
      if (!alive) return
      setInvoices(r.invoices)
      setPayments(r.payments)
      if (r.profile && !r.profile.sb) {
        // Une seule fois : les infos de Sté SACKO-BUILDING BTP remplacent celles déjà enregistrées
        const sbp = defaultProfile()
        setProfile(sbp)
        void saveInvoiceProfile(uid, sbp)
      } else if (r.profile) setProfile(r.profile)
    }
    loadInvoices(uid, 'cache').then(apply).catch(() => {})
    loadInvoices(uid).then(apply).catch(e => console.error('[Kayé] Factures', e))
    return () => {
      alive = false
    }
  }, [uid, demo])

  // Une personne supprimée dans Kayé (ici) : ses factures, devis et versements partent avec elle
  const prevIds = React.useRef<Set<string> | null>(null)
  React.useEffect(() => {
    const ids = new Set(persons.map(p => p.id))
    const prev = prevIds.current
    prevIds.current = ids
    if (!prev) return
    const g = new Set([...prev].filter(id => !ids.has(id)))
    if (g.size === 0) return
    setInvoices(list => {
      for (const i of list) if (i.client.personId && g.has(i.client.personId) && !demo && uid) void deleteInvoiceDoc(uid, i.id)
      return list.filter(i => !(i.client.personId && g.has(i.client.personId)))
    })
    setPayments(list => {
      for (const p of list) if (p.personId && g.has(p.personId) && !demo && uid) void deletePaymentDoc(uid, p.id)
      return list.filter(p => !(p.personId && g.has(p.personId)))
    })
  }, [persons, demo, uid])
  // Celles d'une personne qui n'est plus dans Kayé (supprimée avant) : cachées, sans rien effacer
  const known = new Set(persons.map(p => p.id))
  const shownInvoices = invoices.filter(i => !i.client.personId || known.has(i.client.personId))
  const shownPayments = payments.filter(p => !p.personId || known.has(p.personId))

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

  // Le client est maintenant dans Kayé : ce n'est plus un client de passage
  const settled = (c: Invoice['client'], personId: string): Invoice['client'] => {
    const { passager: _p, ...rest } = c
    void _p
    return { ...rest, personId }
  }

  const create: Ctx['create'] = d => {
    let inv: Invoice = { ...d, id: newId('inv'), number: numberOf(prof, d.kind), date: d.date ?? todayIso(), createdAt: new Date().toISOString() }
    if (inv.kind === 'facture' && inv.status === 'credit') inv = { ...inv, client: settled(inv.client, addCredit(inv)) }
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
    if (inv.kind === 'facture' && status === 'credit' && inv.status !== 'credit') next = { ...next, client: settled(next.client, addCredit(next)) }
    update(next)
  }
  // Un versement. Sur une facture déjà mise au crédit dans Kayé, la même somme est notée « versé » sur son compte.
  const addPayment: Ctx['addPayment'] = p => {
    if (!(p.amount > 0)) return
    const pay: InvoicePayment = { ...p, id: newId('pay'), date: todayIso(), createdAt: new Date().toISOString() }
    const after = paidByInvoice(invoices, [...payments, pay])
    const onCredit = invoices
      .filter(i => i.kind === 'facture' && i.status === 'credit' && clientKeyOf(i) === p.clientKey)
      .reduce((a, i) => a + (after.get(i.id) ?? 0) - (paid.get(i.id) ?? 0), 0)
    setPayments(prev => [...prev, pay])
    if (!demo && uid) void savePaymentDoc(uid, pay)
    const personId = p.personId ?? invoices.find(i => i.status === 'credit' && clientKeyOf(i) === p.clientKey)?.client.personId
    const person = personId ? persons.find(x => x.id === personId) : undefined
    if (onCredit > 0 && person)
      addMovement({ personId: person.id, personName: person.name, type: 'il_m_a_verse', label: 'Versement', amount: onCredit, paymentMethod: 'especes', note: 'Versement sur facture' })
  }
  const stamp = () => new Date().toISOString()
  const cancelPayment: Ctx['cancelPayment'] = (id, reason) => {
    setPayments(prev =>
      prev.map(p => {
        if (p.id !== id || p.cancelled) return p
        const y = { ...p, cancelled: true, cancelReason: reason.trim(), cancelledAt: stamp() }
        if (!demo && uid) void savePaymentDoc(uid, y)
        return y
      })
    )
  }
  const cancelInvoice: Ctx['cancelInvoice'] = (id, reason) => {
    const inv = invoices.find(x => x.id === id)
    if (!inv || inv.cancelled) return
    update({ ...inv, cancelled: true, cancelReason: reason.trim(), cancelledAt: stamp() })
  }
  const removeClient: Ctx['removeClient'] = key => {
    setInvoices(list => {
      for (const i of list) if (clientKeyOf(i) === key && !demo && uid) void deleteInvoiceDoc(uid, i.id)
      return list.filter(i => clientKeyOf(i) !== key)
    })
    setPayments(list => {
      for (const p of list) if (p.clientKey === key && !demo && uid) void deletePaymentDoc(uid, p.id)
      return list.filter(p => p.clientKey !== key)
    })
  }
  const adoptClient: Ctx['adoptClient'] = ck => {
    const key = (s: string) => plain(s).replace(/\s+/g, ' ').trim()
    const list = invoices.filter(i => clientKeyOf(i) === ck).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const c = list[0]?.client
    if (!c) return null
    const same = persons.find(p => p.type === 'partner' && key(p.name) === key(c.name))
    const id = same ? same.id : addPerson({ type: 'partner', name: c.name.trim(), phone: c.phone ?? '', ...(c.billing && Object.keys(c.billing).length ? { billing: c.billing } : {}) })
    setInvoices(prev =>
      prev.map(i => {
        if (clientKeyOf(i) !== ck) return i
        const y = { ...i, client: settled(i.client, id) }
        keep(y)
        return y
      })
    )
    setPayments(prev =>
      prev.map(p => {
        if (p.clientKey !== ck) return p
        const y = { ...p, clientKey: id, personId: id }
        if (!demo && uid) void savePaymentDoc(uid, y)
        return y
      })
    )
    return id
  }
  const remove: Ctx['remove'] = id => {
    setInvoices(prev => prev.filter(x => x.id !== id))
    if (!demo && uid) void deleteInvoiceDoc(uid, id)
  }

  return <C.Provider value={{ invoices: shownInvoices, profile: prof, profileSet: !!profile, saveProfile, create, update, setStatus, remove, payments: shownPayments, paid, addPayment, cancelPayment, cancelInvoice, removeClient, adoptClient }}>{children}</C.Provider>
}
