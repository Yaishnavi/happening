import type { Category, FeedItem, Place, WeatherNow } from '../types'
import { placeById } from './geo'
import { PLACES } from './places'

// Hum store adapter. The Grok Bot fleet writes one record per place.
// VITE_HUM_URL overrides the default live-data file. VITE_HUM_KEY is optional
// (sent as apikey). If the live fetch fails, fall back to /hum-snapshot.json.
// record.meta is internal and is never read.

export interface HumNow {
  t?: string
  title: string
  source?: string
  confidence?: number
  expires_at?: string
}

export interface HumUpcoming {
  when: string
  title: string
  source?: string
  url?: string
  end?: string
}

export interface HumCrowd {
  level?: string
  people_visible?: number | null
  vehicles?: number | null
  note?: string
  read_at?: string
}

export interface HumCamera {
  image_url?: string
  camera_id?: string
  source?: string
  distance_mi?: number
  view?: string
  captured_at?: string
  crowd?: HumCrowd
}

export interface HumPlace {
  id: string
  name: string
  lat: number
  lng: number
  city?: string
  updated_at?: string
  record: {
    now?: HumNow[]
    upcoming?: HumUpcoming[]
    social?: { net?: string; handle?: string; text: string; ts: string; engagement?: number; url?: string }[]
    live?: {
      weather?: { temp?: number; cond?: string; wind?: string; hour?: string; source?: string }
      traffic?: { level?: string; note?: string; as_of?: string }
      camera?: HumCamera
    }
    volume?: { score?: number; band?: string; explanation?: string; computed_at?: string }
    summary?: string
    reviews?: { rating?: number | null; count?: number }
    anomaly?: boolean
  }
}

/** Store id -> app place id. Concierge answers still use the longer ids. */
const ID_MAP: Record<string, string> = {
  'zilker-park': 'zilker',
  'q2-stadium': 'q2',
  'rainey-street': 'rainey',
  'the-domain': 'the-domain',
}
export const toAppPlaceId = (storeId: string) => ID_MAP[storeId] ?? storeId

export function resolveAnswerPlaceIds(ids: string[], places: { id: string; name: string }[]): string[] {
  const out: string[] = []
  for (const raw of ids) {
    const trimmed = String(raw).trim()
    const mapped = toAppPlaceId(trimmed)
    const hit = places.find(
      (p) => p.id === mapped || p.id === trimmed || p.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (hit && !out.includes(hit.id)) out.push(hit.id)
  }
  return out
}

const LIVE_BRANCH_URL = 'https://raw.githubusercontent.com/Yaishnavi/happening/live-data/hum-live.json'
const STORE_URL = (import.meta.env.VITE_HUM_URL as string | undefined) || LIVE_BRANCH_URL
const STORE_KEY = import.meta.env.VITE_HUM_KEY as string | undefined
const SNAPSHOT_URL = '/hum-snapshot.json'

export async function fetchHum(signal?: AbortSignal): Promise<{ places: HumPlace[]; source: 'live' | 'cached' }> {
  if (STORE_URL) {
    try {
      const url = `${STORE_URL}${STORE_URL.includes('?') ? '&' : '?'}t=${Date.now()}`
      const r = await fetch(url, { signal, headers: STORE_KEY ? { apikey: STORE_KEY, Authorization: `Bearer ${STORE_KEY}` } : {} })
      if (r.ok) return { places: normalize(await r.json()), source: 'live' }
    } catch {
      /* fall through to snapshot */
    }
  }
  const r = await fetch(SNAPSHOT_URL, { signal })
  if (!r.ok) throw new Error(`snapshot ${r.status}`)
  return { places: normalize(await r.json()), source: 'cached' }
}

function normalize(json: unknown): HumPlace[] {
  if (Array.isArray(json)) return json as HumPlace[]
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>
    for (const k of ['data', 'places', 'rows']) if (Array.isArray(o[k])) return o[k] as HumPlace[]
  }
  return []
}

