import type { FeedItem, FeedTab, SunInfo, TrafficIncident, WeatherNow } from '../types'
import { nearestPlace } from './geo'
import { batFeedItem } from './sun'
import { incidentSeverity } from './mock/incidents'
import { retabEvents } from './mock/events'

const MAX_TRAFFIC_ITEMS = 40
const RECENT_CLEARED_MS = 60 * 60_000

export function weatherItem(w: WeatherNow, provider: string): FeedItem {
  const bits = [w.windSpeed && `Wind ${w.windSpeed}`, w.precipChance != null && `${w.precipChance}% rain`]
  const next = w.hourly[3]
  if (next) bits.push(`${next.tempF}° by ${new Date(next.time).toLocaleTimeString('en-US', { hour: 'numeric', timeZone: 'America/Chicago' })}`)
  return {
    id: 'weather-now',
    kind: 'weather',
    tab: 'live',
    title: `${w.tempF}°F · ${w.shortForecast} in Austin`,
    subtitle: bits.filter(Boolean).join(' · '),
    time: w.updatedAt,
    image: w.icon,
    lat: 30.2672,
    lng: -97.7431,
    source: provider,
  }
}

export function incidentItems(incidents: TrafficIncident[], now = Date.now()): FeedItem[] {
  return incidents
    .filter((i) => i.status === 'ACTIVE' || now - new Date(i.time).getTime() < RECENT_CLEARED_MS)
    .slice(0, MAX_TRAFFIC_ITEMS)
    .map((i) => {
      const active = i.status === 'ACTIVE'
      return {
        id: `inc-${i.id}`,
        kind: 'traffic' as const,
        tab: 'live' as const,
        placeId: nearestPlace(i.lat, i.lng, 800)?.id,
        title: i.issue,
        subtitle: active ? i.address : `${i.address} · cleared`,
        time: i.time,
        lat: i.lat,
        lng: i.lng,
        source: 'City of Austin',
        severity: active ? incidentSeverity(i.issue) : 'low',
      }
    })
}

const TAB_ORDER: Record<FeedTab, number> = { live: 0, upcoming: 1, social: 2 }

export function sortFeed(items: FeedItem[]): FeedItem[] {
  return [...items].sort((a, b) => {
    const t = TAB_ORDER[a.tab] - TAB_ORDER[b.tab]
    if (t) return t
    if (a.tab === 'live') {
      // Weather pinned on top, then newest first.
      if (a.kind === 'weather' !== (b.kind === 'weather')) return a.kind === 'weather' ? -1 : 1
      return b.time.localeCompare(a.time)
    }
    if (a.tab === 'upcoming') return a.time.localeCompare(b.time) // soonest first
    return b.time.localeCompare(a.time) // social: newest first
  })
}

export function buildFeed(args: {
  weather?: WeatherNow
  weatherProvider: string
  incidents: TrafficIncident[]
  events: FeedItem[]
  social: FeedItem[]
  sun?: SunInfo
  now: number
}): FeedItem[] {
  const items: FeedItem[] = []
  if (args.weather) items.push(weatherItem(args.weather, args.weatherProvider))
  items.push(...incidentItems(args.incidents, args.now))
  items.push(...retabEvents(args.events, args.now))
  if (args.sun) {
    const bat = batFeedItem(args.sun, args.now)
    if (bat) items.push(bat)
  }
  items.push(...args.social)
  return sortFeed(items)
}
