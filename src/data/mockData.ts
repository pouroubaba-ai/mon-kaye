export interface Person {
  id: string
  name: string
  phone: string
  type: 'partner' | 'employee'
  role?: string
  notes?: string
  avatarUrl?: string
  // For partners:
  owesMe?: number // Il me doit
  iOweHim?: number // Je lui dois
  lastPaymentDate?: string // Son dernier versement reçu (jj/mm/aaaa)
  lastPaidByMeDate?: string // Mon dernier versement à cette personne (jj/mm/aaaa)
  daysSinceLastPayment?: number
  // For employees:
  salary?: number // FCFA
  frequency?: 'mensuel' | 'quinzaine' | 'hebdomadaire' | 'journalier'
  dueDay?: number // Jour de paie
  startDate?: string
  status?: 'actif' | 'inactif'
  currentSalaryDue?: number // Salaire échu en cours
  advanceBalance?: number // Avance restante
  advanceDeductionPerPeriod?: number // Retenue par paie
  lastAdvanceRepaymentDate?: string // Dernier remboursement d'avance (jj/mm/aaaa)
  lastSalaryPaymentDate?: string // Dernier salaire versé (jj/mm/aaaa)
}

export interface Movement {
  id: string
  personId: string
  personName: string
  type: 'il_a_pris_credit' | 'j_ai_pris_credit' | 'il_m_a_verse' | 'je_lui_ai_verse' | 'salaire_du' | 'avance_salaire' | 'retenue_salaire' | 'remboursement_direct' | 'compensation'
  label: string
  amount: number
  date: string
  paymentMethod?: 'especes' | 'momo_mtn' | 'airtel_money'
  reference?: string
  note?: string
  receiptPhoto?: string
  isCancelled?: boolean
  cancellationReason?: string
  cancelledAt?: string
  linkedMovementId?: string
}

export const INITIAL_SHOP = {
  name: "Alimentation Générale La Grâce",
  owner: "M. Sylvain Ngoma",
  phone: "+242 06 654 32 10",
  address: "Marché Total, Bacongo — Brazzaville",
  pin: "1234",
  isLocked: false,
}