/** Raw lane-closure counts and internal scoring notes are not shown. */
export function isFillerText(title: string): boolean {
  const t = title.toLowerCase()
  if (/\blane closures?\b/.test(t)) return true
  if (/\bfull\b/.test(t) && /\bpartial\b/.test(t)) return true
  if (/social_velocity|foot traffic is excluded|formula/.test(t)) return true
  return false
}

const DEFAULT_EVENT_MIN = 120

export function humEvents(places: HumPlace[], now = Date.now()): FeedItem[] {
  const items: FeedItem[] = []
  for (const p of places) {
    const appId = toAppPlaceId(p.id)
    const place = placeById(appId)
    for (const u of p.record.upcoming ?? []) {
      const start = Date.parse(u.when)
      if (Number.isNaN(start)) continue
      const end = u.end ? Date.parse(u.end) : start + DEFAULT_EVENT_MIN * 60_000
      if (end < now - 60 * 60_000) continue
      items.push({
        id: `hum-ev-${p.id}-${hash(u.title + u.when)}`,
        kind: 'event',
        tab: now >= start && now <= end ? 'live' : 'upcoming',
        placeId: appId,
        title: u.title,
        subtitle: [p.name, u.source].filter(Boolean).join(' · '),
        time: new Date(start).toISOString(),
        endTime: new Date(end).toISOString(),
        lat: place?.lat ?? p.lat,
        lng: place?.lng ?? p.lng,
        image: place?.image,
        url: u.url,
        source: u.source ?? 'Hum',
      })
    }
  }
  return items
}

/** record.now[] -> live feed items. Expired and filler rows are dropped. */
export function humNow(places: HumPlace[], now = Date.now()): FeedItem[] {
  const items: FeedItem[] = []
  for (const p of places) {
    const appId = toAppPlaceId(p.id)
    const place = placeById(appId)
    for (const n of activeNow(p.record.now, now)) {
      const start = Date.parse(n.t ?? '') || now
      const exp = n.expires_at ? Date.parse(n.expires_at) : start + 60 * 60_000
      const end = Number.isNaN(exp) ? now + 60 * 60_000 : exp
      items.push({
        id: `hum-now-${p.id}-${hash(n.title)}`,
        kind: 'event',
        tab: 'live',
        placeId: appId,
        title: n.title,
        subtitle: [p.name, n.source].filter(Boolean).join(' · '),
        time: new Date(start).toISOString(),
        endTime: new Date(end).toISOString(),
        lat: place?.lat ?? p.lat,
        lng: place?.lng ?? p.lng,
        source: n.source ?? 'Hum',
      })
    }
  }
  return items
}

export function humSocial(places: HumPlace[]): FeedItem[] {
  const items: FeedItem[] = []
  for (const p of places) {
    const appId = toAppPlaceId(p.id)
    const place = placeById(appId)
    for (const s of p.record.social ?? []) {
      const t = Date.parse(s.ts)
      if (Number.isNaN(t)) continue
      items.push({
        id: `hum-soc-${p.id}-${hash(s.text + s.ts)}`,
        kind: 'social',
        tab: 'social',
        placeId: appId,
        title: s.text,
        subtitle: s.handle ? (s.handle.startsWith('@') ? s.handle : `@${s.handle}`) : p.name,
        time: new Date(t).toISOString(),
        lat: place?.lat ?? p.lat,
        lng: place?.lng ?? p.lng,
        url: s.url,
        source: s.net === 'IG' ? 'Instagram' : 'X',
      })
    }
  }
  return items
}

export function humWeather(places: HumPlace[], fallback?: WeatherNow): WeatherNow | undefined {
  let best: { temp: number; cond: string; wind?: string; hour?: string } | undefined
  let bestT = -Infinity
  for (const p of places) {
    const w = p.record.live?.weather
    if (!w || typeof w.temp !== 'number') continue
    const t = Date.parse(w.hour ?? p.updated_at ?? '') || 0
    if (t > bestT) {
      bestT = t
      best = { temp: w.temp, cond: w.cond ?? '', wind: w.wind, hour: w.hour }
    }
  }
  if (!best) return fallback
  return {
    tempF: best.temp,
    shortForecast: best.cond,
    icon: fallback?.icon,
    windSpeed: best.wind,
    hourly: fallback?.hourly ?? [],
    updatedAt: new Date(bestT > 0 ? bestT : Date.now()).toISOString(),
  }
}

