// ——— Factures et devis ———
// Une facture (ou un devis) garde une copie des infos du client et de l'émetteur au moment où elle est faite :
// si on change plus tard le nom du client ou son logo, les anciennes factures ne bougent pas.

export type InvoiceKind = 'facture' | 'devis'

// État d'une facture : payée, ou pas encore (ajoutée ou non au crédit du client).
// Un devis : en attente, accepté (devenu une facture) ou refusé.
export type InvoiceStatus = 'payee' | 'non_payee' | 'credit' | 'devis' | 'accepte' | 'refuse'

export interface InvoiceLine {
  d: string // désignation
  x?: string // détail (en italique, facultatif)
  q: number // quantité
  u?: string // unité (« jours », « m³ »…)
  p: number // prix pour une unité
}

export interface InvoiceClient {
  personId?: string // le client dans Kayé (s'il y est)
  name: string
  lines: string[] // forme juridique, RCCM, adresse… (une info par ligne)
  phone?: string
}

export interface Invoice {
  id: string
  kind: InvoiceKind
  number: string // « SB-BTP/2026-001 »
  date: string // « 2026-09-09 »
  client: InvoiceClient
  objet?: string
  lines: InvoiceLine[]
  tva: boolean
  status: InvoiceStatus
  movementId?: string // crédit ajouté au compte du client (« il paie plus tard »)
  fromQuote?: string // facture née d'un devis : le numéro du devis
  createdAt: string
}

// Mes infos de facture : une seule fois, puis sur chaque facture
export interface InvoiceProfile {
  logo?: string // image (data URL), réduite
  name: string
  activities: string // « Bâtiment · Travaux publics · Location d'engins »
  address: string // une info par ligne
  phone: string
  email?: string
  ids?: string // NIU, RCCM…
  payment?: string // « Mobile Money : 06 … »
  prefix: string // « SB-BTP/2026- »
  next: number // prochain numéro de facture
  quotePrefix: string // « D-2026- »
  quoteNext: number
  mentions: string // une mention par ligne ; {numero} = le numéro de la facture
}
