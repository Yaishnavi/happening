import type { FeedItem } from '../../types'
import { placeById } from '../geo'
import { austinAt, daysUntilWeekday } from '../time'

// Mock events for the next 7 days, attached to seeded places, with times relative to now.

interface Curated {
  id: string
  placeId: string
  title: string
  subtitle: string
  /** Austin-local weekday 0=Sun..6=Sat; the event is placed on the next such day. */
  weekday?: number
  /** Or a fixed offset from today (0 = tonight). */
  dayOffset?: number
  hour: number
  minute?: number
  durationMin: number
  url?: string
}

const CURATED: Curated[] = [
  // Tonight / rolling
  { id: 'sixth-tonight', placeId: 'sixth-street', dayOffset: 0, hour: 20, durationMin: 300, title: 'Live music crawl on E 6th', subtitle: 'Blues, rock & cover bands at a dozen bars · no cover before 10pm' },
  { id: 'rainey-hh', placeId: 'rainey', dayOffset: 0, hour: 17, durationMin: 180, title: 'Rainey Street happy hour', subtitle: 'Bungalow patios, food trucks, $5 margs' },
  { id: 'bonnell-sunset', placeId: 'mount-bonnell', dayOffset: 0, hour: 18, minute: 15, durationMin: 60, title: 'Sunset at Mount Bonnell', subtitle: '102 steps up · golden hour over Lake Austin' },
  { id: 'mohawk-mon', placeId: 'mohawk', dayOffset: 0, hour: 21, durationMin: 180, title: 'Indie triple bill on the Mohawk rooftop', subtitle: 'Local openers + touring headliner · 21+' },
  { id: 'franklin-line', placeId: 'franklin', dayOffset: 1, hour: 11, durationMin: 240, title: 'Franklin Barbecue opens', subtitle: 'Line usually forms by 8am · sells out by early afternoon' },
  // Weekdays
  { id: 'acl-taping', placeId: 'acl-live', weekday: 2, hour: 20, durationMin: 150, title: 'Austin City Limits taping', subtitle: 'ACL Live at the Moody Theater · free tickets via lottery' },
  { id: 'moody-concert', placeId: 'moody-center', weekday: 3, hour: 19, minute: 30, durationMin: 210, title: 'Arena tour stop at Moody Center', subtitle: 'Pop headliner · doors 6:30pm · clear-bag policy' },
  { id: 'stubbs-thu', placeId: 'stubbs', weekday: 4, hour: 19, durationMin: 210, title: "Outdoor show at Stubb's Waller Creek Amphitheater", subtitle: 'Americana double bill · brisket at the bar' },
  { id: 'capitol-tour', placeId: 'capitol', weekday: 4, hour: 12, durationMin: 60, title: 'Free guided Capitol tour', subtitle: 'Starts at the South Foyer · every 30–45 min' },
  { id: 'mohawk-fri', placeId: 'mohawk', weekday: 5, hour: 22, durationMin: 180, title: 'Late show: punk night at Mohawk', subtitle: 'Indoor stage · 18+' },
  { id: 'acl-fri', placeId: 'acl-live', weekday: 5, hour: 20, durationMin: 180, title: 'Singer-songwriter night at ACL Live', subtitle: 'Seated show · 2nd Street District' },
  // Weekend
  { id: 'longhorns', placeId: 'dkr', weekday: 6, hour: 14, minute: 30, durationMin: 210, title: 'Longhorns football at DKR', subtitle: 'Gates open 2 hrs early · expect road closures around campus' },
  { id: 'zilker-market', placeId: 'zilker', weekday: 6, hour: 9, durationMin: 240, title: 'Saturday morning market at Zilker', subtitle: 'Local makers, coffee, and breakfast tacos on the Great Lawn' },
  { id: 'soco-first', placeId: 'south-congress', weekday: 6, hour: 18, durationMin: 240, title: 'SoCo sidewalk night market', subtitle: 'Vintage, art & food trucks along South Congress Ave' },
  { id: 'q2-match', placeId: 'q2', weekday: 6, hour: 19, minute: 30, durationMin: 120, title: 'Austin FC at Q2 Stadium', subtitle: 'Listo! · Verde & Black · Red Line to McKalla Station' },
  { id: 'barton-sunday', placeId: 'barton-springs', weekday: 0, hour: 9, durationMin: 180, title: 'Sunday swim at Barton Springs', subtitle: '68°F spring water · free before 8am, open till 10pm' },
  { id: 'zilker-sunday', placeId: 'zilker', weekday: 0, hour: 16, durationMin: 180, title: 'Sunday drum circle & picnic at Zilker', subtitle: 'Bring a blanket · near the Zilker Hillside Theater' },
  { id: 'rainey-sun', placeId: 'rainey', weekday: 0, hour: 12, durationMin: 240, title: 'Rainey Street brunch crawl', subtitle: 'Mimosas, migas and patio dogs' },
]

export function mockEvents(now = new Date()): FeedItem[] {
  const nowMs = now.getTime()
  const items: FeedItem[] = []
  for (const c of CURATED) {
    const place = placeById(c.placeId)
    if (!place) continue
    let offset = c.dayOffset ?? daysUntilWeekday(c.weekday ?? 0, now)
    let start = austinAt(offset, c.hour, c.minute ?? 0, now)
    let end = start.getTime() + c.durationMin * 60_000
    if (end < nowMs) {
      // Already over today — roll to the next occurrence within the 7-day window.
      offset += c.dayOffset != null ? 1 : 7
      if (offset > 7) continue
      start = austinAt(offset, c.hour, c.minute ?? 0, now)
      end = start.getTime() + c.durationMin * 60_000
    }
    const startMs = start.getTime()
    items.push({
      id: `cur-${c.id}-${start.toISOString().slice(0, 10)}`,
      kind: 'event',
      tab: nowMs >= startMs && nowMs <= end ? 'live' : 'upcoming',
      placeId: place.id,
      title: c.title,
      subtitle: c.subtitle,
      time: start.toISOString(),
      endTime: new Date(end).toISOString(),
      lat: place.lat,
      lng: place.lng,
      image: place.image,
      url: c.url,
      source: 'Austin events',
    })
  }
  return items
}

/** Re-derive live/upcoming from the clock (cached items get stale tabs otherwise). */
export function retabEvents(items: FeedItem[], now = Date.now()): FeedItem[] {
  return items
    .filter((i) => new Date(i.endTime ?? i.time).getTime() > now)
    .map((i) => {
      const s = new Date(i.time).getTime()
      const e = new Date(i.endTime ?? i.time).getTime()
      const tab = now >= s && now <= e ? 'live' : 'upcoming'
      return tab === i.tab ? i : { ...i, tab }
    })
}
