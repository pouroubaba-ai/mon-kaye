import { describe, expect, it } from 'vitest'
import { inWords, numberOf, totals, unitFor, defaultProfile } from '@/modules/factures/view'

describe('Montant en lettres', () => {
  it.each([
    [1200000, 'Un million deux cent mille'],
    [450000, 'Quatre cent cinquante mille'],
    [200, 'Deux cents'],
    [200000, 'Deux cent mille'],
    [80, 'Quatre-vingts'],
    [81, 'Quatre-vingt-un'],
    [71, 'Soixante et onze'],
    [91, 'Quatre-vingt-onze'],
    [21, 'Vingt et un'],
    [1000, 'Mille'],
    [2_000_000, 'Deux millions'],
    [1_416_000, 'Un million quatre cent seize mille'],
  ])('%i', (n, s) => expect(inWords(n)).toBe(s))
})

describe('Totaux', () => {
  const lines = [
    { d: 'Pelle', q: 2, u: 'jour', p: 450000 },
    { d: 'Porte-char', q: 1, u: 'forfait', p: 300000 },
  ]
  it('sans TVA', () => expect(totals({ lines, tva: false })).toEqual({ ht: 1200000, tva: 0, net: 1200000 }))
  it('avec TVA 18 %', () => expect(totals({ lines, tva: true })).toEqual({ ht: 1200000, tva: 216000, net: 1416000 }))
})

describe('Numéros et unités', () => {
  it('numéro', () => expect(numberOf({ ...defaultProfile('X', 2026), prefix: 'SB-BTP/2026-', next: 1 }, 'facture')).toBe('SB-BTP/2026-001'))
  it('pluriel', () => {
    expect(unitFor('jour', 2)).toBe('jours')
    expect(unitFor('kg', 3)).toBe('kg')
    expect(unitFor('mois', 3)).toBe('mois')
    expect(unitFor('forfait', 1)).toBe('forfait')
  })
})
