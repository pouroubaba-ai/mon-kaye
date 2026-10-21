// Règles des comptes partenaires, sans écran : fonctions du module Personnes.
import { describe, expect, it } from 'vitest'

import type { Movement, Person } from '@/data/mockData'
import { applyMovement, planCancel, planCompensation, planReturn, reduceAccount } from '@/modules/personnes'

const p = (owesMe = 0, iOweHim = 0): Person => ({ id: 'p1', name: 'Sylvie', phone: '', type: 'partner', owesMe, iOweHim })
const m = (type: Movement['type'], amount: number, extra: Partial<Movement> = {}): Movement => ({
  id: `m-${type}-${amount}`, personId: 'p1', personName: 'Sylvie', type, label: type, amount, date: '21/10/2026', ...extra,
})

describe('Comptes partenaires', () => {
  it('un versement plus grand que le reste ne passe pas sous zéro', () => {
    expect(applyMovement(p(10000), m('il_m_a_verse', 15000)).owesMe).toBe(0)
  })
  it('réduire un compte sous zéro : la différence change de côté (plus tard)', () => {
    const r = reduceAccount(p(10000, 0), 'lui', 15000, 'plus_tard')
    expect(r.excess).toBe(5000)
    expect(r.updated.owesMe).toBe(0)
    expect(r.updated.iOweHim).toBe(5000)
  })
  it('déjà rendu : la différence ne change pas de côté', () => {
    const r = reduceAccount(p(10000, 0), 'lui', 15000, 'deja_rendu')
    expect(r.updated.iOweHim).toBe(0)
  })
  it('compensation : le plus petit des deux montants', () => {
    const r = planCompensation(p(65000, 40000), '21/10/2026', 1)!
    expect(r.person.owesMe).toBe(25000)
    expect(r.person.iOweHim).toBe(0)
    expect(r.added.map(x => x.amount)).toEqual([40000, 40000])
    expect(r.added[0].linkedMovementId).toBe(r.added[1].id)
  })
  it('rien à compenser', () => {
    expect(planCompensation(p(65000, 0), '21/10/2026', 1)).toBeNull()
  })
  it('annuler une compensation barre les deux versements', () => {
    const c = planCompensation(p(65000, 40000), '21/10/2026', 1)!
    const plan = planCancel(c.added, c.person, c.added[0], 'Erreur', undefined, '21/10/2026', 2)
    expect(Object.keys(plan.marks).sort()).toEqual(c.added.map(x => x.id).sort())
    expect(plan.person.owesMe).toBe(65000)
    expect(plan.person.iOweHim).toBe(40000)
  })
  it('un retour sur un crédit', () => {
    const credit = m('il_a_pris_credit', 60000)
    const r = planReturn(p(60000), credit, 10000, undefined, '21/10/2026', 1)
    expect(r.person.owesMe).toBe(50000)
    expect(r.added.at(-1)?.type).toBe('il_a_retourne')
    expect(r.added.at(-1)?.linkedMovementId).toBe(credit.id)
  })
})
