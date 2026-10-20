import { formatFCFA } from '@/lib/utils'

// Petite ligne « ● Total … ● Versé … », en gras, sous un grand montant (tableau de bord, Leurs/Mes comptes).
// Total = ce qui reste + ce qui a déjà été versé. Si ça ne tient pas sur une ligne, « Versé » passe dessous.
const amount = (v: number) => formatFCFA(v).replace(/\s?FCFA$/, '')

export function PaidLine({ remaining, paid, tone, className = '' }: { remaining: number; paid: number; tone: 'credit' | 'debt'; className?: string }) {
  const base = tone === 'credit' ? 'var(--color-credit)' : 'var(--color-debt)'
  return (
    <span className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-semibold leading-none whitespace-nowrap text-muted-foreground tabular-nums ${className}`}>
      <span className="flex items-center gap-1">
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: `color-mix(in srgb, ${base} 45%, transparent)` }} />
        Total {amount(remaining + paid)}
      </span>
      <span className="flex items-center gap-1">
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: base }} />
        Versé {amount(paid)}
      </span>
    </span>
  )
}

// Même style pour la prochaine paie d'un employé : « ● Échéance 25 oct. (dans 5 j) ● Montant 50 000 »
export function DueLine({ date, inDays, amount: value, className = '' }: { date: string; inDays: number; amount: number; className?: string }) {
  const when = inDays === 0 ? "aujourd'hui" : inDays === 1 ? 'demain' : `dans ${inDays} j`
  return (
    <span className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-semibold leading-none whitespace-nowrap text-muted-foreground tabular-nums ${className}`}>
      <span className="flex items-center gap-1">
        <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
        Échéance {date} ({when})
      </span>
      <span className="flex items-center gap-1">
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: 'var(--color-debt)' }} />
        Montant {amount(value)}
      </span>
    </span>
  )
}
