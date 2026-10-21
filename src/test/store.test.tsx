// Filet de sécurité : ces tests jouent des scénarios du comptoir sur le « cerveau » de l'app
// (le store) et vérifient les soldes. Ils doivent donner les mêmes résultats avant et après
// chaque changement du code. Lancer : npm test
import * as React from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { StoreProvider, useStore, type StoreData } from '@/data/store'
import { payrollOf } from '@/data/payroll'

const EMPTY: StoreData = { shop: { name: 'Boutique test', modules: { personnes: true, employes: true } }, persons: [], movements: [], monthStates: {} }

let clock = new Date(2026, 9, 21, 10, 0, 0).getTime() // 21 octobre 2026, 10 h
const tick = () => vi.setSystemTime((clock += 1000)) // chaque action une seconde plus tard

function setup(data: StoreData = EMPTY) {
  const wrapper = ({ children }: { children: React.ReactNode }) => <StoreProvider data={data}>{children}</StoreProvider>
  const r = renderHook(() => useStore(), { wrapper })
  const run = (f: (s: ReturnType<typeof useStore>) => unknown) => {
    tick()
    let out: unknown
    act(() => {
      out = f(r.result.current)
    })
    return out
  }
  const person = (id: string) => r.result.current.persons.find(p => p.id === id)!
  const movs = (id: string) => r.result.current.movements.filter(m => m.personId === id)
  return { r, run, person, movs }
}

beforeEach(() => {
  clock = new Date(2026, 9, 21, 10, 0, 0).getTime()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clock)
  window.history.replaceState(null, '', '/')
})
afterEach(() => vi.useRealTimers())

const partner = (s: ReturnType<typeof setup>, name = 'Maman Sylvie') =>
  s.run(st => st.addPerson({ type: 'partner', name, phone: '06 000 00 00' })) as string
const op = (s: ReturnType<typeof setup>, personId: string, type: string, amount: number, extra: object = {}) =>
  s.run(st => st.addMovement({ personId, personName: 'x', type: type as never, label: type, amount, paymentMethod: 'especes', ...extra }))

describe('Partenaires : crédits, versements, retours', () => {
  it('un crédit puis un versement', () => {
    const s = setup()
    const id = partner(s)
    op(s, id, 'il_a_pris_credit', 65000)
    expect(s.person(id).owesMe).toBe(65000)
    op(s, id, 'il_m_a_verse', 25000)
    expect(s.person(id).owesMe).toBe(40000)
    expect(s.person(id).iOweHim).toBe(0)
  })

  it('ma dette puis mon versement', () => {
    const s = setup()
    const id = partner(s)
    op(s, id, 'j_ai_pris_credit', 40000)
    op(s, id, 'je_lui_ai_verse', 15000)
    expect(s.person(id).iOweHim).toBe(25000)
  })

  it('annuler un versement remet le compte', () => {
    const s = setup()
    const id = partner(s)
    op(s, id, 'il_a_pris_credit', 50000)
    op(s, id, 'il_m_a_verse', 20000)
    const v = s.movs(id).find(m => m.type === 'il_m_a_verse')!
    s.run(st => st.cancelMovement(v.id, 'Erreur'))
    expect(s.person(id).owesMe).toBe(50000)
    expect(s.movs(id).find(m => m.id === v.id)?.isCancelled).toBe(true)
  })

  it('un retour baisse le compte ; annuler le crédit emporte le retour', () => {
    const s = setup()
    const id = partner(s)
    op(s, id, 'il_a_pris_credit', 60000)
    const credit = s.movs(id).find(m => m.type === 'il_a_pris_credit')!
    s.run(st => st.addReturn(credit.id, 10000))
    expect(s.person(id).owesMe).toBe(50000)
    s.run(st => st.cancelMovement(credit.id, 'Erreur'))
    expect(s.person(id).owesMe).toBe(0)
    expect(s.movs(id).find(m => m.type === 'il_a_retourne')?.isCancelled).toBe(true)
  })

  it('annuler un crédit déjà payé : le trop versé passe dans l’autre compte', () => {
    const s = setup()
    const id = partner(s)
    op(s, id, 'il_a_pris_credit', 50000)
    op(s, id, 'il_m_a_verse', 50000)
    const credit = s.movs(id).find(m => m.type === 'il_a_pris_credit')!
    s.run(st => st.cancelMovement(credit.id, 'Erreur', 'plus_tard'))
    expect(s.person(id).owesMe).toBe(0)
    expect(s.person(id).iOweHim).toBe(50000)
    expect(s.movs(id).some(m => m.label === 'Trop versé : à lui rendre' && m.amount === 50000)).toBe(true)
  })

  it('trop versé déjà rendu : rien ne reste', () => {
    const s = setup()
    const id = partner(s)
    op(s, id, 'il_a_pris_credit', 30000)
    op(s, id, 'il_m_a_verse', 30000)
    const credit = s.movs(id).find(m => m.type === 'il_a_pris_credit')!
    s.run(st => st.cancelMovement(credit.id, 'Erreur', 'deja_rendu'))
    expect(s.person(id).owesMe).toBe(0)
    expect(s.person(id).iOweHim).toBe(0)
  })
})

