import * as React from 'react'
import { Download, Share2 } from 'lucide-react'

import { useStore } from '@/data/store'
import { toTime } from '@/data/payroll'
import type { Movement, Person } from '@/data/mockData'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { PAYMENT_LABELS } from '@/components/movement-history'
import { formatFCFA } from '@/lib/utils'

// Fiche de compte avec une personne (client, fournisseur…), comme une feuille de papier :
// 1. en-tête : la boutique, « Fiche de compte », la date ; le client dans un encadré ;
// 2. pour chaque compte (son compte, puis mon compte) : un résumé Total · Versé · Reste,
//    puis un tableau Date · Opération · Montant · Solde (ce qui reste après chaque ligne) ;
// 3. le total final dans un bandeau.
// Envoyée en PDF : le partage du téléphone s'ouvre (WhatsApp, e-mail…), ou le PDF est téléchargé.

type Side = { title: string; hint: string; credit: Movement['type']; pay: Movement['type']; ret: Movement['type']; reste: number }
type Row = { m: Movement; minus: boolean; label: string; solde: number; off: boolean }

const shortDate = (d: string) => `${d.slice(0, 6)}${d.slice(8, 10)}` // 05/10/2026 → 05/10/26
const amount = (v: number) => formatFCFA(v).replace(/\s?FCFA$/, '')
// Pour le PDF : espaces ordinaires (les polices du PDF ne connaissent pas l'espace fine) et vrai signe moins
const pdfText = (s: string) => s.replace(/[  ]/g, ' ').replace(/−/g, '-')