export const INITIAL_PERSONS: Person[] = [
  // 5 Employés
  {
    id: "emp-1",
    name: "Grâce Ngoulou",
    phone: "+242 06 812 45 67",
    type: "employee",
    role: "Caissière Principale",
    salary: 85000,
    frequency: "mensuel",
    dueDay: 28,
    startDate: "01/02/2025",
    status: "actif",
    currentSalaryDue: 85000,
    lastSalaryPaymentDate: "29/08/2026",
    advanceBalance: 0,
    advanceDeductionPerPeriod: 0,
    notes: "Tenue exemplaire de la caisse centrale.",
  },
  {
    id: "emp-2",
    name: "Michel Kimbembe",
    phone: "+242 05 523 90 12",
    type: "employee",
    role: "Magasinier & Manutention",
    salary: 60000,
    frequency: "mensuel",
    dueDay: 25,
    startDate: "15/05/2025",
    status: "actif",
    currentSalaryDue: 60000,
    lastSalaryPaymentDate: "26/09/2026",
    advanceBalance: 20000,
    lastAdvanceRepaymentDate: "28/09/2026",
    advanceDeductionPerPeriod: 10000,
    notes: "Avance accordée pour frais médicaux familiaux.",
  },
  {
    id: "emp-3",
    name: "Arnaud Moukassa",
    phone: "+242 06 934 11 88",
    type: "employee",
    role: "Chauffeur Livreur Triporteur",
    salary: 70000,
    frequency: "mensuel",
    dueDay: 27,
    startDate: "10/08/2025",
    status: "actif",
    currentSalaryDue: 70000,
    lastSalaryPaymentDate: "28/09/2026",
    advanceBalance: 35000,
    lastAdvanceRepaymentDate: "02/08/2026",
    advanceDeductionPerPeriod: 15000,
    notes: "Livraisons quartier Mpila et Moungali.",
  },
  {
    id: "emp-4",
    name: "Blandine Mpassi",
    phone: "+242 05 777 62 33",
    type: "employee",
    role: "Vendeuse Rayon Frais & Boissons",
    salary: 50000,
    frequency: "mensuel",
    dueDay: 30,
    startDate: "01/11/2025",
    status: "actif",
    currentSalaryDue: 50000,
    lastSalaryPaymentDate: "01/10/2026",
    advanceBalance: 0,
    advanceDeductionPerPeriod: 0,
    notes: "Gestion des frigos et réassortiment lait/boissons.",
  },
  {
    id: "emp-5",
    name: "Junior Batéké",
    phone: "+242 06 441 89 00",
    type: "employee",
    role: "Apprenti Vendeur (Départ prévu)",
    salary: 40000,
    frequency: "mensuel",
    dueDay: 28,
    startDate: "01/01/2026",
    status: "actif",
    currentSalaryDue: 40000,
    lastSalaryPaymentDate: "30/09/2026",
    advanceBalance: 15000,
    lastAdvanceRepaymentDate: "06/10/2026",
    advanceDeductionPerPeriod: 10000,
    notes: "Demande de départ pour reprise des études.",
  },

  // Partenaires (Clients grossistes & Fournisseurs demi-gros)
  {
    id: "part-1",
    name: "Maman Sylvie (Épicerie du Marché)",
    phone: "+242 06 633 22 11",
    type: "partner",
    role: "Cliente Farine & Fournisseur Plantains",
    owesMe: 145000,
    iOweHim: 60000,
    lastPaymentDate: "12/10/2026",
    lastPaidByMeDate: "20/09/2026",
    daysSinceLastPayment: 5,
    notes: "Prend 2 sacs de farine par semaine, me livre des régimes de plantains.",
  },
  {
    id: "part-2",
    name: "Boutique La Bénédiction (Moungali)",
    phone: "+242 05 510 44 88",
    type: "partner",
    role: "Client Demi-Gros Huile & Savons",
    owesMe: 220000,
    iOweHim: 0,
    lastPaymentDate: "05/10/2026",
    daysSinceLastPayment: 12,
    notes: "Crédit régulier sur bidons d'huile 25L.",
  },
  {
    id: "part-3",
    name: "Dépôt BRASCO Moukondo",
    phone: "+242 06 700 89 90",
    type: "partner",
    role: "Fournisseur Boissons & Casiers",
    owesMe: 0,
    iOweHim: 180000,
    lastPaymentDate: "10/10/2026",
    lastPaidByMeDate: "25/08/2026",
    daysSinceLastPayment: 7,
    notes: "Facture bières et sucreries livrées le mercredi.",
  },
  {
    id: "part-4",
    name: "Papa Jean-Pierre (Boulangerie Bacongo)",
    phone: "+242 06 555 12 34",
    type: "partner",
    role: "Fournisseur Pain & Client Sucre",
    owesMe: 40000,
    iOweHim: 75000,
    lastPaymentDate: "14/10/2026",
    lastPaidByMeDate: "03/10/2026",
    daysSinceLastPayment: 3,
    notes: "Prend du sucre Saint-Louis, fournit les miches de pain chaque matin.",
  },
  {
    id: "part-5",
    name: "Maman Nicole (Revendeuse Poto-Poto)",
    phone: "+242 05 601 23 45",
    type: "partner",
    role: "Cliente Lait & Boîtes Conserves",
    owesMe: 80000,
    iOweHim: 0,
    lastPaymentDate: "09/09/2026",
    daysSinceLastPayment: 38, // > 30 jours (Tarde à payer)
    notes: "Retard de paiement, relance nécessaire.",
  },
  {
    id: "part-6",
    name: "Kiosque Le Réconfort (Makelekele)",
    phone: "+242 06 888 90 01",
    type: "partner",
    role: "Client Confiserie & Biscuits",
    owesMe: 55000,
    iOweHim: 0,
    lastPaymentDate: "02/09/2026",
    daysSinceLastPayment: 45, // > 30 jours (Tarde à payer)
    notes: "A promis de passer samedi avec Mobile Money.",
  },
  {
    id: "part-7",
    name: "Établissements Okemba & Frères",
    phone: "+242 06 412 77 99",
    type: "partner",
    role: "Fournisseur Riz Parfumé & Sel",
    owesMe: 0,
    iOweHim: 95000,
    lastPaymentDate: "01/10/2026",
    lastPaidByMeDate: "11/09/2026",
    daysSinceLastPayment: 16,
    notes: "Paiement attendu à la fin du mois.",
  },
  {
    id: "part-8",
    name: "Maman Christine (Vendeuse d'œufs)",
    phone: "+242 05 540 66 77",
    type: "partner",
    role: "Fournisseur Alvéoles d'œufs",
    owesMe: 15000,
    iOweHim: 35000,
    lastPaymentDate: "15/10/2026",
    lastPaidByMeDate: "08/10/2026",
    daysSinceLastPayment: 2,
    notes: "Livre 10 alvéoles tous les mardis.",
  },
]

