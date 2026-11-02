// ——— Employés : mes versements ———
// Tous les salaires et avances versés, à tous les employés, du plus récent au plus ancien ; filtre par période.
// Toucher une ligne : le détail de l'opération (et l'annuler, avec un motif), comme partout.
import React from 'react'
import { Banknote, ChevronLeft, HandCoins } from 'lucide-react'
import { useStore } from '@/data/store'
import { DateFilter } from '@/components/date-filter'
import { dayLabel } from '@/components/screens/PartnerDetailScreen'
import { ALL_TIME, inRange, isFiltered, opTime, type DateRange } from '@/lib/date-range'
import { cn } from '@/lib/utils'
import { amt } from '@/modules/personnes/view'

const PAID = new Set(['je_lui_ai_verse', 'avance_salaire'])

// personId : seulement les versements faits à cet employé (depuis sa fiche)
export function EmployeePayments({ onBack, personId }: { onBack: () => void; personId?: string }) {
  const { persons, movements, openMovementDetail } = useStore()
  const [range, setRange] = React.useState<DateRange>(ALL_TIME)
  const emp = new Set(persons.filter(p => p.type === 'employee' && (!personId || p.id === personId)).map(p => p.id))
  const who = personId ? persons.find(p => p.id === personId) : undefined
  const title = who ? 'Ses versements' : 'Mes versements'
  const list = movements
    .filter(m => emp.has(m.personId) && PAID.has(m.type) && inRange(m.date, range))
    .sort((a, b) => opTime(b.date) - opTime(a.date) || (b.id > a.id ? 1 : -1))
  const live = list.filter(m => !m.isCancelled)
  const total = live.reduce((a, m) => a + m.amount, 0)
  const salaires = live.filter(m => m.type === 'je_lui_ai_verse').reduce((a, m) => a + m.amount, 0)

  // Le retour du téléphone (Échap) ferme la page, sauf si une fenêtre est ouverte par-dessus
  const backRef = React.useRef(onBack)
  backRef.current = onBack
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.querySelectorAll('[role="dialog"]').length <= 1) backRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div role="dialog" aria-label={title} className="fixed inset-0 z-40 overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
        <header className="flex items-center gap-2 px-3 pt-[calc(0.875rem+env(safe-area-inset-top))] pb-2">
          <button type="button" aria-label="Retour" onClick={onBack} className="flex size-11 items-center justify-center rounded-full hover:bg-muted">
            <ChevronLeft className="size-6" />
          </button>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-xl font-bold">{title}</span>
            {who && <span className="truncate text-[13px] text-muted-foreground">{who.name}</span>}
          </span>
          {!isFiltered(range) && <DateFilter iconOnly value={range} onChange={setRange} align="end" />}
        </header>
        <div className="flex flex-col gap-3 px-4 pt-2 pb-[calc(2rem+env(safe-area-inset-bottom))]">
          {isFiltered(range) && <DateFilter value={range} onChange={setRange} />}
          {/* Le total versé, comme la grande carte d'une fiche */}
          <div className="flex flex-col gap-1.5 rounded-[18px] border border-kred/30 bg-gradient-to-br from-kred/20 to-card to-70% p-[18px]">
            <span className="text-sm text-muted-foreground">{who ? `Versé à ${who.name}` : 'Versé aux employés'}</span>
            <span className="text-[34px] leading-tight font-bold tracking-tight text-kred tabular-nums">
              {amt(total)} <span className="text-base font-medium text-muted-foreground">FCFA</span>
            </span>
            <span className="text-[13px] text-muted-foreground">
              Salaires {amt(salaires)} · Avances {amt(total - salaires)}
            </span>
          </div>
          <span className="mt-1 text-[15px] font-semibold text-muted-foreground">Historique</span>
          <div className="flex flex-col">
            {list.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{isFiltered(range) ? 'Rien sur cette période.' : 'Aucun versement pour l’instant.'}</p>}
            {list.map((m, i) => {
              const avance = m.type === 'avance_salaire'
              const Icon = avance ? HandCoins : Banknote
              return (
                <button key={m.id} type="button" onClick={() => openMovementDetail(m)} className={cn('flex items-center gap-3 px-1 py-3 text-left', i < list.length - 1 && 'border-b border-border', m.isCancelled && 'opacity-50')}>
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-[10px]', avance ? 'bg-kgreen/15 text-kgreen' : 'bg-kblue/10 text-kblue')}>
                    <Icon className="size-[18px]" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 text-[15px] font-semibold">
                      <span className={cn('truncate', m.isCancelled && 'line-through')}>{who ? (avance ? 'Avance' : 'Salaire') : m.personName}</span>
                      {m.isCancelled && <span className="shrink-0 rounded-full bg-muted px-2 py-px text-[11px] font-semibold text-muted-foreground">Annulé</span>}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {who ? dayLabel(m.date) : `${avance ? 'Avance' : 'Salaire'} · ${dayLabel(m.date)}`}
                      {m.note ? ` · ${m.note}` : ''}
                    </span>
                  </span>
                  <span className={cn('shrink-0 text-[15px] font-bold tabular-nums', m.isCancelled && 'line-through')}>{amt(m.amount)}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