export function StatementDialog({ person, open, onOpenChange }: { person: Person; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { movements, shop } = useStore()
  const [busy, setBusy] = React.useState(false)
  // Les versements annulés restent sur la fiche (barrés, sans changer le solde) ; les autres annulés n'y sont pas.
  const isPay = (m: Movement) => m.type === 'il_m_a_verse' || m.type === 'je_lui_ai_verse'
  const mine = movements.filter(m => m.personId === person.id && (!m.isCancelled || isPay(m)))
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
  // Lignes d'un côté, de la plus ancienne à la plus récente, avec le solde après chaque ligne
  const linesOf = (s: Side): Row[] => {
    let solde = 0
    return mine
      .filter(m => m.type === s.credit || m.type === s.pay || m.type === s.ret)
      // le même jour : dans l'ordre où elles ont été enregistrées (la liste est de la plus récente à la plus ancienne)
      .map((m, i) => ({ m, i }))
      .sort((a, b) => toTime(a.m.date) - toTime(b.m.date) || b.i - a.i)
      .map(({ m }) => {
        const minus = m.type !== s.credit
        const off = !!m.isCancelled
        if (!off) solde = Math.max(0, solde + (minus ? -m.amount : m.amount))
        const label =
          m.type === s.credit
            ? (m.label || 'Crédit').replace(/^.*? — /, '') // « A pris à crédit — 2 sacs » → « 2 sacs »
            : m.type === s.ret
              ? retourLabel(m)
              : m.paymentMethod === 'compensation'
                ? off
                  ? 'Compensation (annulée)'
                  : 'Compensation'
                : off
                  ? 'Versement (annulé)'
                  : `Versement · ${PAYMENT_LABELS[m.paymentMethod || 'especes']}`
        return { m, minus, label, solde, off }
      })
  }
  const shown = sides
    .map(s => {
      const lines = linesOf(s)
      const sum = (t: Movement['type']) => lines.filter(l => l.m.type === t && !l.off).reduce((a, l) => a + l.m.amount, 0)
      return { s, lines, total: sum(s.credit), verse: sum(s.pay), retours: sum(s.ret) }
    })
    .filter(x => x.lines.length > 0)
  const net = (person.owesMe || 0) - (person.iOweHim || 0)
  const netText = net > 0 ? `Au total, il vous doit ${formatFCFA(net)}` : net < 0 ? `Au total, vous lui devez ${formatFCFA(-net)}` : 'Vous êtes quittes'

  // ——— Le PDF (A4), dessiné ligne par ligne ———
  const makePdf = async () => {
    const { jsPDF } = await import('jspdf') // chargé seulement quand on en a besoin
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const W = 210
    const M = 16
    let y = 18
    const gold: [number, number, number] = [185, 130, 31]
    const grey: [number, number, number] = [110, 114, 120]
    const txt = (s: string, x: number, yy: number, o?: { align?: 'left' | 'right' | 'center'; size?: number; bold?: boolean; color?: [number, number, number] }) => {
      doc.setFont('helvetica', o?.bold ? 'bold' : 'normal')
      doc.setFontSize(o?.size ?? 10)
      doc.setTextColor(...(o?.color ?? [20, 20, 22]))
      doc.text(pdfText(s), x, yy, { align: o?.align ?? 'left' })
    }
    const page = (need: number) => {
      if (y + need > 285) {
        doc.addPage()
        y = 18
      }
    }
    // En-tête
    doc.setFillColor(11, 12, 15)
    doc.rect(0, 0, W, 34, 'F')
    txt(shop.name, M, 15, { size: 16, bold: true, color: [242, 244, 247] })
    txt('Fiche de compte', M, 23, { size: 11, color: [242, 193, 78] })
    txt(`Faite le ${today}`, W - M, 15, { align: 'right', size: 9, color: [185, 190, 198] })
    y = 44
    // Le client
    doc.setDrawColor(225, 227, 230)
    doc.setFillColor(247, 248, 249)
    doc.roundedRect(M, y, W - 2 * M, 18, 2, 2, 'FD')
    txt(person.name, M + 5, y + 7.5, { size: 12, bold: true })
    const info = [person.role, person.phone].filter(Boolean).join(' · ')
    if (info) txt(info, M + 5, y + 13.5, { size: 9, color: grey })
    y += 28
    if (shown.length === 0) txt('Aucune opération pour l’instant.', M, y, { color: grey })
    for (const { s, lines, total, verse, retours } of shown) {
      page(40)
      txt(s.title.toUpperCase(), M, y, { size: 11, bold: true })
      txt(s.hint, M + doc.getTextWidth(pdfText(s.title.toUpperCase())) + 4, y, { size: 9, color: grey })
      y += 5
      // Résumé : Total · Versé (· Retours) · Reste
      const boxes: [string, number, boolean?][] = [['Total', total], ['Versé', verse], ...(retours ? ([['Retours', retours]] as [string, number][]) : []), ['Reste', s.reste, true]]
      const bw = (W - 2 * M - (boxes.length - 1) * 3) / boxes.length
      boxes.forEach(([label, v, strong], i) => {
        const x = M + i * (bw + 3)
        if (strong) doc.setFillColor(253, 246, 226)
        else doc.setFillColor(247, 248, 249)
        doc.roundedRect(x, y, bw, 15, 2, 2, 'F')
        txt(label, x + 4, y + 5.5, { size: 8, color: grey })
        txt(formatFCFA(v), x + 4, y + 11.5, { size: 11, bold: true, color: strong ? gold : [20, 20, 22] })
      })
      y += 21
      // Tableau
      const cx = { date: M + 2, op: M + 22, mt: W - M - 34, so: W - M - 2 }
      doc.setFillColor(11, 12, 15)
      doc.rect(M, y, W - 2 * M, 7, 'F')
      txt('Date', cx.date, y + 4.8, { size: 8, bold: true, color: [242, 244, 247] })
      txt('Opération', cx.op, y + 4.8, { size: 8, bold: true, color: [242, 244, 247] })
      txt('Montant', cx.mt, y + 4.8, { size: 8, bold: true, color: [242, 244, 247], align: 'right' })
      txt('Solde', cx.so, y + 4.8, { size: 8, bold: true, color: [242, 244, 247], align: 'right' })
      y += 7
      lines.forEach((l, i) => {
        page(8)
        if (i % 2 === 1) {
          doc.setFillColor(247, 248, 249)
          doc.rect(M, y, W - 2 * M, 7, 'F')
        }
        const green: [number, number, number] = [22, 128, 61]
        let label = pdfText(l.label)
        doc.setFontSize(9)
        while (doc.getTextWidth(label) > cx.mt - cx.op - 30 && label.length > 4) label = label.slice(0, -2)
        if (label !== pdfText(l.label)) label = label.trimEnd() + '…'
        txt(shortDate(l.m.date), cx.date, y + 4.8, { size: 9, color: grey })
        txt(label, cx.op, y + 4.8, { size: 9, color: l.off ? grey : undefined })
        const mt = `${l.minus ? '- ' : ''}${amount(l.m.amount)}`
        txt(mt, cx.mt, y + 4.8, { size: 9, align: 'right', color: l.off ? grey : l.minus ? green : [20, 20, 22] })
        if (l.off) {
          // montant barré : le versement annulé ne compte pas
          doc.setDrawColor(...grey)
          doc.setLineWidth(0.3)
          doc.line(cx.mt - doc.getTextWidth(pdfText(mt)) - 0.5, y + 3.6, cx.mt + 0.5, y + 3.6)
        }
        txt(amount(l.solde), cx.so, y + 4.8, { size: 9, align: 'right', bold: true })
        y += 7
      })
      y += 10
    }
    // Bandeau final
    if (shown.length > 0) {
      page(18)
      doc.setFillColor(11, 12, 15)
      doc.roundedRect(M, y, W - 2 * M, 14, 2, 2, 'F')
      txt(netText, W / 2, y + 9, { align: 'center', size: 12, bold: true, color: [242, 193, 78] })
      y += 22
    }
    txt('Fait avec Kayé · mon-kaye.vercel.app', W / 2, 290, { align: 'center', size: 8, color: grey })
    return doc
  }
  const fileName = `Fiche de compte - ${person.name}.pdf`.replace(/[\\/:*?"<>|]/g, '')

  // Envoyer : le partage du téléphone (WhatsApp, e-mail…) ; sinon, téléchargement
  const share = async () => {
    setBusy(true)
    try {
      const doc = await makePdf()
      const file = new File([doc.output('blob')], fileName, { type: 'application/pdf' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Fiche de compte' }).catch(() => {})
      } else doc.save(fileName)
    } finally {
      setBusy(false)
    }
  }
  const download = async () => {
    setBusy(true)
    try {
      ;(await makePdf()).save(fileName)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <div className="flex flex-col gap-4">
          <DialogHeader className="gap-1 p-0">
            <DialogTitle className="text-left">Fiche de compte</DialogTitle>
            <DialogDescription className="text-left">{person.name}</DialogDescription>
          </DialogHeader>

          {/* La feuille */}
          <div className="overflow-hidden rounded-xl bg-white text-sm text-neutral-900 shadow-sm">
            <div className="flex items-start justify-between gap-3 bg-[#0B0C0F] px-4 py-3.5">
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{shop.name}</p>
                <p className="text-xs text-[#F2C14E]">Fiche de compte</p>
              </div>
              <p className="shrink-0 text-right text-[11px] text-neutral-400">Faite le {today}</p>
            </div>

            <div className="flex flex-col gap-4 p-4">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                <p className="font-semibold">{person.name}</p>
                {(person.role || person.phone) && <p className="text-xs text-neutral-500">{[person.role, person.phone].filter(Boolean).join(' · ')}</p>}
              </div>

              {shown.length === 0 && <p className="text-neutral-500">Aucune opération pour l’instant.</p>}

              {shown.map(({ s, lines, total, verse, retours }) => (
                <div key={s.title} className="flex flex-col gap-2">
                  <p className="text-xs font-semibold tracking-wide uppercase">
                    {s.title} <span className="font-normal tracking-normal normal-case text-neutral-500">{s.hint}</span>
                  </p>
                  {/* Résumé */}
                  <div className={`grid gap-1.5 ${retours ? 'grid-cols-4' : 'grid-cols-3'}`}>
                    {([['Total', total], ['Versé', verse], ...(retours ? [['Retours', retours]] : []), ['Reste', s.reste]] as [string, number][]).map(([label, v], i, arr) => (
                      <div key={label} className={`rounded-lg px-2 py-1.5 ${i === arr.length - 1 ? 'bg-amber-50' : 'bg-neutral-100'}`}>
                        <p className="text-[10px] text-neutral-500">{label}</p>
                        <p className={`text-xs font-bold tabular-nums ${i === arr.length - 1 ? 'text-amber-700' : ''}`}>{amount(v)}</p>
                      </div>
                    ))}
                  </div>
                  {/* Tableau */}
                  <div className="overflow-hidden rounded-lg border border-neutral-200 text-xs">
                    <div className="grid grid-cols-[3.2rem_1fr_auto_auto] gap-2 bg-[#0B0C0F] px-2 py-1.5 font-semibold text-white">
                      <span>Date</span>
                      <span>Opération</span>
                      <span className="text-right">Montant</span>
                      <span className="w-14 text-right">Solde</span>
                    </div>
                    {lines.map((l, i) => (
                      <div key={l.m.id} className={`grid grid-cols-[3.2rem_1fr_auto_auto] items-baseline gap-2 px-2 py-1.5 ${i % 2 ? 'bg-neutral-50' : ''}`}>
                        <span className="text-neutral-500 tabular-nums">{shortDate(l.m.date)}</span>
                        <span className={`min-w-0 break-words ${l.off ? 'text-neutral-500' : ''}`}>{l.label}</span>
                        <span className={`text-right tabular-nums ${l.off ? 'text-neutral-400 line-through' : l.minus ? 'text-green-700' : ''}`}>
                          {l.minus ? '− ' : ''}
                          {amount(l.m.amount)}
                        </span>
                        <span className="w-14 text-right font-semibold tabular-nums">{amount(l.solde)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {shown.length > 0 && <p className="rounded-lg bg-[#0B0C0F] px-3 py-2.5 text-center font-semibold text-[#F2C14E]">{netText}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button className="h-11" disabled={busy} onClick={share}>
              <Share2 /> Envoyer le PDF
            </Button>
            <Button variant="outline" className="h-11" disabled={busy} onClick={download}>
              <Download /> Télécharger
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
