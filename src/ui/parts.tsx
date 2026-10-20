import type { ReactNode } from 'react'
import {
  Bird,
  Calendar,
  Camera,
  Car,
  CloudLightning,
  MapPin,
  MessageCircle,
  Siren,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import type { FeedItem, Place } from '../types'
import { CATEGORY_META } from '../data/places'
import { cx, formatTime, hueColor, initials, timeAgo } from './format'
import './ui.css'

/* ------------------------------------------------------------------ */
/* Severity / kind visuals                                             */
/* ------------------------------------------------------------------ */

const SEVERITY = {
  high: { fg: '#dc2626', bg: 'rgb(220 38 38 / 0.10)' },
  med: { fg: '#d97706', bg: 'rgb(217 119 6 / 0.12)' },
  low: { fg: '#0284c7', bg: 'rgb(2 132 199 / 0.10)' },
} as const

const KIND_ICON: Record<FeedItem['kind'], LucideIcon> = {
  traffic: Car,
  weather: CloudLightning,
  nature: Bird,
  camera: Camera,
  event: Calendar,
  social: MessageCircle,
}

const KIND_DEFAULT: Record<FeedItem['kind'], { fg: string; bg: string }> = {
  traffic: SEVERITY.med,
  weather: { fg: '#4f46e5', bg: 'rgb(79 70 229 / 0.10)' },
  nature: { fg: '#059669', bg: 'rgb(5 150 105 / 0.10)' },
  camera: { fg: '#52525b', bg: 'rgb(0 0 0 / 0.05)' },
  event: { fg: '#7c3aed', bg: 'rgb(124 58 237 / 0.10)' },
  social: { fg: '#0ea5e9', bg: 'rgb(14 165 233 / 0.10)' },
}

function feedTone(item: FeedItem) {
  return item.severity ? SEVERITY[item.severity] : KIND_DEFAULT[item.kind]
}

export function FeedIcon({ item, size = 32 }: { item: FeedItem; size?: number }) {
  let Icon = KIND_ICON[item.kind]
  if (item.kind === 'traffic' && item.severity === 'high') Icon = Siren
  else if (item.kind === 'weather' && item.severity === 'high') Icon = TriangleAlert
  const tone = feedTone(item)
  return (
    <span
      className="grid flex-none place-items-center rounded-[10px]"
      style={{ width: size, height: size, background: tone.bg, color: tone.fg }}
      aria-hidden
    >
      <Icon size={Math.round(size * 0.5)} strokeWidth={2.2} />
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Row shell — renders as button (place), link (url) or plain div      */
/* ------------------------------------------------------------------ */

function RowShell({
  item,
  selected,
  onSelectPlace,
  className,
  children,
}: {
  item: FeedItem
  selected?: boolean
  onSelectPlace?: (id: string) => void
  className?: string
  children: ReactNode
}) {
  const interactive = Boolean((item.placeId && onSelectPlace) || item.url)
  const base = cx(
    'group relative block w-full rounded-xl text-left outline-none transition-colors duration-150',
    'focus-visible:ring-2 focus-visible:ring-zinc-900/70 focus-visible:ring-offset-1',
    selected ? 'bg-zinc-900/[0.055]' : interactive && 'hover:bg-zinc-900/[0.035] active:bg-zinc-900/[0.06]',
    className,
  )
  if (item.placeId && onSelectPlace) {
    const id = item.placeId
    return (
      <button type="button" className={cx(base, 'cursor-pointer')} onClick={() => onSelectPlace(id)}>
        {children}
      </button>
    )
  }
  if (item.url) {
    return (
      <a href={item.url} target="_blank" rel="noreferrer" className={cx(base, 'cursor-pointer')}>
        {children}
      </a>
    )
  }
  return <div className={base}>{children}</div>
}

/* ------------------------------------------------------------------ */
/* Live row                                                            */
/* ------------------------------------------------------------------ */

export function LiveRow({
  item,
  place,
  now,
  selected,
  onSelectPlace,
}: {
  item: FeedItem
  place?: Place
  now: number
  selected?: boolean
  onSelectPlace?: (id: string) => void
}) {
  const meta = [item.subtitle, place && (item.subtitle ? `near ${place.name}` : place.name)].filter(Boolean).join(' · ')
  return (
    <RowShell item={item} selected={selected} onSelectPlace={onSelectPlace} className="px-3 py-2.5">
      <div className="flex items-start gap-3">
        <FeedIcon item={item} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium leading-5 text-zinc-900">{item.title}</p>
            <time
              dateTime={item.time}
              className="flex-none text-[11.5px] tabular-nums leading-5 text-zinc-400"
              title={new Date(item.time).toLocaleString()}
            >
              {timeAgo(item.time, now)}
            </time>
          </div>
          <p className="truncate text-[12.5px] leading-[18px] text-zinc-500">{meta || item.source}</p>
        </div>
      </div>
    </RowShell>
  )
}

/* ------------------------------------------------------------------ */
/* Event card (Luma-style)                                             */
/* ------------------------------------------------------------------ */

export function EventCard({
  item,
  place,
  now,
  selected,
  onSelectPlace,
}: {
  item: FeedItem
  place?: Place
  now: number
  selected?: boolean
  onSelectPlace?: (id: string) => void
}) {
  const start = new Date(item.time).getTime()
  const end = item.endTime ? new Date(item.endTime).getTime() : start + 2 * 3600_000
  const isNow = start <= now && now <= end
  const t = formatTime(item.time)
  const [hm, ampm] = t.split(' ')
  const venue = place?.name ?? item.subtitle ?? item.source
  return (
    <RowShell item={item} selected={selected} onSelectPlace={onSelectPlace} className="px-3 py-3">
      <div className="flex items-start gap-3">
        <div className="w-12 flex-none pt-px text-right">
          {isNow ? (
            <span className="inline-block rounded-[5px] bg-rose-600 px-1.5 text-[10.5px] font-bold uppercase leading-[18px] tracking-wider text-white">
              Now
            </span>
          ) : (
            <>
              <div className="text-[13.5px] font-semibold tabular-nums leading-5 text-zinc-900">{hm}</div>
              <div className="text-[11px] font-medium uppercase leading-4 tracking-wide text-zinc-400">{ampm}</div>
            </>
          )}
        </div>
        <div className="min-w-0 flex-1 border-l border-zinc-900/[0.07] pl-3">
          <p className="line-clamp-2 text-[13.5px] font-semibold leading-5 text-zinc-900">{item.title}</p>
          <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[12.5px] leading-[18px] text-zinc-500">
            {place ? (
              <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: CATEGORY_META[place.category].color }} />
            ) : (
              <MapPin size={12} className="flex-none" />
            )}
            <span className="truncate">{venue}</span>
          </p>
          {place && item.subtitle && <p className="mt-0.5 truncate text-[12px] leading-4 text-zinc-400">{item.subtitle}</p>}
        </div>
        {item.image && <Thumb src={item.image} />}
      </div>
    </RowShell>
  )
}

function Thumb({ src }: { src: string }) {
  return (
    <span className="h-12 w-12 flex-none overflow-hidden rounded-lg bg-zinc-100 ring-1 ring-black/5">
      <img
        src={src}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
        onError={(e) => ((e.currentTarget.parentElement as HTMLElement).style.display = 'none')}
      />
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Social post card                                                    */
/* ------------------------------------------------------------------ */

function socialAuthor(item: FeedItem): string {
  return item.subtitle?.trim() || item.source
}

export function SocialCard({
  item,
  place,
  now,
  selected,
  onSelectPlace,
  showPlace = true,
}: {
  item: FeedItem
  place?: Place
  now: number
  selected?: boolean
  onSelectPlace?: (id: string) => void
  showPlace?: boolean
}) {
  const author = socialAuthor(item)
  const handle = author.startsWith('@') ? author : author.includes(' ') ? author : `@${author}`
  return (
    <RowShell item={item} selected={selected} onSelectPlace={onSelectPlace} className="px-3 py-3">
      <div className="flex items-start gap-3">
        <span
          className="grid h-8 w-8 flex-none place-items-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white"
          style={{ background: hueColor(author) }}
          aria-hidden
        >
          {initials(author)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="min-w-0 truncate text-[13px] font-semibold leading-5 text-zinc-900">{handle}</span>
            <span className="flex-none text-[12px] text-zinc-300">·</span>
            <time dateTime={item.time} className="flex-none text-[12px] tabular-nums leading-5 text-zinc-400">
              {timeAgo(item.time, now)}
            </time>
          </div>
          <p className="mt-0.5 line-clamp-4 whitespace-pre-line break-words text-[13.5px] leading-5 text-zinc-700">{item.title}</p>
          {showPlace && place && <PlaceTag place={place} className="mt-2" />}
        </div>
        {item.image && <Thumb src={item.image} />}
      </div>
    </RowShell>
  )
}

export function PlaceTag({ place, className }: { place: Place; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex max-w-full items-center gap-1 rounded-full bg-zinc-900/[0.045] py-0.5 pl-1.5 pr-2 text-[11.5px] font-medium text-zinc-600',
        className,
      )}
    >
      <span aria-hidden className="text-[11px] leading-none">
        {place.emoji}
      </span>
      <span className="truncate">{place.name}</span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Skeletons + empty                                                   */
/* ------------------------------------------------------------------ */

export function RowSkeleton({ variant = 'live' }: { variant?: 'live' | 'event' | 'social' }) {
  return (
    <div className="flex items-start gap-3 px-3 py-3" aria-hidden>
      {variant === 'event' ? (
        <div className="w-12 flex-none space-y-1.5 pt-0.5">
          <div className="hp-skel ml-auto h-3.5 w-9" />
          <div className="hp-skel ml-auto h-2.5 w-5" />
        </div>
      ) : (
        <div className={cx('hp-skel h-8 w-8 flex-none', variant === 'social' ? '!rounded-full' : '!rounded-[10px]')} />
      )}
      <div className="min-w-0 flex-1 space-y-2 pt-0.5">
        <div className="hp-skel h-3.5 w-3/4" />
        <div className="hp-skel h-3 w-1/2" />
        {variant === 'social' && <div className="hp-skel h-3 w-5/6" />}
      </div>
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  compact,
}: {
  icon: LucideIcon
  title: string
  body?: string
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <div className={cx('flex flex-col items-center px-6 text-center', compact ? 'py-6' : 'py-12')}>
      <span className="grid h-10 w-10 place-items-center rounded-full bg-zinc-900/[0.05] text-zinc-400">
        <Icon size={18} />
      </span>
      <p className="mt-3 text-[13.5px] font-semibold text-zinc-800">{title}</p>
      {body && <p className="mt-1 max-w-[260px] text-[12.5px] leading-[18px] text-zinc-500">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 pb-1 pt-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">{children}</h3>
      {right}
    </div>
  )
}
