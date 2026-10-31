import React from 'react'
import { BarChart3, ChevronDown, ChevronRight, Eye, EyeOff, Moon, Plus, Search, Settings, Sun, X } from 'lucide-react'

import { useStore } from '@/data/store'
import type { Person } from '@/data/mockData'
import { PersonFormDialog } from '@/components/person-header'
import { DateFilter } from '@/components/date-filter'
import { ALL_TIME, inRange, isFiltered, rangeLabel, type DateRange } from '@/lib/date-range'
import { cn, matchesPerson } from '@/lib/utils'
import { amt, balanceOf, CREDIT_OF, initials, lastPayDate, lastPayText, paidOn, type Side } from '@/modules/personnes/view'
import { daysSince } from '@/data/payHistory'
import { Banknotes } from '@/components/armed'

// ——— Accueil « Kayé simple » ———
// Un seul écran : deux onglets avec leur montant (On me doit / Je dois), une recherche,
// la liste de ceux qui doivent, et deux gros boutons en bas. Rien d'autre tant qu'on n'en a pas besoin.

// Le logo et les deux icônes (Statistiques, Réglages), puis « Clients et fournisseurs | Employés »
export function HomeTop() {
  const { navigate, modules, activeTab, theme, toggleTheme } = useStore()
  // L'accueil montre le premier module allumé : l'onglet allumé est celui-là
  const home = modules.personnes ? 'partner' : modules.employes ? 'employee' : 'factures'
  const group = activeTab === 'factures' ? 'factures' : activeTab === 'employes' || activeTab === 'salaires' ? 'employee' : home
  // Les modules ouverts : 2 ou 3 onglets (noms courts quand il y en a 3)
  const tabs = (
    [
      ['partner', modules.employes && modules.factures ? 'Clients' : 'Clients et fournisseurs', modules.personnes, 'accueil'],
      ['employee', 'Employés', modules.employes, 'employes'],
      ['factures', 'Factures', modules.factures, 'factures'],
    ] as const
  ).filter(t => t[2])
  return (
    <>
      <header className="flex items-center justify-between px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-2">
        <span className="text-[30px] leading-none font-extrabold tracking-tight" style={{ fontFamily: "'Urbanist Variable', sans-serif" }} aria-label="kayé">
          kay<span className="text-kgold">é</span>
        </span>
        <div className="flex gap-1">
          <button type="button" aria-label="Statistiques" onClick={() => navigate('stats')} className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
            <BarChart3 className="size-[22px]" />
          </button>
          {/* Sombre ⇄ clair */}
          <button type="button" aria-label={theme === 'dark' ? 'Passer en clair' : 'Passer en sombre'} onClick={toggleTheme} className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
            {theme === 'dark' ? <Sun className="size-[22px]" /> : <Moon className="size-[22px]" />}
          </button>
          <button type="button" aria-label="Réglages" onClick={() => navigate('reglages')} className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
            <Settings className="size-[22px]" />
          </button>
        </div>
      </header>
      {tabs.length > 1 && (
        <div role="tablist" aria-label="Modules" className={cn('mx-5 mb-2.5 grid gap-1 rounded-xl bg-muted p-1', tabs.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
          {tabs.map(([g, label, , tab]) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={group === g}
              onClick={() => group !== g && navigate(tab)}
              className={cn('h-[38px] rounded-[9px] text-sm transition-colors', group === g ? 'bg-foreground font-bold text-background shadow-sm' : 'font-semibold text-muted-foreground')}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

export const HomeScreen: React.FC = () => {
  const { persons, movements, setSelectedPersonId, openNewMovement, totals, lateDays } = useStore()
  const [side, setSide] = React.useState<Side>('lui')
  const [detail, setDetail] = React.useState(false) // l'œil : pris / versé / reste
  const [search, setSearch] = React.useState('')
  const [range, setRange] = React.useState<DateRange>(ALL_TIME)
  const [showZero, setShowZero] = React.useState(false)
  const [showArchived, setShowArchived] = React.useState(false)
  const [adding, setAdding] = React.useState(false)

  const lui = side === 'lui'
  const partners = persons.filter(p => p.type === 'partner')
  const active = partners.filter(p => !p.archived)
  const archived = partners.filter(p => p.archived)
  const count = (s: Side) => partners.filter(p => balanceOf(p, s) > 0).length
  const total = (s: Side) => (s === 'lui' ? totals.partnersOwesMe : totals.partnersIOwe)
  const versé = paidOn(movements, null, side)
  // Combien de personnes derrière chaque chiffre de l'œil
  const nPris = partners.filter(p => balanceOf(p, side) + paidOn(movements, p.id, side) > 0).length
  const nVersé = partners.filter(p => paidOn(movements, p.id, side) > 0).length
  const nReste = count(side)
  const who = (n: number) => `${n} ${lui ? (n > 1 ? 'clients' : 'client') : n > 1 ? 'fournisseurs' : 'fournisseur'}`

  // La liste : ceux qui doivent (du plus grand au plus petit) ; en cherchant, tout le monde
  const searching = search.trim() !== ''
  const filtered = isFiltered(range)
  const byName = (a: Person, b: Person) => a.name.localeCompare(b.name, 'fr')
  const owing = active.filter(p => balanceOf(p, side) > 0).sort((a, b) => balanceOf(b, side) - balanceOf(a, side))
  const zero = active.filter(p => balanceOf(p, side) === 0).sort(byName)
  const found = searching ? partners.filter(p => matchesPerson(p, search)).sort((a, b) => balanceOf(b, side) - balanceOf(a, side) || byName(a, b)) : []

  // Filtre par période : les crédits (ou dettes) pris dans la période, par personne
  const creditType = CREDIT_OF[side]
  const inPeriod = filtered
    ? partners
        .map(p => {
          const ms = movements.filter(m => m.personId === p.id && m.type === creditType && !m.isCancelled && inRange(m.date, range))
          return { p, n: ms.length, sum: ms.reduce((a, m) => a + m.amount, 0) }
        })
        .filter(x => x.n > 0)
        .sort((a, b) => b.sum - a.sum)
    : []
  const word = lui ? 'crédit' : 'dette'
  const periodWord = rangeLabel(range).toLowerCase()

  const row = (p: Person, sub: React.ReactNode, value: React.ReactNode, i: number, last: boolean) => (
    <button
      key={p.id}
      type="button"
      onClick={() => {
        setDetail(false) // au retour de la fiche, la carte est repliée
        setSelectedPersonId(p.id)
      }}
      className={cn(
        'flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-muted/40 animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-300 motion-reduce:animate-none',
        !last && 'border-b border-border'
      )}
      style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
    >
      <span className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">{initials(p.name)}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base font-semibold">{p.name}</span>
        <span className="truncate text-[13px] text-muted-foreground">{sub}</span>
      </span>
      {value}
    </button>
  )
  const money = (v: number) => <span className={cn('shrink-0 text-base font-bold tabular-nums', lui ? 'text-kgreen' : 'text-kred')}>{amt(v)}</span>
  const muted = (t: string) => <span className="shrink-0 text-sm text-muted-foreground">{t}</span>

  return (
    <div className="flex min-h-dvh flex-col">
      <HomeTop />

      {/* Les deux onglets : le montant est dans l'onglet */}
      <nav aria-label="Comptes" className={cn('grid grid-cols-2', !detail && 'border-b')}>
        {(['lui', 'moi'] as Side[]).map(s => {
          const on = s === side
          const green = s === 'lui'
          return (
            <button
              key={s}
              type="button"
              onClick={() => (on ? setDetail(d => !d) : (setSide(s), setDetail(false), setShowZero(false)))}
              aria-pressed={on}
              className={cn(
                'flex flex-col items-center gap-0.5 border-b-[3px] px-2 py-3 transition-colors',
                on ? (green ? 'border-kgreen bg-kgreen/10' : 'border-kred bg-kred/10') : 'border-transparent opacity-75'
              )}
            >
              <span className={cn('text-sm font-semibold', on ? (green ? 'text-kgreen' : 'text-kred') : 'text-muted-foreground')}>{green ? 'On me doit' : 'Je dois'}</span>
              <span className={cn('flex items-center gap-1.5 text-2xl font-bold tracking-tight tabular-nums', green ? 'text-kgreen' : 'text-kred')}>
                {amt(total(s))}
                {on && (detail ? <EyeOff className="size-4 opacity-70" /> : <Eye className="size-4 opacity-70" />)}
              </span>
              <span className="text-xs text-muted-foreground">
                {count(s)} {green ? (count(s) > 1 ? 'clients' : 'client') : count(s) > 1 ? 'fournisseurs' : 'fournisseur'}
              </span>
            </button>
          )
        })}
      </nav>

      {/* L'œil : pris, versé, reste */}
      {detail && (
        <div className={cn('grid grid-cols-3 border-b px-4 py-3 animate-in fade-in slide-in-from-top-1 duration-200', lui ? 'bg-kgreen/5' : 'bg-kred/5')}>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs text-muted-foreground">Pris</span>
            <span className="text-base font-bold tabular-nums">{amt(total(side) + versé)}</span>
            <span className="text-[11px] text-muted-foreground">{who(nPris)}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 border-x">
            <span className="text-xs text-muted-foreground">Versé</span>
            <span className="text-base font-bold text-kblue tabular-nums">{amt(versé)}</span>
            <span className="text-[11px] text-muted-foreground">{who(nVersé)}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs text-muted-foreground">Reste</span>
            <span className={cn('text-base font-bold tabular-nums', lui ? 'text-kgreen' : 'text-kred')}>{amt(total(side))}</span>
            <span className="text-[11px] text-muted-foreground">{who(nReste)}</span>
          </div>
        </div>
      )}

      {/* Recherche, le calendrier pour filtrer par période, et « Nouveau » */}
      <div className="mx-4 mt-3 flex items-center gap-1">
        <label className="flex h-[46px] min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-muted px-3.5 text-muted-foreground">
          <Search className="size-[18px] shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Chercher"
            aria-label={lui ? 'Chercher un client' : 'Chercher un fournisseur'}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          {searching && (
            <button type="button" aria-label="Effacer la recherche" onClick={() => setSearch('')} className="flex size-7 items-center justify-center rounded-full hover:bg-background">
              <X className="size-4" />
            </button>
          )}
        </label>
        {!filtered && <DateFilter iconOnly value={range} onChange={setRange} align="end" />}
        {/* Nouveau client / fournisseur : sur la ligne de la recherche */}
        <button type="button" onClick={() => setAdding(true)} aria-label={lui ? 'Nouveau client' : 'Nouveau fournisseur'} className="flex h-[46px] shrink-0 items-center gap-1.5 rounded-xl border-2 border-dashed border-kgold px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-kgold/5">
          <Plus className="size-[18px]" strokeWidth={2.4} /> Nouveau
        </button>
      </div>

      {filtered && (
        <div className="flex items-center justify-between gap-2 px-5 pt-3">
          <span className="text-[13px] text-muted-foreground">
            {lui ? 'Crédits pris' : 'Dettes prises'} · {periodWord}
          </span>
          <DateFilter value={range} onChange={setRange} align="end" />
        </div>
      )}

      <div className="flex flex-1 flex-col px-3 pt-1 pb-[calc(7rem+env(safe-area-inset-bottom))]">
        {searching ? (
          found.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">Personne ne s'appelle comme ça.</p>
          ) : (
            found.map((p, i) => {
              const b = balanceOf(p, side)
              return row(p, p.archived ? 'Rangé' : b > 0 ? lastPayText(movements, p, side) : 'À jour', b > 0 ? money(b) : muted('À jour'), i, i === found.length - 1)
            })
          )
        ) : filtered ? (
          inPeriod.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              Aucun{lui ? '' : 'e'} {word} {periodWord}.
            </p>
          ) : (
            inPeriod.map((x, i) => row(x.p, `${x.n} ${word}${x.n > 1 ? 's' : ''} ${periodWord}`, money(x.sum), i, i === inPeriod.length - 1))
          )
        ) : (
          <>
            {owing.length === 0 && (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">{lui ? 'Personne ne vous doit rien.' : 'Vous ne devez rien à personne.'}</p>
            )}
            {owing.map((p, i) => {
              // Client en retard (Réglages) : ses jours en doré
              const d = lastPayDate(movements, p, side)
              const n = d ? daysSince(d) : null
              const late = lui && n !== null && n >= lateDays
              return row(p, <span className={late ? 'font-semibold text-kgold' : undefined}>{lastPayText(movements, p, side)}</span>, money(balanceOf(p, side)), i, i === owing.length - 1)
            })}

            {/* Ceux qui sont à jour, puis ceux qu'on a rangés : repliés */}
            {zero.length > 0 && (
              <Fold label={`À jour (${zero.length})`} open={showZero} onToggle={() => setShowZero(o => !o)}>
                {zero.map((p, i) => row(p, p.phone || ' ', muted('À jour'), i, i === zero.length - 1))}
              </Fold>
            )}
            {archived.length > 0 && (
              <Fold label={`Rangés (${archived.length})`} open={showArchived} onToggle={() => setShowArchived(o => !o)}>
                {archived.map((p, i) => {
                  const b = balanceOf(p, side)
                  return row(p, 'Rangé', b > 0 ? money(b) : muted('À jour'), i, i === archived.length - 1)
                })}
              </Fold>
            )}
          </>
        )}
      </div>

      {/* Les deux gros boutons */}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto grid w-full max-w-xl grid-cols-2 gap-3 border-t bg-background px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => openNewMovement(undefined, lui ? 'il_a_pris_credit' : 'j_ai_pris_credit')}
          className={cn('flex h-[60px] items-center justify-center gap-2 rounded-2xl text-lg font-bold text-white active:scale-[0.98]', lui ? 'bg-kgreen-solid' : 'bg-kred-solid')}
        >
          <Plus className="size-[22px]" strokeWidth={2.6} />
          {lui ? 'Crédit' : 'Dette'}
        </button>
        <button
          type="button"
          onClick={() => openNewMovement(undefined, lui ? 'il_m_a_verse' : 'je_lui_ai_verse')}
          className={cn('flex h-[60px] items-center justify-center gap-2 rounded-2xl border-2 text-lg font-bold active:scale-[0.98]', lui ? 'border-kgreen-solid text-kgreen' : 'border-kred-solid text-kred')}
        >
          <Banknotes className="size-6" />
          Versement
        </button>
      </div>

      <PersonFormDialog type="partner" side={side} open={adding} onOpenChange={setAdding} onCreated={id => (setDetail(false), setSelectedPersonId(id))} />
    </div>
  )
}

function Fold({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <button type="button" onClick={onToggle} className="flex h-12 w-full items-center justify-between px-2 text-sm font-semibold text-muted-foreground">
        {label}
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
      </button>
      {open && <div className="animate-in fade-in duration-200">{children}</div>}
    </div>
  )
}
