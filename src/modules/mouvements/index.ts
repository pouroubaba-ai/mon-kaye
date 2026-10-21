/**
 * Module Mouvements : ce qui sert à toutes les opérations (dates, identifiants, export).
 * Les autres modules ne passent que par ce qui est exporté ici.
 */
import type { Movement } from '@/data/mockData'

export type { Movement, MovementItem } from '@/data/mockData'

// Date du jour au format des opérations : jj/mm/aaaa
export const todayStr = (d = new Date()) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`

// « jj/mm/aaaa hh:mm » (heure d'une annulation)
export const nowStamp = (d = new Date()) => `${todayStr(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

// Identifiant unique, même pour deux opérations enregistrées dans la même milliseconde
export const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

// Barrer une opération (jamais de suppression)
export const markCancelled = (m: Movement, reason: string, at: string): Movement => ({
  ...m,
  isCancelled: true,
  cancellationReason: reason,
  cancelledAt: at,
})

// Export de toutes les opérations en fichier CSV (tableur)
export function movementsCsv(movements: Movement[]) {
  let csv = 'ID;Type;Personne;Montant FCFA;Date;Moyen Paiement;Annule;Note\n'
  for (const m of movements) {
    csv += `${m.id};${m.type};"${m.personName}";${m.amount};${m.date};${m.paymentMethod || 'non précisé'};${m.isCancelled ? 'OUI' : 'NON'};"${(m.note || '').replace(/"/g, '""')}"\n`
  }
  return csv
}

export function downloadCsv(movements: Movement[]) {
  const blob = new Blob([movementsCsv(movements)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `Carnet_Export_${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
