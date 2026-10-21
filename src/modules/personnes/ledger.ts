// Comptes des partenaires (clients, fournisseurs) : « son compte » (ce qu'il a pris chez moi, owesMe)
// et « mon compte » (ce que j'ai pris chez lui, iOweHim).
// Fonctions sans effet : elles reçoivent l'état et rendent le nouvel état. Le store les applique.
import type { Movement, Person } from '@/data/mockData'

// Trop versé : « plus tard » = la différence passe dans l'autre compte ; « déjà rendu » = réglé en main propre.
export type ExcessChoice = 'plus_tard' | 'deja_rendu'
export type Side = 'lui' | 'moi'

// Ce qui a été retourné sur un crédit (retours encore valables)
export const returnedOn = (movements: Movement[], creditId: string) =>
  movements
    .filter(m => m.linkedMovementId === creditId && !m.isCancelled && (m.type === 'il_a_retourne' || m.type === 'j_ai_retourne'))
    .reduce((a, m) => a + m.amount, 0)

// De combien une opération ferait passer un compte sous zéro
export const excessOf = (person: Person | undefined, side: Side, reduce: number) => {
  if (!person) return 0
  const balance = side === 'lui' ? person.owesMe || 0 : person.iOweHim || 0
  return Math.max(0, reduce - balance)
}

// Nouvelle opération sur un partenaire : ses compteurs bougent
export function applyMovement(p: Person, m: Movement): Person {
  const updated = { ...p }
  const owesMe = p.owesMe || 0
  const iOweHim = p.iOweHim || 0
  if (m.type === 'il_m_a_verse') {
    updated.owesMe = Math.max(0, owesMe - m.amount)
    updated.lastPaymentDate = m.date
    updated.daysSinceLastPayment = 0
  } else if (m.type === 'il_a_pris_credit') {
    updated.owesMe = owesMe + m.amount
    updated.lastCreditToHimDate = m.date
  } else if (m.type === 'je_lui_ai_verse') {
    updated.iOweHim = Math.max(0, iOweHim - m.amount)
    updated.lastPaidByMeDate = m.date
  } else if (m.type === 'j_ai_pris_credit') {
    updated.iOweHim = iOweHim + m.amount
    updated.lastCreditFromHimDate = m.date
  }
  return updated
}

// Trop versé. side = le compte qui passe sous zéro. La différence change de côté : on l'inscrit comme une
// dette dans l'autre compte (« plus tard »), ou comme une dette aussitôt réglée (« déjà rendu »),
// pour que l'historique explique tout.
export function excessMovements(p: Person, side: Side, excess: number, choice: ExcessChoice, linkedId: string, why: string, date: string, stamp: number): Movement[] {
  const out: Movement[] = [
    {
      id: `mov-trop-${stamp}`,
      personId: p.id,
      personName: p.name,
      type: side === 'lui' ? 'j_ai_pris_credit' : 'il_a_pris_credit',
      label: side === 'lui' ? 'Trop versé : à lui rendre' : 'Trop versé : à me rendre',
      amount: excess,
      date,
      note: `Trop versé après ${why}.`,
      linkedMovementId: linkedId,
    },
  ]
  if (choice === 'deja_rendu') {
    out.push({
      id: `mov-rendu-${stamp}`,
      personId: p.id,
      personName: p.name,
      type: side === 'lui' ? 'je_lui_ai_verse' : 'il_m_a_verse',
      label: 'Trop versé : rendu',
      amount: excess,
      date,
      paymentMethod: 'especes',
      note: `Différence déjà rendue après ${why}.`,
      linkedMovementId: linkedId,
    })
  }
  return out
}

// Retire `reduce` d'un compte. S'il passe sous zéro, il revient à 0 et la différence va dans l'autre compte
// (sauf si elle a déjà été rendue).
export function reduceAccount(p: Person, side: Side, reduce: number, choice: ExcessChoice | undefined) {
  const updated = { ...p }
  const balance = side === 'lui' ? p.owesMe || 0 : p.iOweHim || 0
  const excess = Math.max(0, reduce - balance)
  if (side === 'lui') updated.owesMe = Math.max(0, balance - reduce)
  else updated.iOweHim = Math.max(0, balance - reduce)
  if (excess > 0 && (choice ?? 'plus_tard') === 'plus_tard') {
    if (side === 'lui') updated.iOweHim = (p.iOweHim || 0) + excess
    else updated.owesMe = (p.owesMe || 0) + excess
  }
  return { updated, excess }
}

