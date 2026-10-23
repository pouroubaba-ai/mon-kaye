import { cn } from '@/lib/utils'
import { amt } from '@/modules/personnes/view'

// Le détail d'une carte, quand on la touche une deuxième fois : Total, Versé, Reste
export function DetailBand({ total, paid, rest, tone }: { total: number; paid: number; rest: number; tone: 'green' | 'red' }) {
  return (
    <div className={cn('grid grid-cols-3 rounded-[14px] border py-3 animate-in fade-in slide-in-from-top-1 duration-200', tone === 'green' ? 'border-kgreen/30 bg-kgreen/5' : 'border-kred/30 bg-kred/5')}>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-xs text-muted-foreground">Total</span>
        <span className="text-base font-bold tabular-nums">{amt(total)}</span>
      </div>
      <div className="flex flex-col items-center gap-0.5 border-x">
        <span className="text-xs text-muted-foreground">Versé</span>
        <span className="text-base font-bold text-kblue tabular-nums">{amt(paid)}</span>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-xs text-muted-foreground">Reste</span>
        <span className={cn('text-base font-bold tabular-nums', tone === 'green' ? 'text-kgreen' : 'text-kred')}>{amt(rest)}</span>
      </div>
    </div>
  )
}
