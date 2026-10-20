import { getTimes } from 'suncalc'
import type { FeedItem, SunInfo } from '../types'
import { placeById } from './geo'
import { austinAt } from './time'

const LAT = 30.2672
const LNG = -97.7431
const BAT_OFFSET_MS = 15 * 60_000
const LIVE_WINDOW_MS = 30 * 60_000

/** Mexican free-tailed bats are at Congress Ave Bridge roughly March through early November. */
export function isBatSeason(d: Date): boolean {
  // d is noon Austin time, so UTC month/day equal the Austin calendar date.
  const m = d.getUTCMonth() // 0-based
  if (m >= 2 && m <= 9) return true // Mar–Oct
  return m === 10 && d.getUTCDate() <= 10 // early Nov
}

/**
 * Sun info for the "next relevant" evening: today's, unless tonight's bat
 * emergence window has fully passed — then tomorrow's.
 */
export function computeSun(now = new Date()): SunInfo {
  const times = (dayOffset: number) => {
    const t = getTimes(austinAt(dayOffset, 12, 0, now), LAT, LNG)
    // suncalc types allow null (polar day/night) — never happens in Austin, but be safe.
    const sunset = t.sunset ?? austinAt(dayOffset, 19, 0, now)
    const sunrise = t.sunrise ?? austinAt(dayOffset, 7, 0, now)
    return { sunset, sunrise }
  }
  let t = times(0)
  if (now.getTime() > t.sunset.getTime() + BAT_OFFSET_MS + LIVE_WINDOW_MS) t = times(1)
  const bat = new Date(t.sunset.getTime() + BAT_OFFSET_MS)
  return {
    sunrise: t.sunrise.toISOString(),
    sunset: t.sunset.toISOString(),
    batEmergence: bat.toISOString(),
    batSeasonActive: isBatSeason(austinAt(0, 12, 0, bat)),
  }
}

export function batFeedItem(sun: SunInfo, now = Date.now()): FeedItem | null {
  if (!sun.batSeasonActive) return null
  const t = new Date(sun.batEmergence).getTime()
  const live = Math.abs(now - t) <= LIVE_WINDOW_MS
  const bridge = placeById('congress-bridge')
  const timeStr = new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })
  return {
    id: `bats-${sun.batEmergence.slice(0, 10)}`,
    kind: 'nature',
    tab: live ? 'live' : 'upcoming',
    placeId: 'congress-bridge',
    title: live ? 'Bats emerging now at Congress Ave Bridge' : `Bat emergence ~${timeStr}`,
    subtitle: '1.5M Mexican free-tailed bats · best views from the east side of the bridge or Statesman lawn',
    time: new Date(t).toISOString(),
    endTime: new Date(t + 45 * 60_000).toISOString(),
    lat: bridge?.lat,
    lng: bridge?.lng,
    image: bridge?.image,
    source: 'Sunset calc',
  }
}
