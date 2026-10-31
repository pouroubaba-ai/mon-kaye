// ——— La facture elle-même (feuille A4) ———
// Même dessin que le modèle envoyé : logo, émetteur, client, objet, lignes, net à payer, montant en lettres,
// mentions, signature, pied de page. Couleurs fixes (une facture reste blanche, même en thème sombre).
// Sert à l'aperçu (réduit) et au PDF (photographié en grand).
import '@fontsource/tinos/400.css'
import '@fontsource/tinos/700.css'
import '@fontsource/tinos/400-italic.css'
import '@fontsource/arimo/400.css'
import '@fontsource/arimo/700.css'
import '@fontsource/arimo/400-italic.css'
import React from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import type { Invoice, InvoiceProfile } from './types'
import { dateLong, inWords, lineTotal, money, totals, unitFor } from './view'

// A4 à 96 points par pouce
export const PAPER_W = 794
export const PAPER_H = 1123

const CSS = `
.kinv { width: 210mm; height: 297mm; position: relative; overflow: hidden; font-family: Arimo, Arial, sans-serif; color: #111; font-size: 9.5pt; background: #fff; line-height: 1.25; text-align: left; }
.kinv * { box-sizing: border-box; }
.kinv .top { height: 3mm; background: #111; }
.kinv .wrap { padding: 9mm 14mm 0; }
.kinv .head { display: flex; align-items: center; gap: 6mm; padding-bottom: 5mm; border-bottom: 2.5px solid #f5b70a; }
.kinv .head img { width: 30mm; height: 30mm; object-fit: contain; }
.kinv .co { flex: 1; min-width: 0; }
.kinv .co .n { font-family: Tinos, serif; font-weight: 700; font-size: 16.5pt; }
.kinv .co .a { margin-top: 2mm; font-size: 6.2pt; letter-spacing: .2em; color: #6b7280; text-transform: uppercase; }
.kinv .doc { width: 55mm; flex-shrink: 0; }
.kinv .doc .t { font-family: Tinos, serif; font-weight: 700; font-size: 19pt; letter-spacing: .32em; text-align: right; padding-bottom: 2.5mm; border-bottom: 1px solid #d1d5db; }
.kinv .doc table { width: 100%; margin-top: 2mm; font-size: 7.5pt; border-collapse: collapse; }
.kinv .doc td { padding: .6mm 0; } .kinv .doc td:first-child { color: #6b7280; font-size: 6.5pt; letter-spacing: .1em; } .kinv .doc td:last-child { text-align: right; font-weight: 700; }
.kinv .parties { display: flex; gap: 12mm; margin-top: 7mm; }
.kinv .parties > div { flex: 1; min-width: 0; }
.kinv .lab { font-size: 6.3pt; font-weight: 700; letter-spacing: .3em; text-transform: uppercase; }
.kinv .bar { width: 14mm; height: 1.5px; background: #f5b70a; margin: 2mm 0 3mm; }
.kinv .parties .n { font-family: Tinos, serif; font-weight: 700; font-size: 11pt; margin-bottom: 1.5mm; }
.kinv .parties .l { color: #6b7280; font-size: 7.8pt; line-height: 1.55; white-space: pre-line; }
.kinv .objet { display: flex; gap: 8mm; align-items: center; margin-top: 6mm; padding: 3mm 5mm; background: #f4f5f8; border-left: 1.6mm solid #f5b70a; }
.kinv .objet span { font-size: 6.3pt; font-weight: 700; letter-spacing: .3em; }
.kinv .objet i { font-family: Tinos, serif; font-size: 10pt; }
.kinv table.lines { width: 100%; margin-top: 6mm; border-collapse: collapse; }
.kinv table.lines th { background: #111; color: #fff; font-size: 6.3pt; letter-spacing: .25em; font-weight: 700; padding: 3.2mm 4mm; text-align: left; }
.kinv table.lines .r { text-align: right; } .kinv table.lines .c { text-align: center; }
.kinv table.lines td { padding: 3.6mm 4mm; vertical-align: top; font-size: 9pt; }
.kinv table.lines tr.even td { background: #f4f5f8; }
.kinv table.lines .d b { display: block; font-size: 9.2pt; } .kinv table.lines .d i { display: block; margin-top: 1mm; color: #6b7280; font-size: 7.5pt; }
.kinv table.lines td.m { font-weight: 700; }
.kinv .tot { margin-left: auto; width: 76mm; margin-top: 2mm; font-size: 8.5pt; }
.kinv .tot div { display: flex; justify-content: space-between; padding: 2mm 1mm; border-bottom: 1px solid #e5e7eb; color: #6b7280; }
.kinv .tot div b { color: #111; font-weight: 400; }
.kinv .net { display: flex; justify-content: space-between; align-items: center; margin-top: 4mm; padding: 5mm 6mm; background: #111; color: #fff; border-left: 1.6mm solid #f5b70a; }
.kinv .net span { color: #f5b70a; font-size: 7.5pt; font-weight: 700; letter-spacing: .3em; }
.kinv .net b { font-family: Tinos, serif; font-size: 17pt; }
.kinv .words { margin-top: 1.5mm; padding: 3mm 5mm; background: #f4f5f8; border-left: 1.6mm solid #f5b70a; }
.kinv .words span { font-size: 6pt; font-weight: 700; letter-spacing: .3em; } .kinv .words i { display: block; margin-top: 1mm; font-family: Tinos, serif; font-size: 10pt; }
.kinv .foot { display: flex; justify-content: space-between; align-items: flex-end; gap: 8mm; margin-top: 16mm; }
.kinv .notes { font-size: 7pt; color: #6b7280; font-style: italic; line-height: 1.6; max-width: 95mm; white-space: pre-line; }
.kinv .sign { width: 60mm; flex-shrink: 0; } .kinv .sign .n { font-family: Tinos, serif; font-weight: 700; font-size: 10.5pt; } .kinv .sign .s { margin-top: 15mm; padding-top: 1.5mm; border-top: 1px solid #d1d5db; font-size: 6.5pt; color: #6b7280; }
.kinv .bottom { position: absolute; left: 0; right: 0; bottom: 0; background: #111; border-top: 1.2mm solid #f5b70a; padding: 3.5mm 10mm 4mm; text-align: center; font-size: 6.8pt; color: #9ca3af; line-height: 1.7; }
.kinv .bottom b { color: #f5b70a; font-weight: 400; }
.kinv .stamp { position: absolute; right: 18mm; top: 48mm; transform: rotate(-12deg); border: 2px solid #16a34a; color: #16a34a; font-weight: 700; letter-spacing: .25em; padding: 1.5mm 4mm; font-size: 11pt; opacity: .85; }
`

