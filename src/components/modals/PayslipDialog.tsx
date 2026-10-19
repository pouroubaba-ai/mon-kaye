import * as React from 'react'
import { MessageCircle, Printer } from 'lucide-react'

import { useStore } from '@/data/store'
import { payrollOf, periodLong, currentPeriod } from '@/data/payroll'
import type { Movement } from '@/data/mockData'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { PAYMENT_LABELS } from '@/components/movement-history'
import { formatFCFA } from '@/lib/utils'

// Fiche de paie d'un mois : comme une feuille de papier (fond blanc), à envoyer sur WhatsApp
// ou à imprimer (ou enregistrer en PDF depuis l'impression).

const ORDER: Record<string, number> = { salaire_du: 0, ajout_salaire: 1, retenue_salaire: 2, retenue_manuelle: 3 }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function PayslipDialog({ empId, period, open, onOpenChange }: { empId: string; period: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { persons, movements, monthStates, shop } = useStore()
  const emp = persons.find(p => p.id === empId)
  if (!emp) return null
  const pr = payrollOf(empId, movements, monthStates)
  const row = pr.months.find(m => m.period === period)
  if (!row) return null

  const planned = row.state === 'en_cours' && period === currentPeriod()
  // Lignes du mois (sans les lignes annulées) ; la retenue prévue compte pour ce qu'elle vaut vraiment
  const lines = row.items
    .filter(m => !m.isCancelled)
    .sort((a, b) => (ORDER[a.type] ?? 9) - (ORDER[b.type] ?? 9))
    .map(m => ({
      m,
      amount: planned && m.type === 'retenue_salaire' ? pr.plannedRetenue : m.amount,
      sign: m.type === 'ajout_salaire' ? '+' : m.type === 'salaire_du' ? '' : '−',
    }))
    .filter(l => l.amount > 0)
  const label = (m: Movement) => (m.type === 'retenue_salaire' && planned ? `${m.label} (prévue)` : m.label)
  const month = cap(periodLong(period))
  const today = new Date().toLocaleDateString('fr-FR')
  const payDate = (m: Movement) => m.date.slice(0, 5)

  const text = [
    `*Fiche de paie · ${month}*`,
    shop.name,
    `${emp.name}${emp.role ? ` (${emp.role})` : ''}`,
    '',
    ...lines.map(l => `${l.sign ? `${l.sign} ` : ''}${label(l.m)} : ${formatFCFA(l.amount)}`),
    `*À payer : ${formatFCFA(row.aPayer)}*`,
    ...row.paymentParts.map(p => `Versé le ${payDate(p.mov)} : ${formatFCFA(p.amount)}`),
    `*Reste à payer : ${formatFCFA(row.reste)}*`,
    ...(pr.advanceReste > 0 ? ['', `Avance encore à rendre : ${formatFCFA(pr.advanceReste)}`] : []),
  ].join('\n')

  const sendWhatsApp = () => {
    const phone = (emp.phone || '').replace(/\D/g, '')
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank')
  }

  const Line = ({ left, right, strong, muted }: { left: React.ReactNode; right: string; strong?: boolean; muted?: boolean }) => (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${strong ? 'font-semibold' : ''} ${muted ? 'text-neutral-500' : ''}`}>
      <span className="min-w-0">{left}</span>
      <span className="shrink-0 tabular-nums">{right}</span>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        {/* À l'impression, seule la feuille sort */}
        <style>{`@media print { body * { visibility: hidden !important } #payslip, #payslip * { visibility: visible !important } #payslip { position: fixed; inset: 0; margin: 0; border: 0; box-shadow: none } }`}</style>
        <div className="flex flex-col gap-4">
          <DialogHeader className="gap-1 p-0">
            <DialogTitle className="text-left">Fiche de paie</DialogTitle>
            <DialogDescription className="text-left">
              {emp.name} · {month}
            </DialogDescription>
          </DialogHeader>

          {/* La feuille */}
          <div id="payslip" className="flex flex-col gap-4 rounded-xl bg-white p-4 text-sm text-neutral-900 shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 pb-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{shop.name}</p>
                <p className="text-xs text-neutral-500">Fiche de paie</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold">{month}</p>
                <p className="text-xs text-neutral-500">Faite le {today}</p>
              </div>
            </div>

            <div>
              <p className="font-medium">{emp.name}</p>
              {(emp.role || emp.phone) && <p className="text-xs text-neutral-500">{[emp.role, emp.phone].filter(Boolean).join(' · ')}</p>}
            </div>

            <div className="flex flex-col">
              {lines.map(l => (
                <Line key={l.m.id} left={label(l.m)} right={`${l.sign ? `${l.sign} ` : ''}${formatFCFA(l.amount)}`} />
              ))}
              <div className="mt-1 border-t border-neutral-300 pt-1">
                <Line left="À payer" right={formatFCFA(row.aPayer)} strong />
              </div>
            </div>

            {row.paymentParts.length > 0 && (
              <div className="flex flex-col">
                {row.paymentParts.map((p, i) => (
                  <Line
                    key={`${p.mov.id}-${i}`}
                    left={`Versé le ${payDate(p.mov)} · ${PAYMENT_LABELS[p.mov.paymentMethod || 'especes']}`}
                    right={formatFCFA(p.amount)}
                    muted
                  />
                ))}
              </div>
            )}

            <div className="flex items-baseline justify-between gap-3 rounded-lg bg-neutral-100 px-3 py-2">
              <span className="font-medium">Reste à payer</span>
              <span className="text-base font-semibold tabular-nums">{formatFCFA(row.reste)}</span>
            </div>

            {pr.advanceReste > 0 && <p className="text-xs text-neutral-500">Avance encore à rendre : {formatFCFA(pr.advanceReste)}</p>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-11" onClick={sendWhatsApp}>
              <MessageCircle /> WhatsApp
            </Button>
            <Button variant="outline" className="h-11" onClick={() => window.print()}>
              <Printer /> Imprimer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
