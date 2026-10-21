import * as React from 'react'
import { MessageCircle, Printer } from 'lucide-react'

import { useStore } from '@/data/store'
import { toTime } from '@/data/payroll'
import type { Movement, Person } from '@/data/mockData'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { PAYMENT_LABELS } from '@/components/movement-history'
import { formatFCFA, waNumber } from '@/lib/utils'

// Fiche de compte avec une personne (client, fournisseur…) : comme une feuille de papier,
// les deux côtés l'un après l'autre — son compte (ce qu'il a pris chez moi) et mon compte
// (ce que j'ai pris chez lui) — avec la date et la valeur de chaque crédit, chaque versement
// et chaque retour, puis le reste. À envoyer sur WhatsApp ou à imprimer.

type Side = { title: string; hint: string; credit: Movement['type']; pay: Movement['type']; ret: Movement['type']; reste: number }

const shortDate = (d: string) => `${d.slice(0, 6)}${d.slice(8, 10)}` // 05/10/2026 → 05/10/26

export function StatementDialog({ person, open, onOpenChange }: { person: Person; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { movements, shop } = useStore()
  const mine = movements.filter(m => m.personId === person.id && !m.isCancelled)
  const today = new Date().toLocaleDateString('fr-FR')

  const sides: Side[] = [
    { title: 'Son compte', hint: 'ce qu’il a pris chez moi', credit: 'il_a_pris_credit', pay: 'il_m_a_verse', ret: 'il_a_retourne', reste: person.owesMe || 0 },
    { title: 'Mon compte', hint: 'ce que j’ai pris chez lui', credit: 'j_ai_pris_credit', pay: 'je_lui_ai_verse', ret: 'j_ai_retourne', reste: person.iOweHim || 0 },
  ]
  // Retour : on rappelle le crédit concerné, sa date et sa valeur → « Retour (08/10/26 · 65 000 FCFA) »
  const retourLabel = (m: Movement) => {
    const c = movements.find(x => x.id === m.linkedMovementId)
    return c ? `Retour (${shortDate(c.date)} · ${formatFCFA(c.amount)})` : 'Retour'
  }
  // Lignes d'un côté, de la plus ancienne à la plus récente
  const linesOf = (s: Side) =>
    mine
      .filter(m => m.type === s.credit || m.type === s.pay || m.type === s.ret)
      // Du plus ancien au plus récent ; le même jour, dans l'ordre où ils ont été enregistrés
      // (la liste des opérations est rangée de la plus récente à la plus ancienne)
      .map((m, i) => ({ m, i }))
      .sort((a, b) => toTime(a.m.date) - toTime(b.m.date) || b.i - a.i)
      .map(x => x.m)
      .map(m => ({
        m,
        minus: m.type !== s.credit,
        label:
          m.type === s.credit
            ? (m.label || 'Crédit').replace(/^.*? — /, '') // « A pris à crédit — 2 sacs » → « 2 sacs »
            : m.type === s.ret
              ? retourLabel(m)
              : m.paymentMethod === 'compensation'
                ? 'Compensation'
                : `Versement · ${PAYMENT_LABELS[m.paymentMethod || 'especes']}`,
      }))
  const shown = sides.map(s => ({ s, lines: linesOf(s) })).filter(x => x.lines.length > 0)
  const net = (person.owesMe || 0) - (person.iOweHim || 0)
  const netText =
    net > 0 ? `Au total, il vous doit ${formatFCFA(net)}` : net < 0 ? `Au total, vous lui devez ${formatFCFA(-net)}` : 'Vous êtes quittes'

  const text = [
    `*Fiche de compte*`,
    shop.name,
    `${person.name} · le ${today}`,
    ...shown.flatMap(({ s, lines }) => [
      '',
      `*${s.title.toUpperCase()}* (${s.hint})`,
      ...lines.map(l => `${shortDate(l.m.date)}  ${l.label} : ${l.minus ? '− ' : ''}${formatFCFA(l.m.amount)}`),
      `Reste à payer : ${formatFCFA(s.reste)}`,
    ]),
    '',
    `*${netText}*`,
  ].join('\n')

  const Line = ({ date, left, right, minus }: { date: string; left: string; right: number; minus: boolean }) => (
    <div className="flex items-baseline gap-3 py-1">
      <span className="w-14 shrink-0 text-xs text-neutral-500 tabular-nums">{date}</span>
      <span className="min-w-0 flex-1 break-words">{left}</span>
      <span className={`shrink-0 tabular-nums ${minus ? 'text-neutral-500' : ''}`}>
        {minus ? '− ' : ''}
        {formatFCFA(right)}
      </span>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        {/* À l'impression, seule la feuille sort */}
        <style>{`@media print { body * { visibility: hidden !important } #statement, #statement * { visibility: visible !important } #statement { position: fixed; inset: 0; margin: 0; border: 0; box-shadow: none } }`}</style>
        <div className="flex flex-col gap-4">
          <DialogHeader className="gap-1 p-0">
            <DialogTitle className="text-left">Fiche de compte</DialogTitle>
            <DialogDescription className="text-left">{person.name}</DialogDescription>
          </DialogHeader>

          {/* La feuille */}
          <div id="statement" className="flex flex-col gap-4 rounded-xl bg-white p-4 text-sm text-neutral-900 shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 pb-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{shop.name}</p>
                <p className="text-xs text-neutral-500">Fiche de compte</p>
              </div>
              <p className="shrink-0 text-right text-xs text-neutral-500">Faite le {today}</p>
            </div>

            <div>
              <p className="font-medium">{person.name}</p>
              {(person.role || person.phone) && <p className="text-xs text-neutral-500">{[person.role, person.phone].filter(Boolean).join(' · ')}</p>}
            </div>

            {shown.length === 0 && <p className="text-neutral-500">Aucune opération pour l’instant.</p>}

            {shown.map(({ s, lines }) => (
              <div key={s.title} className="flex flex-col">
                <p className="text-xs font-semibold tracking-wide uppercase">{s.title}</p>
                <p className="mb-1 text-xs text-neutral-500">{s.hint}</p>
                {lines.map(l => (
                  <Line key={l.m.id} date={shortDate(l.m.date)} left={l.label} right={l.m.amount} minus={l.minus} />
                ))}
                <div className="mt-1 flex items-baseline justify-between gap-3 rounded-lg bg-neutral-100 px-3 py-2">
                  <span className="font-medium">Reste à payer</span>
                  <span className="font-semibold tabular-nums">{formatFCFA(s.reste)}</span>
                </div>
              </div>
            ))}

            {shown.length > 0 && <p className="border-t border-neutral-200 pt-3 text-center font-semibold">{netText}</p>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-11" onClick={() => window.open(`https://wa.me/${waNumber(person.phone)}?text=${encodeURIComponent(text)}`, '_blank')}>
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
