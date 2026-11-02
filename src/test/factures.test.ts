import { describe, expect, it } from 'vitest'
import { inWords, numberOf, totals, unitFor, defaultProfile, paidByInvoice } from '@/modules/factures/view'

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
  it('net à payer', () => expect(totals({ lines })).toEqual({ net: 1200000 }))
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

describe('Versements sur les factures', () => {
  const f = (id: string, date: string, p: number, extra: object = {}) =>
    ({ id, kind: 'facture', number: id, date, createdAt: date, status: 'non_payee', client: { personId: 'c1', name: 'C', lines: [] }, lines: [{ d: 'x', q: 1, p }], ...extra }) as never
  const pay = (amount: number, date: string, invoiceId?: string) => ({ id: date + amount, clientKey: 'c1', personId: 'c1', clientName: 'C', amount, date, createdAt: date, invoiceId })
  it('la plus ancienne d’abord', () => {
    const m = paidByInvoice([f('a', '2026-10-01', 100000), f('b', '2026-10-05', 50000)], [pay(120000, '2026-10-10')])
    expect(m.get('a')).toBe(100000)
    expect(m.get('b')).toBe(20000)
  })
  it('un versement pour une facture précise', () => {
    const m = paidByInvoice([f('a', '2026-10-01', 100000), f('b', '2026-10-05', 50000)], [pay(50000, '2026-10-10', 'b')])
    expect(m.get('a')).toBe(0)
    expect(m.get('b')).toBe(50000)
  })
  it('une facture déjà marquée payée', () => {
    const m = paidByInvoice([f('a', '2026-10-01', 100000, { status: 'payee' }), f('b', '2026-10-05', 50000)], [pay(30000, '2026-10-10')])
    expect(m.get('a')).toBe(100000)
    expect(m.get('b')).toBe(30000)
  })
})
