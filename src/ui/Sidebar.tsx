import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Bookmark, CalendarX, CircleAlert, Inbox, MessageSquare, Search, SearchX, Sunrise, Sunset, X } from 'lucide-react'
import type { Category, FeedItem, FeedTab, Place, SourceState, SunInfo, WeatherNow } from '../types'
import type { HumPlaceState } from '../data/hum'
import { CATEGORY_META } from '../data/places'
import AskHum from './AskHum'
import { APP_NAME, austinDayKey, cx, dayLabel, milesBetween, formatDate, formatTime, formatTimeShort, secondsAgo, timeAgo, useMediaQuery, useNow, weatherIcon } from './format'
import { EmptyState, EventCard, LiveRow, RowSkeleton, SectionLabel, SocialCard } from './parts'
import { useSaved } from './saved'
import './ui.css'

export interface SidebarProps {
  places: Place[]
  placeState: Record<string, HumPlaceState>
  humUpdatedAt?: string
  onAskPlaces: (ids: string[]) => void
  feed: FeedItem[]
  tab: FeedTab
  onTabChange: (t: FeedTab) => void
  query: string
  onQueryChange: (q: string) => void
  categories: Category[]
  onCategoriesChange: (c: Category[]) => void // empty = all
  selectedPlaceId: string | null
  onSelectPlace: (id: string | null) => void
  sources: SourceState[]
  weather?: WeatherNow
  sun?: SunInfo
  /** [lng, lat] when location is on — places sort by distance and show it */
  userLocation?: [number, number] | null
  savedOnly: boolean
  onSavedOnlyChange: (v: boolean) => void
}

const TABS: { id: FeedTab; label: string }[] = [
  { id: 'live', label: 'Live' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'social', label: 'Social' },
]

const TAB_SOURCES: Record<FeedTab, SourceState['id'][]> = {
  live: ['traffic', 'weather'],
  upcoming: ['events'],
  social: ['social'],
}

const ALL_CATEGORIES = Object.keys(CATEGORY_META) as Category[]

/* Mobile sheet geometry (visible heights, px) */
const PEEK = 320
const TOP_GAP = 56
type Snap = 'peek' | 'half' | 'full'