// Annuler une opération d'un partenaire (jamais de suppression : la ligne reste, barrée).
// - compensation : les deux versements liés s'annulent ensemble, les deux comptes remontent ;
// - crédit : il emporte ses retours ; s'il était déjà payé, le trop versé change de côté.
// Rend la personne mise à jour, les opérations à ajouter et les opérations à barrer (id → motif).
export function planCancel(movements: Movement[], person: Person, target: Movement, reason: string, choice: ExcessChoice | undefined, date: string, stamp: number) {
  const id = target.id
  const isCredit = target.type === 'il_a_pris_credit' || target.type === 'j_ai_pris_credit'
  const net = isCredit ? target.amount - returnedOn(movements, id) : target.amount
  const amt = target.amount
  const twinId = target.paymentMethod === 'compensation' ? target.linkedMovementId : undefined
  let updated: Person = { ...person }
  let added: Movement[] = []

  if (twinId) {
    updated.owesMe = (person.owesMe || 0) + amt
    updated.iOweHim = (person.iOweHim || 0) + amt
  } else if (target.type === 'il_m_a_verse' || target.type === 'il_a_retourne') updated.owesMe = (person.owesMe || 0) + amt
  else if (target.type === 'je_lui_ai_verse' || target.type === 'j_ai_retourne') updated.iOweHim = (person.iOweHim || 0) + amt
  else if (isCredit) {
    const side: Side = target.type === 'il_a_pris_credit' ? 'lui' : 'moi'
    const r = reduceAccount(person, side, net, choice)
    updated = r.updated
    if (r.excess > 0) added = excessMovements(person, side, r.excess, choice ?? 'plus_tard', id, `l'annulation du crédit du ${target.date}`, date, stamp)
  }

  const marks: Record<string, string> = { [id]: reason }
  for (const m of movements) {
    if (m.isCancelled) continue
    if (twinId && m.id === twinId) marks[m.id] = reason
    if (isCredit && m.linkedMovementId === id && (m.type === 'il_a_retourne' || m.type === 'j_ai_retourne')) marks[m.id] = 'Crédit annulé'
  }
  return { person: updated, added, marks }
}

// Retour de marchandise sur un crédit : baisse le compte comme un versement, sans argent.
export function planReturn(person: Person, credit: Movement, amount: number, choice: ExcessChoice | undefined, date: string, stamp: number) {
  const side: Side = credit.type === 'il_a_pris_credit' ? 'lui' : 'moi'
  const ret: Movement = {
    id: `mov-retour-${stamp}`,
    personId: person.id,
    personName: person.name,
    type: side === 'lui' ? 'il_a_retourne' : 'j_ai_retourne',
    label: 'Retour',
    amount,
    date,
    note: `Sur le crédit du ${credit.date} (${credit.amount.toLocaleString('fr-FR')} FCFA)`,
    linkedMovementId: credit.id,
  }
  const r = reduceAccount(person, side, amount, choice)
  const extra = r.excess > 0 ? excessMovements(person, side, r.excess, choice ?? 'plus_tard', ret.id, `le retour du ${date}`, date, stamp) : []
  return { person: r.updated, added: [...extra, ret] }
}

// Compensation : chacun « verse » à l'autre le plus petit des deux montants.
// Deux versements liés, motif « Compensation » : un dans son compte, un dans le mien.
export function planCompensation(partner: Person, date: string, stamp: number) {
  const amount = Math.min(partner.owesMe || 0, partner.iOweHim || 0)
  if (amount <= 0) return null
  const id1 = `mov-comp-lui-${stamp}`
  const id2 = `mov-comp-moi-${stamp}`
  const m1: Movement = {
    id: id1,
    personId: partner.id,
    personName: partner.name,
    type: 'il_m_a_verse',
    label: 'Compensation',
    amount,
    date,
    paymentMethod: 'compensation',
    note: `Compensation de ${amount.toLocaleString('fr-FR')} FCFA entre Client et Fournisseur`,
    linkedMovementId: id2,
  }
  const m2: Movement = { ...m1, id: id2, type: 'je_lui_ai_verse', linkedMovementId: id1 }
  const person: Person = {
    ...partner,
    owesMe: (partner.owesMe || 0) - amount,
    iOweHim: (partner.iOweHim || 0) - amount,
    lastPaymentDate: date,
    lastPaidByMeDate: date,
  }
  return { person, added: [m1, m2] }
}

// Totaux des partenaires
export const partnerTotals = (persons: Person[]) => {
  const partners = persons.filter(p => p.type === 'partner')
  return {
    partnersOwesMe: partners.reduce((a, p) => a + (p.owesMe || 0), 0),
    partnersIOwe: partners.reduce((a, p) => a + (p.iOweHim || 0), 0),
    latePartnersCount: partners.filter(p => (p.owesMe || 0) > 0 && (p.daysSinceLastPayment || 0) >= 30).length,
  }
}
