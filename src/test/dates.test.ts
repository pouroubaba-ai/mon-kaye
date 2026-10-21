// Dates : périodes de paie et filtres par date.
import { describe, expect, it } from 'vitest'

import { periodBounds, periodFor, LAST_DAY } from '@/data/payroll'
import { inRange, rangeBounds, rangeLabel } from '@/lib/date-range'

const today = new Date(2026, 9, 21) // 21 octobre 2026

describe('Périodes de paie', () => {
  it('payé le 25 : le 21 octobre est dans la période d’octobre (25 sept. → 25 oct.)', () => {
    expect(periodFor(25, today)).toBe('2026-10')
    const { start, end } = periodBounds('2026-10', 25)
    expect(start).toEqual(new Date(2026, 8, 25))
    expect(end).toEqual(new Date(2026, 9, 25))
  })
  it('le jour de l’échéance, la période suivante commence', () => {
    expect(periodFor(25, new Date(2026, 9, 25))).toBe('2026-11')
  })
  it('dernier jour du mois : février a 28 jours', () => {
    expect(periodBounds('2027-02', LAST_DAY).end).toEqual(new Date(2027, 1, 28))
  })
  it('décembre → janvier de l’année suivante', () => {
    expect(periodFor(10, new Date(2026, 11, 15))).toBe('2027-01')
  })
})

describe('Filtre par date', () => {
  it('Ce mois', () => {
    expect(inRange('01/10/2026', { key: 'mois' }, today)).toBe(true)
    expect(inRange('30/09/2026', { key: 'mois' }, today)).toBe(false)
  })
  it('Le mois dernier porte le nom du mois', () => {
    expect(rangeLabel({ key: 'mois_prec' }, today)).toBe('Septembre')
    expect(inRange('30/09/2026', { key: 'mois_prec' }, today)).toBe(true)
  })
  it('7 derniers jours (aujourd’hui compris)', () => {
    expect(inRange('15/10/2026', { key: '7j' }, today)).toBe(true)
    expect(inRange('14/10/2026', { key: '7j' }, today)).toBe(false)
  })
  it('Du … au … dans le mauvais ordre est remis dans l’ordre', () => {
    const r = { key: 'perso' as const, from: '2026-10-10', to: '2026-10-01' }
    expect(rangeBounds(r, today).start).toEqual(new Date(2026, 9, 1))
    expect(inRange('05/10/2026', r, today)).toBe(true)
  })
})