export default function Sidebar(props: SidebarProps) {
  const {
    places,
    placeState,
    humUpdatedAt,
    onAskPlaces,
    feed,
    tab,
    onTabChange,
    query,
    onQueryChange,
    categories,
    onCategoriesChange,
    selectedPlaceId,
    onSelectPlace,
    sources,
    weather,
    sun,
    userLocation,
    savedOnly,
    onSavedOnlyChange,
  } = props
  const saved = useSaved()
  const savedSet = useMemo(() => new Set(saved), [saved])

  const now = useNow(30_000)
  const isMobile = useMediaQuery('(max-width: 767px)')
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  /* ---------------- filtering ---------------- */
  const placeById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places])
  const q = query.trim().toLowerCase()
  const catSet = useMemo(() => new Set(categories), [categories])

  const filteredPlaces = useMemo(
    () =>
      places.filter(
        (p) =>
          (catSet.size === 0 || catSet.has(p.category)) &&
          (!savedOnly || savedSet.has(p.id)) &&
          (!q || `${p.name} ${p.neighborhood} ${p.blurb} ${p.keywords.join(' ')} ${CATEGORY_META[p.category].label}`.toLowerCase().includes(q)),
      ),
    [places, catSet, q, savedOnly, savedSet],
  )

  const visibleFeed = useMemo(() => {
    return feed.filter((it) => {
      const p = it.placeId ? placeById.get(it.placeId) : undefined
      if (savedOnly && it.placeId && !savedSet.has(it.placeId)) return false
      if (savedOnly && !p && (it.kind === 'event' || it.kind === 'social')) return false
      if (catSet.size > 0) {
        if (p && !catSet.has(p.category)) return false
        // place-less events/posts can't be attributed to a category; city-wide alerts always pass
        if (!p && (it.kind === 'event' || it.kind === 'social')) return false
      }
      if (q) {
        const hay = `${it.title} ${it.subtitle ?? ''} ${it.source} ${p?.name ?? ''} ${p?.neighborhood ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [feed, placeById, catSet, q, savedOnly, savedSet])

  const liveItems = useMemo(
    () =>
      visibleFeed
        .filter((it) => it.tab === 'live')
        .sort((a, b) => {
          const ra = a.severity === 'high' ? 0 : 1
          const rb = b.severity === 'high' ? 0 : 1
          if (ra !== rb) return ra - rb
          return new Date(b.time).getTime() - new Date(a.time).getTime()
        }),
    [visibleFeed],
  )

  const upcomingGroups = useMemo(() => {
    const items = visibleFeed
      .filter((it) => it.tab === 'upcoming')
      .filter((it) => {
        const end = it.endTime ? new Date(it.endTime).getTime() : new Date(it.time).getTime() + 3 * 3600_000
        return end >= now
      })
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    const groups: { key: string; label: string; date: string; items: FeedItem[] }[] = []
    for (const it of items) {
      const d = new Date(it.time)
      const key = Number.isNaN(d.getTime()) ? 'later' : austinDayKey(d)
      let g = groups[groups.length - 1]
      if (!g || g.key !== key) {
        g = { key, label: dayLabel(d, now), date: formatDate(d), items: [] }
        groups.push(g)
      }
      g.items.push(it)
    }
    return groups
  }, [visibleFeed, now])
  const upcomingCount = upcomingGroups.reduce((n, g) => n + g.items.length, 0)

  const socialItems = useMemo(
    () => visibleFeed.filter((it) => it.tab === 'social').sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()),
    [visibleFeed],
  )

  /** Places with something happening right now. */
  const livePlaceIds = useMemo(() => {
    const s = new Set<string>()
    for (const it of feed) {
      if (!it.placeId) continue
      if (it.tab === 'live') s.add(it.placeId)
      else if (it.kind === 'event') {
        const st = new Date(it.time).getTime()
        const en = it.endTime ? new Date(it.endTime).getTime() : st + 2 * 3600_000
        if (st <= now && now <= en) s.add(it.placeId)
      }
    }
    return s
  }, [feed, now])

  /* ---------------- source status ---------------- */
  const tabState = (t: FeedTab) => {
    const ids = TAB_SOURCES[t]
    const rel = sources.filter((s) => ids.includes(s.id))
    const loading = rel.length === 0 ? sources.length === 0 : rel.some((s) => s.status === 'loading')
    const errored = rel.length > 0 && rel.every((s) => s.status === 'error')
    return { loading, errored, rel }
  }
  const active = tabState(tab)

  /* ---------------- mobile sheet ---------------- */
  const [snap, setSnap] = useState<Snap>('peek')
  const [vh, setVh] = useState(() => (typeof window === 'undefined' ? 800 : window.innerHeight))
  const [dragH, setDragH] = useState<number | null>(null)
  const drag = useRef<{ y: number; h: number; moved: boolean; t: number } | null>(null)

  useEffect(() => {
    const on = () => setVh(window.innerHeight)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  const snapHeights: Record<Snap, number> = useMemo(
    () => ({ peek: Math.min(PEEK, vh - TOP_GAP), half: Math.round(vh * 0.62), full: vh - TOP_GAP }),
    [vh],
  )
  const sheetH = dragH ?? snapHeights[snap]

  // Drop the sheet out of the way when a place opens (PlaceDetail takes over on mobile).
  const [prevSel, setPrevSel] = useState(selectedPlaceId)
  if (prevSel !== selectedPlaceId) {
    setPrevSel(selectedPlaceId)
    if (isMobile && selectedPlaceId) setSnap('peek')
  }

  const onGrabDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isMobile) return
    if ((e.target as HTMLElement).closest('button, input, a')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { y: e.clientY, h: snapHeights[snap], moved: false, t: performance.now() }
  }
  const onGrabMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const dy = e.clientY - d.y
    if (Math.abs(dy) > 4) d.moved = true
    if (d.moved) setDragH(Math.max(snapHeights.peek - 40, Math.min(snapHeights.full, d.h - dy)))
  }
  const onGrabUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (!d.moved) {
      setSnap((s) => (s === 'peek' ? 'half' : s === 'half' ? 'full' : 'peek'))
      setDragH(null)
      return
    }
    const h = d.h - (e.clientY - d.y)
    const v = (d.y - e.clientY) / Math.max(1, performance.now() - d.t) // px/ms, + = up
    const order: Snap[] = ['peek', 'half', 'full']
    let target: Snap
    if (Math.abs(v) > 0.6) {
      const cur = order.indexOf(snap)
      target = order[Math.max(0, Math.min(2, cur + (v > 0 ? 1 : -1)))]
    } else {
      target = order.reduce((best, s) => (Math.abs(snapHeights[s] - h) < Math.abs(snapHeights[best] - h) ? s : best), 'peek' as Snap)
    }
    setSnap(target)
    setDragH(null)
  }

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        if (isMobile) setSnap('full')
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [isMobile])

  const isMac = useMemo(() => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), [])

  const changeTab = useCallback(
    (t: FeedTab) => {
      onTabChange(t)
      listRef.current?.scrollTo({ top: 0 })
      if (isMobile && snap === 'peek') setSnap('half')
    },
    [onTabChange, isMobile, snap],
  )

  const onTabKey = (e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const i = TABS.findIndex((t) => t.id === tab)
    const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
    changeTab(n.id)
    document.getElementById(`hp-tab-${n.id}`)?.focus()
  }

  const toggleCategory = (c: Category) => {
    const next = catSet.has(c) ? categories.filter((x) => x !== c) : [...categories, c]
    onCategoriesChange(next.length === ALL_CATEGORIES.length ? [] : next)
  }

  const hasFilters = q.length > 0 || categories.length > 0
  const clearFilters = () => {
    onQueryChange('')
    onCategoriesChange([])
  }
  const clearBtn = hasFilters ? (
    <button
      type="button"
      onClick={clearFilters}
      className="rounded-full bg-zinc-900 px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
    >
      Clear filters
    </button>
  ) : undefined

  const selectPlace = (id: string) => onSelectPlace(id === selectedPlaceId ? null : id)
  const tabIndex = TABS.findIndex((t) => t.id === tab)
  const showCarousel = tab === 'live' || q.length > 0

  /* ---------------- render ---------------- */
  return (
    <aside
      aria-label={`${APP_NAME} sidebar`}
      className={cx(
        'hp-glass fixed z-20 flex flex-col overflow-hidden text-zinc-900',
        isMobile
          ? cx('inset-x-0 bottom-0 rounded-t-[28px] border-b-0', dragH === null && 'transition-[height] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]')
          : 'bottom-4 left-4 top-4 w-[400px] rounded-3xl',
      )}
      style={isMobile ? { height: sheetH } : undefined}
    >
      {/* Grab area (mobile drag) + header */}
      <div
        className={cx('flex-none select-none', isMobile && 'cursor-grab touch-none active:cursor-grabbing')}
        onPointerDown={onGrabDown}
        onPointerMove={onGrabMove}
        onPointerUp={onGrabUp}
        onPointerCancel={onGrabUp}
      >
        {isMobile && (
          <div className="flex justify-center pb-1 pt-2" aria-hidden>
            <span className="h-1 w-9 rounded-full bg-zinc-900/15" />
          </div>
        )}
        <Header weather={weather} sun={sun} now={now} compact={isMobile} updatedAt={humUpdatedAt} />
      </div>

      <AskHum onPlaces={onAskPlaces} />

      {/* Search */}
      <div className="flex-none px-4 pt-3">
        <label className="group relative flex h-10 items-center rounded-xl bg-zinc-900/[0.045] ring-1 ring-transparent transition focus-within:bg-white focus-within:shadow-sm focus-within:ring-zinc-900/10 hover:bg-zinc-900/[0.06] focus-within:hover:bg-white">
          <Search size={16} className="pointer-events-none absolute left-3 text-zinc-400 transition group-focus-within:text-zinc-600" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => isMobile && setSnap('full')}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                if (query) onQueryChange('')
                else e.currentTarget.blur()
              }
            }}
            placeholder="Search places, events, posts"
            aria-label="Search"
            autoComplete="off"
            spellCheck={false}
            className="h-full w-full min-w-0 bg-transparent pl-9 pr-14 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400 [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                onQueryChange('')
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
              className="absolute right-2 grid h-6 w-6 place-items-center rounded-full bg-zinc-900/10 text-zinc-600 transition hover:bg-zinc-900/20"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          ) : (
            !isMobile && (
              <kbd className="pointer-events-none absolute right-2.5 rounded-md border border-black/[0.08] bg-white px-1.5 py-0.5 font-sans text-[11px] font-medium text-zinc-400 shadow-[0_1px_0_rgb(0_0_0/0.04)]">
                {isMac ? '⌘K' : 'Ctrl K'}
              </kbd>
            )
          )}
        </label>
      </div>

      {/* Category chips */}
      <div className="hp-noscrollbar hp-fade-x flex flex-none gap-1.5 overflow-x-auto px-4 pb-1 pt-3" role="group" aria-label="Filter by category">
        <Chip
          active={categories.length === 0 && !savedOnly}
          onClick={() => {
            onCategoriesChange([])
            onSavedOnlyChange(false)
          }}
        >
          All
        </Chip>
        {(saved.length > 0 || savedOnly) && (
          <Chip active={savedOnly} onClick={() => onSavedOnlyChange(!savedOnly)}>
            <Bookmark size={12} strokeWidth={2.4} className={savedOnly ? 'fill-white' : 'fill-zinc-900/10'} />
            Saved
            <span className="tabular-nums opacity-60">{saved.length}</span>
          </Chip>
        )}
        {ALL_CATEGORIES.map((c) => (
          <Chip key={c} active={catSet.has(c)} onClick={() => toggleCategory(c)} color={CATEGORY_META[c].color}>
            {CATEGORY_META[c].label}
          </Chip>
        ))}
        <span className="w-2 flex-none" aria-hidden />
      </div>

      {/* Tabs */}
      <div className="flex-none px-4 pb-2 pt-2">
        <div role="tablist" aria-label="Feed" onKeyDown={onTabKey} className="relative grid h-10 grid-cols-3 rounded-xl bg-zinc-900/[0.05] p-1">
          <span
            aria-hidden
            className="absolute bottom-1 left-1 top-1 rounded-[9px] bg-white shadow-[0_1px_2px_rgb(0_0_0/0.06),0_2px_8px_-2px_rgb(0_0_0/0.08)] ring-1 ring-black/[0.04] transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
            style={{ width: 'calc((100% - 8px) / 3)', transform: `translateX(${tabIndex * 100}%)` }}
          />
          {TABS.map((t) => {
            const sel = t.id === tab
            const count = t.id === 'live' ? liveItems.length : t.id === 'upcoming' ? upcomingCount : socialItems.length
            return (
              <button
                key={t.id}
                id={`hp-tab-${t.id}`}
                role="tab"
                type="button"
                aria-selected={sel}
                aria-controls="hp-tabpanel"
                tabIndex={sel ? 0 : -1}
                onClick={() => changeTab(t.id)}
                className={cx(
                  'relative z-10 flex items-center justify-center gap-1.5 rounded-[9px] text-[13px] font-medium outline-none transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-zinc-900/60',
                  sel ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-800',
                )}
              >
                {t.label}
                {t.id === 'live' && (
                  <span
                    className={cx(
                      'min-w-[18px] rounded-full px-1 text-center text-[11px] font-semibold tabular-nums leading-[18px] transition-colors',
                      sel ? 'bg-red-500/10 text-red-600' : 'bg-zinc-900/[0.06] text-zinc-500',
                    )}
                  >
                    {active.loading && tab === 'live' && count === 0 ? '–' : count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      <div
        ref={listRef}
        id="hp-tabpanel"
        role="tabpanel"
        aria-labelledby={`hp-tab-${tab}`}
        className="hp-scroll min-h-0 flex-1 border-t border-zinc-900/[0.06]"
      >
        <div key={tab} className="hp-list-in pb-3">
          {showCarousel && (
            <PlacesCarousel
              places={filteredPlaces}
              placeState={placeState}
              livePlaceIds={livePlaceIds}
              selectedPlaceId={selectedPlaceId}
              onSelect={selectPlace}
              userLocation={userLocation}
              now={now}
            />
          )}

          {tab === 'live' && (
            <section className="px-2">
              <SectionLabel right={<span className="text-[11px] tabular-nums text-zinc-400">{liveItems.length || ''}</span>}>Right now</SectionLabel>
              {liveItems.length > 0 ? (
                liveItems.map((it) => (
                  <LiveRow
                    key={it.id}
                    item={it}
                    place={it.placeId ? placeById.get(it.placeId) : undefined}
                    now={now}
                    selected={!!it.placeId && it.placeId === selectedPlaceId}
                    onSelectPlace={selectPlace}
                  />
                ))
              ) : active.loading ? (
                <Skeletons variant="live" />
              ) : active.errored ? (
                <ErrorState sources={active.rel} />
              ) : (
                <EmptyState
                  compact
                  icon={hasFilters ? SearchX : Inbox}
                  title={hasFilters ? 'Nothing live matches' : 'All quiet right now'}
                  body={hasFilters ? 'Try a different search or category.' : 'No active incidents or alerts across Austin.'}
                  action={clearBtn}
                />
              )}
            </section>
          )}

          {tab === 'upcoming' && (
            <section className="px-2">
              {upcomingGroups.length > 0 ? (
                upcomingGroups.map((g) => (
                  <div key={g.key}>
                    <div className="sticky top-0 z-10 -mx-2 flex items-baseline gap-2 bg-white/90 px-5 pb-1.5 pt-3 backdrop-blur-md">
                      <h3 className="text-[13px] font-semibold text-zinc-900">{g.label}</h3>
                      {g.label !== g.date && (g.label === 'Today' || g.label === 'Tomorrow') && (
                        <span className="text-[12px] text-zinc-400">{g.date}</span>
                      )}
                      <span className="ml-auto text-[11px] tabular-nums text-zinc-400">{g.items.length}</span>
                    </div>
                    {g.items.map((it) => (
                      <EventCard
                        key={it.id}
                        item={it}
                        place={it.placeId ? placeById.get(it.placeId) : undefined}
                        now={now}
                        selected={!!it.placeId && it.placeId === selectedPlaceId}
                        onSelectPlace={selectPlace}
                      />
                    ))}
                  </div>
                ))
              ) : active.loading ? (
                <div className="pt-2">
                  <Skeletons variant="event" />
                </div>
              ) : active.errored ? (
                <ErrorState sources={active.rel} />
              ) : (
                <EmptyState
                  icon={hasFilters ? SearchX : CalendarX}
                  title={hasFilters ? 'No events match' : 'No upcoming events'}
                  body={hasFilters ? 'Try a different search or category.' : 'Check back soon — new events land here as they’re announced.'}
                  action={clearBtn}
                />
              )}
            </section>
          )}

          {tab === 'social' && (
            <section className="px-2 pt-1">
              {socialItems.length > 0 ? (
                socialItems.map((it) => (
                  <SocialCard
                    key={it.id}
                    item={it}
                    place={it.placeId ? placeById.get(it.placeId) : undefined}
                    now={now}
                    selected={!!it.placeId && it.placeId === selectedPlaceId}
                    onSelectPlace={selectPlace}
                  />
                ))
              ) : active.loading ? (
                <Skeletons variant="social" />
              ) : active.errored ? (
                <ErrorState sources={active.rel} />
              ) : (
                <EmptyState
                  icon={hasFilters ? SearchX : MessageSquare}
                  title={hasFilters ? 'No posts match' : 'No chatter yet'}
                  body={hasFilters ? 'Try a different search or category.' : 'Posts mentioning Austin spots will show up here.'}
                  action={clearBtn}
                />
              )}
            </section>
          )}
        </div>
      </div>

      <SourceFooter sources={sources} now={now} />
    </aside>
  )
}

/* ================================================================== */

function updatedLabel(iso: string | undefined, now: number): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  const mins = Math.max(0, Math.round((now - t) / 60000))
  return mins < 1 ? 'last updated just now' : `last updated ${mins} min ago`
}

function Header({ weather, sun, now, compact, updatedAt }: { weather?: WeatherNow; sun?: SunInfo; now: number; compact: boolean; updatedAt?: string }) {
  const updated = updatedLabel(updatedAt, now)
  return (
    <div className={cx('px-5', compact ? 'pt-1' : 'pt-5')}>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-[19px] font-semibold leading-6 tracking-[-0.02em] text-zinc-950">{APP_NAME}</h1>
        <span className="rounded-full border border-black/[0.07] bg-white/60 px-2 py-0.5 text-[11px] font-medium leading-4 text-zinc-500">
          Austin, TX
        </span>
        <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-medium leading-4 text-white">Curated by Grok Bot</span>
      </div>
      <p className="mt-2 text-[12.5px] leading-[18px] text-zinc-500">
        Grok Bot keeps Hum updated around the clock with the events and places worth knowing about.
      </p>
      {updated && <p className="mt-1 text-[12px] text-zinc-400">{updated}</p>}
      <div className="mt-3 flex min-w-0 items-center gap-1.5">
        <WeatherChip weather={weather} compact={compact} />
        <SunChip sun={sun} now={now} />
      </div>
    </div>
  )
}

const chipCls =
  'inline-flex h-7 min-w-0 items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/70 px-2.5 text-[12px] font-medium text-zinc-700 shadow-[0_1px_0_rgb(0_0_0/0.02)]'

function WeatherChip({ weather, compact }: { weather?: WeatherNow; compact?: boolean }) {
  if (!weather) return <span className="hp-skel h-7 w-24 flex-none !rounded-full" aria-label="Loading weather" />
  const Icon = weatherIcon(weather.shortForecast)
  const tip = [
    weather.shortForecast,
    weather.windSpeed && `Wind ${weather.windSpeed}`,
    weather.precipChance != null && `${weather.precipChance}% chance of rain`,
    `Updated ${formatTime(weather.updatedAt)}`,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <span className={cx(chipCls, 'max-w-[55%] flex-none')} title={tip}>
      <Icon size={14} className="flex-none text-amber-500" strokeWidth={2.2} />
      <span className="flex-none font-semibold tabular-nums text-zinc-900">{Math.round(weather.tempF)}°</span>
      {!compact && <span className="truncate text-zinc-500">{weather.shortForecast}</span>}
    </span>
  )
}

function SunChip({ sun, now }: { sun?: SunInfo; now: number }) {
  if (!sun) return <span className="hp-skel h-7 w-36 flex-none !rounded-full" aria-label="Loading sunset" />
  const sunset = new Date(sun.sunset).getTime()
  const sunrise = new Date(sun.sunrise).getTime()
  const showSunrise = now > sunset + 3600_000 && sunrise > now
  if (showSunrise) {
    return (
      <span className={chipCls} title={`Sunrise ${formatTime(sun.sunrise)}`}>
        <Sunrise size={14} className="flex-none text-orange-500" strokeWidth={2.2} />
        <span className="truncate">
          Sunrise <span className="tabular-nums text-zinc-900">{formatTimeShort(sun.sunrise)}</span>
        </span>
      </span>
    )
  }
  return (
    <span
      className={chipCls}
      title={`Sunset ${formatTime(sun.sunset)}${sun.batSeasonActive ? ` · Bats emerge from Congress Ave Bridge ~${formatTime(sun.batEmergence)}` : ''}`}
    >
      <Sunset size={14} className="flex-none text-orange-500" strokeWidth={2.2} />
      <span className="truncate">
        Sunset <span className="tabular-nums text-zinc-900">{formatTimeShort(sun.sunset)}</span>
        {sun.batSeasonActive && (
          <>
            <span className="px-1 text-zinc-300">·</span>
            <span aria-hidden>🦇 </span>Bats <span className="tabular-nums text-zinc-900">{formatTimeShort(sun.batEmergence)}</span>
          </>
        )}
      </span>
    </span>
  )
}

function Chip({ active, onClick, color, children }: { active: boolean; onClick: () => void; color?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'inline-flex h-8 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[12.5px] font-medium outline-none transition-all duration-150',
        'focus-visible:ring-2 focus-visible:ring-zinc-900/60 focus-visible:ring-offset-1 active:scale-[0.97]',
        active
          ? 'border-zinc-900 bg-zinc-900 text-white shadow-sm'
          : 'border-black/[0.07] bg-white/70 text-zinc-600 hover:border-black/[0.12] hover:bg-white hover:text-zinc-900',
      )}
    >
      {color && <span className={cx('h-2 w-2 rounded-full', active && 'ring-2 ring-white/30')} style={{ background: color }} />}
      {children}
    </button>
  )
}

const BAND_CLS: Record<string, string> = {
  Loud: 'bg-rose-600 text-white',
  Buzzing: 'bg-amber-500 text-white',
  Humming: 'bg-emerald-600 text-white',
  Quiet: 'bg-zinc-200 text-zinc-600',
}

function PlaceLead({ state, blurb, now }: { state?: HumPlaceState; blurb: string; now: number }) {
  const next = state?.upcoming.find((u) => Date.parse(u.when) > now)
  return (
    <div className="mt-1.5 space-y-1">
      {state?.band && (
        <span className={cx('inline-flex rounded-full px-1.5 text-[10px] font-semibold leading-4', BAND_CLS[state.band] ?? BAND_CLS.Quiet)}>
          {state.band}
        </span>
      )}
      <p className="line-clamp-3 text-[11.5px] leading-4 text-zinc-600">{state?.summary || blurb}</p>
      {state?.now[0] && <p className="line-clamp-2 text-[11.5px] font-medium leading-4 text-zinc-800">{state.now[0].title}</p>}
      {next && <p className="truncate text-[11px] leading-4 text-zinc-500">Next · {next.title}</p>}
    </div>
  )
}

function PlacesCarousel({
  places,
  placeState,
  livePlaceIds,
  selectedPlaceId,
  onSelect,
  userLocation,
  now,
}: {
  places: Place[]
  placeState: Record<string, HumPlaceState>
  livePlaceIds: Set<string>
  selectedPlaceId: string | null
  onSelect: (id: string) => void
  userLocation?: [number, number] | null
  now: number
}) {
  // Nearest first when we know where the user is; otherwise live places first, then curated order
  const dist = useMemo(
    () => new Map(userLocation ? places.map((p) => [p.id, milesBetween(userLocation, p.lat, p.lng)] as const) : []),
    [places, userLocation],
  )
  const sorted = useMemo(
    () =>
      [...places].sort((a, b) =>
        dist.size
          ? dist.get(a.id)! - dist.get(b.id)!
          : Number(livePlaceIds.has(b.id)) - Number(livePlaceIds.has(a.id)),
      ),
    [places, livePlaceIds, dist],
  )
  return (
    <section className="pt-1">
      <div className="px-2">
        <SectionLabel right={<span className="text-[11px] tabular-nums text-zinc-400">{places.length}</span>}>Places</SectionLabel>
      </div>
      {sorted.length === 0 ? (
        <p className="px-5 pb-1 pt-1 text-[12.5px] text-zinc-400">No places match your filters.</p>
      ) : (
        <div className="hp-noscrollbar hp-fade-x flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 pb-2 pt-1">
          {sorted.map((p) => {
            const color = CATEGORY_META[p.category].color
            const sel = p.id === selectedPlaceId
            const live = livePlaceIds.has(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.id)}
                aria-pressed={sel}
                title={`${p.name} · ${p.neighborhood}`}
                className={cx(
                  'relative w-[210px] flex-none snap-start rounded-2xl border p-2.5 text-left outline-none transition-all duration-150',
                  'focus-visible:ring-2 focus-visible:ring-zinc-900/60 active:scale-[0.98]',
                  sel
                    ? 'border-zinc-900 bg-white shadow-md'
                    : 'border-black/[0.06] bg-white/60 hover:-translate-y-px hover:border-black/[0.1] hover:bg-white hover:shadow-[0_4px_12px_-4px_rgb(0_0_0/0.12)]',
                )}
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl text-[20px] leading-none"
                  style={{ background: `${color}1f`, boxShadow: `inset 0 0 0 1px ${color}26` }}
                  aria-hidden
                >
                  {p.emoji}
                </span>
                {live && (
                  <span className="absolute right-2 top-2 rounded-[5px] bg-rose-600 px-1.5 text-[9.5px] font-bold uppercase leading-[15px] tracking-wider text-white">
                    Now
                  </span>
                )}
                <p className="mt-2 truncate text-[13px] font-semibold leading-[18px] text-zinc-900">{p.name}</p>
                <PlaceLead state={placeState[p.id]} blurb={p.blurb} now={now} />
              </button>
            )
          })}
          <span className="w-2 flex-none" aria-hidden />
        </div>
      )}
    </section>
  )
}

function Skeletons({ variant }: { variant: 'live' | 'event' | 'social' }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} style={{ opacity: 1 - i * 0.16 }}>
          <RowSkeleton variant={variant} />
        </div>
      ))}
    </div>
  )
}

function ErrorState({ sources }: { sources: SourceState[] }) {
  const names = sources.map((s) => s.label).join(' & ')
  const msg = sources.find((s) => s.error)?.error
  return <EmptyState compact icon={CircleAlert} title={`Couldn’t reach ${names || 'this source'}`} body={msg ?? 'We’ll keep retrying in the background.'} />
}

/* ---------------- footer ---------------- */

const STATUS_META: Record<SourceState['status'], { dot: string; word: string }> = {
  live: { dot: 'bg-emerald-500', word: 'Live' },
  cached: { dot: 'bg-amber-400', word: 'Cached' },
  loading: { dot: 'bg-zinc-300', word: 'Loading' },
  error: { dot: 'bg-red-500', word: 'Offline' },
}

function SourceFooter({ sources, now }: { sources: SourceState[]; now: number }) {
  if (sources.length === 0) {
    return (
      <div className="flex h-10 flex-none items-center gap-3 border-t border-zinc-900/[0.06] px-5">
        <span className="hp-skel h-2.5 w-16" />
        <span className="hp-skel h-2.5 w-14" />
        <span className="hp-skel h-2.5 w-16" />
      </div>
    )
  }
  return (
    <footer className="flex-none border-t border-zinc-900/[0.06] px-5 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5">
      <ul className="flex items-center gap-x-3 gap-y-1.5 hp-noscrollbar md:flex-wrap max-md:overflow-x-auto" aria-label="Data sources">
        {sources.map((s, i) => {
          const m = STATUS_META[s.status]
          const detail =
            s.status === 'loading'
              ? 'Connecting…'
              : s.status === 'error'
                ? s.error || 'Unavailable'
                : s.updatedAt
                  ? `${s.status === 'cached' ? 'Cached data from' : 'Updated'} ${s.status === 'cached' ? formatTime(s.updatedAt) : secondsAgo(s.updatedAt, now).replace(/^0s ago$/, 'just now')}`
                  : m.word
          const alignRight = i >= Math.ceil(sources.length / 2)
          return (
            <li key={s.id} className="group relative flex-none">
              <span
                tabIndex={0}
                className="inline-flex cursor-default items-center gap-1.5 rounded text-[11px] font-medium text-zinc-500 outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/40"
                aria-label={`${s.label}: ${m.word}. ${detail}`}
              >
                <span className={cx('h-1.5 w-1.5 rounded-full', m.dot, s.status === 'loading' && 'opacity-50')} />
                {s.label}
              </span>
              <span
                role="tooltip"
                className={cx(
                  'pointer-events-none absolute bottom-full z-30 mb-2 whitespace-nowrap rounded-lg bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-lg transition duration-150',
                  'translate-y-1 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100',
                  alignRight ? 'right-0' : 'left-0',
                )}
              >
                <span className="text-white/60">{m.word} · </span>
                {detail}
                {s.updatedAt && s.status === 'cached' && <span className="text-white/50"> ({timeAgo(s.updatedAt, now)})</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </footer>
  )
}