describe('Partenaires : compensation', () => {
  it('compenser puis annuler la compensation (les deux côtés)', () => {
    const s = setup()
    const id = partner(s)
    op(s, id, 'il_a_pris_credit', 65000)
    op(s, id, 'j_ai_pris_credit', 40000)
    s.run(st => st.applyCompensation(id))
    expect(s.person(id).owesMe).toBe(25000)
    expect(s.person(id).iOweHim).toBe(0)
    const comp = s.movs(id).filter(m => m.paymentMethod === 'compensation')
    expect(comp).toHaveLength(2)
    expect(comp.map(m => m.type).sort()).toEqual(['il_m_a_verse', 'je_lui_ai_verse'])
    // annuler un des deux annule l'autre
    s.run(st => st.cancelMovement(comp[0].id, 'Erreur'))
    expect(s.movs(id).filter(m => m.paymentMethod === 'compensation').every(m => m.isCancelled)).toBe(true)
    expect(s.person(id).owesMe).toBe(65000)
    expect(s.person(id).iOweHim).toBe(40000)
  })

  it('rien à compenser : rien ne change', () => {
    const s = setup()
    const id = partner(s)
    op(s, id, 'il_a_pris_credit', 10000)
    s.run(st => st.applyCompensation(id))
    expect(s.person(id).owesMe).toBe(10000)
    expect(s.movs(id)).toHaveLength(1)
  })
})

describe('Personnes : ajout, modification, suppression', () => {
  it('modifier le nom le recopie dans les opérations ; supprimer efface tout', () => {
    const s = setup()
    const id = partner(s)
    op(s, id, 'il_a_pris_credit', 1000)
    s.run(st => st.updatePerson(id, { name: 'Maman Sylvie 2' }))
    expect(s.person(id).name).toBe('Maman Sylvie 2')
    expect(s.movs(id).every(m => m.personName === 'Maman Sylvie 2')).toBe(true)
    s.run(st => st.deletePerson(id))
    expect(s.r.result.current.persons.find(p => p.id === id)).toBeUndefined()
    expect(s.movs(id)).toHaveLength(0)
  })

  it('deux personnes ajoutées à la suite ont deux identifiants différents', () => {
    const s = setup()
    const a = partner(s, 'A')
    const b = partner(s, 'B')
    expect(a).not.toBe(b)
  })
})

describe('Employés : paie et avances', () => {
  const employee = (s: ReturnType<typeof setup>, extra: object = {}) =>
    s.run(st => st.addPerson({ type: 'employee', name: 'Junior', phone: '06', salary: 100000, dueDay: 25, ...extra })) as string

  it('nouvel employé payé le 25 : rien à payer avant l’échéance', () => {
    const s = setup()
    const id = employee(s)
    expect(s.person(id).currentSalaryDue).toBe(0)
    const pr = payrollOf(id, s.r.result.current.movements, s.r.result.current.monthStates)
    expect(pr.currentPeriod).toBe('2026-10')
    expect(pr.months[0].brut).toBe(100000)
    expect(pr.upcoming).toBe(100000)
  })

  it('avance puis remboursement direct', () => {
    const s = setup()
    const id = employee(s)
    op(s, id, 'avance_salaire', 30000)
    expect(s.person(id).advanceBalance).toBe(30000)
    op(s, id, 'remboursement_direct', 10000)
    expect(s.person(id).advanceBalance).toBe(20000)
    expect(s.person(id).lastAdvanceRepaymentDate).toBe('21/10/2026')
  })

  it('anciennes avances et retenue par mois : la retenue est seulement prévue', () => {
    const s = setup()
    const id = employee(s, { advance: 50000, perMonth: 10000 })
    expect(s.person(id).advanceBalance).toBe(50000)
    const pr = payrollOf(id, s.r.result.current.movements, s.r.result.current.monthStates)
    expect(pr.plannedRetenue).toBe(10000)
    s.run(st => st.setMonthRetenue(id, 20000))
    expect(payrollOf(id, s.r.result.current.movements, s.r.result.current.monthStates).plannedRetenue).toBe(20000)
  })

  it('ancien compte : ce qu’on lui devait s’ajoute au salaire de la période', () => {
    const s = setup()
    const id = employee(s, { oldDebt: 15000 })
    const pr = payrollOf(id, s.r.result.current.movements, s.r.result.current.monthStates)
    expect(pr.months[0].brut).toBe(115000)
  })

  it('arrêter le mois en cours', () => {
    const s = setup()
    const id = employee(s)
    s.run(st => st.stopMonth(id, '2026-10', 60000, '18 jours'))
    const pr = payrollOf(id, s.r.result.current.movements, s.r.result.current.monthStates)
    const row = pr.months.find(m => m.period === '2026-10')!
    expect(row.state).toBe('arrete')
    expect(row.reste).toBe(60000)
    expect(s.person(id).currentSalaryDue).toBe(60000)
  })

  it('départ avec avance retenue sur le salaire', () => {
    const s = setup()
    const id = employee(s)
    op(s, id, 'avance_salaire', 20000)
    s.run(st => st.processDeparture(id, 60000, '18 jours', 'retenir'))
    expect(s.person(id).status).toBe('inactif')
    expect(s.person(id).advanceBalance).toBe(0)
    expect(s.person(id).currentSalaryDue).toBe(40000)
  })
})

describe('Totaux du tableau de bord', () => {
  it('additionnent partenaires et employés', () => {
    const s = setup()
    const a = partner(s, 'A')
    const b = partner(s, 'B')
    op(s, a, 'il_a_pris_credit', 10000)
    op(s, b, 'il_a_pris_credit', 5000)
    op(s, b, 'j_ai_pris_credit', 7000)
    const t = s.r.result.current.totals
    expect(t.partnersOwesMe).toBe(15000)
    expect(t.partnersIOwe).toBe(7000)
    expect(t.totalOwesMe).toBe(15000)
  })
})