export interface HumPlaceState {
  score: number
  band: string
  summary?: string
  now: HumNow[]
  upcoming: HumUpcoming[]
  camera?: HumCamera
  anomaly: boolean
  updatedAt?: string
}

export function activeNow(items: HumNow[] | undefined, now = Date.now()): HumNow[] {
  return (items ?? []).filter((n) => {
    if (!n?.title || isFillerText(n.title)) return false
    if (!n.expires_at) return true
    const exp = Date.parse(n.expires_at)
    return Number.isNaN(exp) || exp >= now
  })
}

export function nextUpcoming(items: HumUpcoming[] | undefined, now = Date.now(), limit = 4): HumUpcoming[] {
  return (items ?? [])
    .filter((u) => u?.title && u.when && !Number.isNaN(Date.parse(u.when)) && Date.parse(u.when) >= now - 3 * 60 * 60_000)
    .sort((a, b) => Date.parse(a.when) - Date.parse(b.when))
    .filter((u) => Date.parse(u.when) > now || !u.end || Date.parse(u.end) >= now)
    .slice(0, limit)
}

export function humPlaceState(places: HumPlace[], now = Date.now()): Record<string, HumPlaceState> {
  const out: Record<string, HumPlaceState> = {}
  for (const p of places) {
    const cam = p.record.live?.camera
    out[toAppPlaceId(p.id)] = {
      score: p.record.volume?.score ?? 0,
      band: p.record.volume?.band ?? 'Quiet',
      summary: p.record.summary,
      now: activeNow(p.record.now, now),
      upcoming: nextUpcoming(p.record.upcoming, now, 6),
      camera: cam?.image_url ? cam : undefined,
      anomaly: !!p.record.anomaly,
      updatedAt: p.updated_at,
    }
  }
  return out
}

export function newestUpdate(places: HumPlace[]): string | undefined {
  let best = ''
  let bestT = -Infinity
  for (const p of places) {
    const t = Date.parse(p.updated_at ?? '')
    if (!Number.isNaN(t) && t > bestT) {
      bestT = t
      best = p.updated_at ?? ''
    }
  }
  return best || undefined
}

const HINTS: { re: RegExp; category: Category; emoji: string }[] = [
  { re: /stadium|arena|football|soccer|\bfc\b/i, category: 'sports', emoji: '🏟️' },
  { re: /bbq|taco|food|restaurant|coffee|ramen|kitchen/i, category: 'food', emoji: '🍽️' },
  { re: /park|pool|trail|lake|spring|garden/i, category: 'outdoors', emoji: '🌳' },
  { re: /music|theater|theatre|jazz|venue/i, category: 'music', emoji: '🎵' },
  { re: /street|nightlife|\bbar\b|club/i, category: 'nightlife', emoji: '🌃' },
]

/** Feed places first (unknown ids included). Seeded places missing from the feed stay at the end. */
export function mergePlaces(hum: HumPlace[]): Place[] {
  const seeded = new Map(PLACES.map((p) => [p.id, p]))
  const ordered: Place[] = []
  const seen = new Set<string>()
  for (const h of hum) {
    if (!h?.id || !Number.isFinite(h.lat) || !Number.isFinite(h.lng)) continue
    const id = toAppPlaceId(h.id)
    if (seen.has(id)) continue
    seen.add(id)
    const known = seeded.get(id)
    if (known) {
      ordered.push({ ...known, name: h.name || known.name, lat: h.lat, lng: h.lng })
      continue
    }
    const hint = HINTS.find((x) => x.re.test(`${h.name} ${h.id}`))
    ordered.push({
      id,
      name: h.name || id,
      category: hint?.category ?? 'landmark',
      lat: h.lat,
      lng: h.lng,
      neighborhood: 'Austin',
      blurb: '',
      emoji: hint?.emoji ?? '📍',
      keywords: [h.name || id],
    })
  }
  for (const p of PLACES) if (!seen.has(p.id)) ordered.push(p)
  return ordered
}

function hash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
