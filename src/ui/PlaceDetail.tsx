import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Bookmark, BookmarkCheck, Check, MapPin, Navigation, Share, X } from 'lucide-react'
import type { FeedItem, Place, WeatherNow } from '../types'
import { CATEGORY_META } from '../data/places'
import { APP_NAME, cx, directionsUrl, distanceLabel, milesBetween, useMediaQuery, useNow, weatherIcon } from './format'
import { EventCard, LiveRow, SocialCard } from './parts'
import { toggleSaved, useSaved } from './saved'
import './ui.css'

export default function PlaceDetail(props: {
  place: Place
  feed: FeedItem[]
  onClose: () => void
  weather?: WeatherNow
  userLocation?: [number, number] | null
}) {
  const { place, feed, onClose, weather, userLocation } = props
  const miles = userLocation ? milesBetween(userLocation, place.lat, place.lng) : null
  const now = useNow(30_000)
  const isMobile = useMediaQuery('(max-width: 767px)')
  const meta = CATEGORY_META[place.category]
  const [imgFailed, setImgFailed] = useState(false)
  const saved = useSaved().includes(place.id)
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle')

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [onClose])

  useEffect(() => {
    if (shareState !== 'copied') return
    const t = window.setTimeout(() => setShareState('idle'), 1800)
    return () => window.clearTimeout(t)
  }, [shareState])

  const { nowItems, upcoming, chatter } = useMemo(() => {
    const mine = feed.filter((f) => f.placeId === place.id)
    const isHappening = (f: FeedItem) => {
      if (f.tab === 'live') return true
      if (f.kind !== 'event') return false
      const st = new Date(f.time).getTime()
      const en = f.endTime ? new Date(f.endTime).getTime() : st + 2 * 3600_000
      return st <= now && now <= en
    }
    const byTimeDesc = (a: FeedItem, b: FeedItem) => new Date(b.time).getTime() - new Date(a.time).getTime()
    return {
      nowItems: mine.filter(isHappening).sort(byTimeDesc),
      upcoming: mine
        .filter((f) => f.tab === 'upcoming' && !isHappening(f) && new Date(f.time).getTime() > now)
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
        .slice(0, 6),
      chatter: mine.filter((f) => f.tab === 'social').sort(byTimeDesc).slice(0, 8),
    }
  }, [feed, place.id, now])

  const toggleSave = () => toggleSaved(place.id)

  const share = async () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
    const data = { title: `${place.name} · ${APP_NAME}`, text: `${place.name} — ${place.blurb} (via ${APP_NAME})`, url }
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(data)
        return
      } catch (err) {
        if ((err as DOMException)?.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(`${data.text}\n${url}`)
      setShareState('copied')
    } catch {
      /* clipboard blocked — nothing sensible to do */
    }
  }

  const WIcon = weather ? weatherIcon(weather.shortForecast) : null
  const showImage = place.image && !imgFailed
  const titleId = `hp-place-${place.id}`

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className={cx(
        'hp-glass fixed flex flex-col overflow-hidden text-zinc-900',
        isMobile
          ? 'hp-anim-up inset-x-2 bottom-2 z-40 max-h-[80dvh] rounded-[28px]'
          : 'hp-anim-right right-4 top-[72px] z-20 max-h-[calc(100dvh-88px)] w-[360px] rounded-3xl',
      )}
    >
      {/* Cover */}
      <div className="relative h-40 flex-none overflow-hidden">
        {showImage ? (
          <>
            <img src={place.image} alt="" className="h-full w-full object-cover" onError={() => setImgFailed(true)} />
            <div className="absolute inset-0 bg-linear-to-t from-black/35 via-transparent to-black/10" />
          </>
        ) : (
          <div
            className="grid h-full w-full place-items-center"
            style={{
              background: `radial-gradient(120% 90% at 20% 10%, ${meta.color}55 0%, transparent 60%), radial-gradient(100% 80% at 90% 100%, ${meta.color}40 0%, transparent 55%), linear-gradient(135deg, ${meta.color}26, #ffffff)`,
            }}
          >
            <span className="text-[64px] leading-none drop-shadow-[0_6px_14px_rgb(0_0_0/0.18)]" aria-hidden>
              {place.emoji}
            </span>
          </div>
        )}

        {weather && WIcon && (
          <span
            className="absolute left-3 top-3 inline-flex h-7 items-center gap-1.5 rounded-full bg-white/85 px-2.5 text-[12px] font-medium text-zinc-700 shadow-sm backdrop-blur-md"
            title={weather.shortForecast}
          >
            <WIcon size={14} className="text-amber-500" strokeWidth={2.2} />
            <span className="font-semibold tabular-nums text-zinc-900">{Math.round(weather.tempF)}°</span>
          </span>
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          title="Close (Esc)"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/85 text-zinc-700 shadow-sm outline-none backdrop-blur-md transition hover:scale-105 hover:bg-white hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900/60 active:scale-95"
        >
          <X size={16} strokeWidth={2.4} />
        </button>
      </div>

      {/* Body */}
      <div className="hp-scroll min-h-0 flex-1">
        <div className="px-5 pb-2 pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="inline-flex h-6 flex-none items-center gap-1.5 rounded-full px-2 text-[11.5px] font-semibold"
              style={{ background: `${meta.color}1a`, color: meta.color }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
              {meta.label}
            </span>
            <span className="inline-flex min-w-0 items-center gap-1 text-[12.5px] text-zinc-500">
              <MapPin size={12} className="flex-none" />
              <span className="truncate">
                {place.neighborhood}
                {miles != null && <span className="text-zinc-400"> · {distanceLabel(miles, true)}</span>}
              </span>
            </span>
            {nowItems.length > 0 && (
              <span className="ml-auto flex-none rounded-md bg-rose-600 px-2 text-[10.5px] font-bold uppercase leading-5 tracking-wider text-white">
                Happening now
              </span>
            )}
          </div>
          <h2 id={titleId} className="mt-2.5 text-[22px] font-semibold leading-7 tracking-[-0.02em] text-zinc-950">
            {place.name}
          </h2>
          <p className="mt-1.5 text-[14px] leading-[21px] text-zinc-600">{place.blurb}</p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <a
              href={directionsUrl(place.lat, place.lng, userLocation)}
              target="_blank"
              rel="noreferrer"
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-zinc-900 text-[13px] font-medium text-white shadow-sm outline-none transition hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-900/60 focus-visible:ring-offset-2 active:scale-[0.98]"
            >
              <Navigation size={15} strokeWidth={2.2} />
              Directions
            </a>
            <ActionButton onClick={share} active={shareState === 'copied'} icon={shareState === 'copied' ? Check : Share}>
              {shareState === 'copied' ? 'Copied' : 'Share'}
            </ActionButton>
            <ActionButton onClick={toggleSave} active={saved} icon={saved ? BookmarkCheck : Bookmark} pressed={saved}>
              {saved ? 'Saved' : 'Save'}
            </ActionButton>
          </div>
        </div>

        <Section title="Happening now" count={nowItems.length} empty="Nothing live here at the moment.">
          {nowItems.map((it) =>
            it.kind === 'event' ? <EventCard key={it.id} item={it} now={now} /> : <LiveRow key={it.id} item={it} now={now} />,
          )}
        </Section>
        <Section title="Coming up" count={upcoming.length} empty="No upcoming events listed.">
          {upcoming.map((it) => (
            <EventCard key={it.id} item={it} now={now} />
          ))}
        </Section>
        <Section title="Chatter" count={chatter.length} empty="No recent posts about this spot." last>
          {chatter.map((it) => (
            <SocialCard key={it.id} item={it} now={now} showPlace={false} />
          ))}
        </Section>
      </div>
    </section>
  )
}

function ActionButton({
  onClick,
  icon: Icon,
  active,
  pressed,
  children,
}: {
  onClick: () => void
  icon: typeof Share
  active?: boolean
  pressed?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cx(
        'flex h-10 items-center justify-center gap-1.5 rounded-xl border text-[13px] font-medium outline-none transition',
        'focus-visible:ring-2 focus-visible:ring-zinc-900/60 focus-visible:ring-offset-2 active:scale-[0.98]',
        active
          ? 'border-zinc-900/15 bg-zinc-900/[0.06] text-zinc-900'
          : 'border-black/[0.08] bg-white/70 text-zinc-700 hover:border-black/[0.14] hover:bg-white hover:text-zinc-900',
      )}
    >
      <Icon size={15} strokeWidth={2.2} className={cx(active && 'text-zinc-900')} />
      {children}
    </button>
  )
}

function Section({
  title,
  count,
  empty,
  last,
  children,
}: {
  title: string
  count: number
  empty: string
  last?: boolean
  children: ReactNode
}) {
  return (
    <section className={cx('border-t border-zinc-900/[0.06] px-2 pt-3', last ? 'pb-4' : 'pb-2')}>
      <div className="flex items-center justify-between px-3 pb-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">{title}</h3>
        {count > 0 && <span className="text-[11px] tabular-nums text-zinc-400">{count}</span>}
      </div>
      {count > 0 ? children : <p className="px-3 pb-2 pt-0.5 text-[12.5px] text-zinc-400">{empty}</p>}
    </section>
  )
}