const lines = (s?: string) => (s ?? '').split('\n').map(x => x.trim()).filter(Boolean)

export const InvoicePaper = React.forwardRef<HTMLDivElement, { inv: Invoice; profile: InvoiceProfile }>(function InvoicePaper({ inv, profile: p }, ref) {
  const { ht, tva, net } = totals(inv)
  const devis = inv.kind === 'devis'
  const address = lines(p.address)
  const activities = lines(p.activities.replace(/\s*·\s*/g, '\n'))
  const contact = [p.phone && `Tél. ${p.phone}`, p.email].filter(Boolean).join('  ·  ')
  const mentions = p.mentions.replace(/\{numero\}/g, inv.number)
  return (
    <div ref={ref} className="kinv">
      <style>{CSS}</style>
      <div className="top" />
      <div className="wrap">
        <div className="head">
          {p.logo && <img src={p.logo} alt="" />}
          <div className="co">
            <div className="n">{p.name}</div>
            {activities.length > 0 && <div className="a">{activities.join('  ·  ')}</div>}
          </div>
          <div className="doc">
            <div className="t">{devis ? 'DEVIS' : 'FACTURE'}</div>
            <table>
              <tbody>
                <tr>
                  <td>N°</td>
                  <td>{inv.number}</td>
                </tr>
                <tr>
                  <td>DATE</td>
                  <td>{dateLong(inv.date)}</td>
                </tr>
                {devis && (
                  <tr>
                    <td>VALABLE</td>
                    <td>30 jours</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="parties">
          <div>
            <div className="lab">Émetteur</div>
            <div className="bar" />
            <div className="n">{p.name}</div>
            <div className="l">{[...address, contact, p.ids].filter(Boolean).join('\n')}</div>
          </div>
          <div>
            <div className="lab">{devis ? 'Pour' : 'Facturé à'}</div>
            <div className="bar" />
            <div className="n">{inv.client.name}</div>
            <div className="l">{[...inv.client.lines, inv.client.phone && `Tél. ${inv.client.phone}`].filter(Boolean).join('\n')}</div>
          </div>
        </div>

        {inv.objet && (
          <div className="objet">
            <span>OBJET</span>
            <i>{inv.objet}</i>
          </div>
        )}

        <table className="lines">
          <thead>
            <tr>
              <th>DÉSIGNATION</th>
              <th className="c">QTÉ</th>
              <th className="r">PRIX UNITAIRE</th>
              <th className="r">MONTANT</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l, i) => (
              <tr key={i} className={i % 2 ? 'even' : undefined}>
                <td className="d">
                  <b>{l.d}</b>
                  {l.x && <i>{l.x}</i>}
                </td>
                <td className="c" style={{ whiteSpace: 'nowrap' }}>
                  {String(l.q).replace('.', ',')} {unitFor(l.u, l.q)}
                </td>
                <td className="r">{money(l.p)}</td>
                <td className="r m">{money(lineTotal(l))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="tot">
          {inv.tva ? (
            <>
              <div>
                <span>Total hors taxe</span>
                <b>{money(ht)} FCFA</b>
              </div>
              <div>
                <span>TVA 18 %</span>
                <b>{money(tva)} FCFA</b>
              </div>
            </>
          ) : (
            <div>
              <span>Sous-total</span>
              <b>{money(ht)} FCFA</b>
            </div>
          )}
        </div>
        <div className="net">
          <span>
            {devis ? 'MONTANT DU DEVIS' : 'NET À PAYER'}
            {inv.tva ? ' TTC' : ''}
          </span>
          <b>{money(net)} FCFA</b>
        </div>
        <div className="words">
          <span>{devis ? 'ARRÊTÉ' : 'ARRÊTÉE'} À LA SOMME DE</span>
          <i>
            {inWords(net)} ({money(net)}) francs CFA
          </i>
        </div>

        <div className="foot">
          <div className="notes">{mentions}</div>
          <div className="sign">
            <div className="lab">Pour la société</div>
            <div className="bar" />
            <div className="n">{p.name}</div>
            <div className="s">Nom, signature et cachet</div>
          </div>
        </div>
        {!devis && inv.status === 'payee' && <div className="stamp">PAYÉE</div>}
      </div>
      <div className="bottom">
        <b>
          {p.name}
          {address.length > 0 && `  —  ${address.join(', ')}`}
        </b>
        {contact && (
          <>
            <br />
            {contact}
          </>
        )}
        {p.payment && (
          <>
            <br />
            {p.payment}
          </>
        )}
      </div>
    </div>
  )
})

// Aperçu réduit à la largeur disponible (la feuille garde ses vraies proportions)
export function PaperPreview({ inv, profile, width }: { inv: Invoice; profile: InvoiceProfile; width: number }) {
  const k = width / PAPER_W
  return (
    <div className="mx-auto overflow-hidden rounded-md bg-white shadow-[0_12px_40px_rgba(0,0,0,.45)]" style={{ width, height: PAPER_H * k }}>
      <div style={{ width: PAPER_W, height: PAPER_H, transform: `scale(${k})`, transformOrigin: 'top left' }}>
        <InvoicePaper inv={inv} profile={profile} />
      </div>
    </div>
  )
}

// ——— Le PDF : la feuille photographiée en grand, posée sur une page A4 ———
export async function invoicePdf(inv: Invoice, profile: InvoiceProfile): Promise<{ blob: Blob; name: string; save: () => void }> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')])
  // Feuille en vraie taille, hors de l'écran
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAPER_W}px;height:${PAPER_H}px;pointer-events:none`
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    flushSync(() => root.render(<InvoicePaper inv={inv} profile={profile} />))
    await document.fonts.ready
    const imgs = Array.from(host.querySelectorAll('img'))
    await Promise.all(imgs.map(i => (i.complete ? null : new Promise(r => ((i.onload = r), (i.onerror = r))))))
    const canvas = await html2canvas(host.firstElementChild as HTMLElement, { scale: 2.5, backgroundColor: '#ffffff', logging: false })
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297)
    doc.setProperties({ title: `${inv.kind === 'devis' ? 'Devis' : 'Facture'} ${inv.number}` })
    const name = `${inv.kind === 'devis' ? 'Devis' : 'Facture'} ${inv.number} - ${inv.client.name}.pdf`.replace(/[\\/:*?"<>|]/g, '-')
    return { blob: doc.output('blob'), name, save: () => doc.save(name) }
  } finally {
    root.unmount()
    host.remove()
  }
}

// Envoyer (WhatsApp, e-mail… par le partage du téléphone) ; sans partage possible : téléchargement
export async function shareInvoice(inv: Invoice, profile: InvoiceProfile) {
  const pdf = await invoicePdf(inv, profile)
  const file = new File([pdf.blob], pdf.name, { type: 'application/pdf' })
  if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: pdf.name.replace(/\.pdf$/, '') }).catch(() => {})
  else pdf.save()
}
export async function downloadInvoice(inv: Invoice, profile: InvoiceProfile) {
  ;(await invoicePdf(inv, profile)).save()
}