export const INITIAL_MOVEMENTS: Movement[] = [
  {
    id: "mov-1",
    personId: "part-1",
    personName: "Maman Sylvie (Épicerie du Marché)",
    type: "il_m_a_verse",
    label: "Versement reçu — Farine",
    amount: 50000,
    date: "12/10/2026",
    paymentMethod: "momo_mtn",
    reference: "MTN-9823441",
    note: "Versement partiel par MTN MoMo sur sa dette de farine.",
  },
  {
    id: "mov-2",
    personId: "part-1",
    personName: "Maman Sylvie (Épicerie du Marché)",
    type: "il_a_pris_credit",
    label: "A pris à crédit — 2 sacs de farine 50kg",
    amount: 65000,
    date: "08/10/2026",
    paymentMethod: "especes",
    note: "Livré en boutique par Arnaud.",
  },
  {
    id: "mov-3",
    personId: "part-1",
    personName: "Maman Sylvie (Épicerie du Marché)",
    type: "j_ai_pris_credit",
    label: "J'ai pris à crédit — 5 régimes de plantains",
    amount: 30000,
    date: "06/10/2026",
    paymentMethod: "especes",
    note: "Mis en vente au rayon vivres frais.",
  },
  {
    id: "mov-4",
    personId: "emp-2",
    personName: "Michel Kimbembe",
    type: "avance_salaire",
    label: "Avance accordée — Urgence ordonnance",
    amount: 30000,
    date: "02/10/2026",
    paymentMethod: "airtel_money",
    reference: "AIR-451299",
    note: "Plan : retenue de 10 000 FCFA sur les 3 prochaines paies.",
  },
  {
    id: "mov-5",
    personId: "emp-2",
    personName: "Michel Kimbembe",
    type: "remboursement_direct",
    label: "Remboursement direct de sa poche",
    amount: 10000,
    date: "10/10/2026",
    paymentMethod: "especes",
    note: "Il a remboursé 10 000 FCFA après vente d'un bien personnel.",
  },
  {
    id: "mov-6",
    personId: "part-2",
    personName: "Boutique La Bénédiction (Moungali)",
    type: "il_m_a_verse",
    label: "Versement reçu — Huile Mayor",
    amount: 100000,
    date: "05/10/2026",
    paymentMethod: "momo_mtn",
    reference: "MTN-773120",
    note: "Reçu envoyé par WhatsApp.",
  },
  {
    id: "mov-7",
    personId: "emp-1",
    personName: "Grâce Ngoulou",
    type: "je_lui_ai_verse",
    label: "Acompte sur salaire versé",
    amount: 40000,
    date: "15/10/2026",
    paymentMethod: "especes",
    note: "Premier acompte en espèces remis en main propre.",
  },
]
