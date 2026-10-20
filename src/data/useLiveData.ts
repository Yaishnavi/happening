import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FeedItem, LiveData, SourceState, SunInfo, TrafficCamera, TrafficIncident, WeatherNow } from '../types'
import { buildFeed } from './feed'
import { fetchHum, humEvents, humPlaceState, humSocial, humWeather, type HumPlaceState } from './hum'
import { fetchCameras, fetchIncidents } from './public'
import { mockCameras } from './mock/cameras'
import { mockEvents } from './mock/events'
import { mockIncidents } from './mock/incidents'
import { mockSocial } from './mock/social'
import { mockWeather } from './mock/weather'
import { computeSun } from './sun'

// =============================================================================
// Data sources, in priority order:
//   events, social, weather  <- Hum store (Grok Bot fleet), see hum.ts
//                               falls back to /public/hum-snapshot.json, then mock
//   incidents, cameras       <- City of Austin open data, read directly, see public.ts
//                               falls back to mock
//   sun                      <- local suncalc
// Set VITE_HUM_URL (+ VITE_HUM_KEY) in .env.local to go live.
// =============================================================================

const TICK_MS = 30_000

type SourceId = SourceState['id']
const LABELS: Record<SourceId, string> = {
  weather: 'Weather',
  traffic: 'Traffic',
  cameras: 'Cameras',
  sun: 'Sun',
  events: 'Events',
  social: 'Social',
}

interface Snapshot {
  weather: WeatherNow
  incidents: TrafficIncident[]
  cameras: TrafficCamera[]
  events: FeedItem[]
  social: FeedItem[]
  sun: SunInfo
  placeState: Record<string, HumPlaceState>
  status: Record<SourceId, SourceState['status']>
  errors: Partial<Record<SourceId, string>>
  updatedAt: string
}

function initial(): Snapshot {
  const now = new Date()
  return {
    weather: mockWeather(now),
    incidents: mockIncidents(now.getTime()),
    cameras: mockCameras(),
    events: mockEvents(now),
    social: mockSocial(now.getTime()),
    sun: computeSun(now),
    placeState: {},
    status: { weather: 'loading', traffic: 'loading', cameras: 'loading', sun: 'live', events: 'loading', social: 'loading' },
    errors: {},
    updatedAt: now.toISOString(),
  }
}

async function load(prev: Snapshot, signal: AbortSignal): Promise<Snapshot> {
  const now = new Date()
  const next: Snapshot = { ...prev, sun: computeSun(now), updatedAt: now.toISOString(), status: { ...prev.status }, errors: {} }

  const [hum, inc, cams] = await Promise.allSettled([fetchHum(signal), fetchIncidents(signal), fetchCameras(signal)])

  if (hum.status === 'fulfilled' && hum.value.places.length) {
    const { places, source } = hum.value
    const ev = humEvents(places, now.getTime())
    const so = humSocial(places)
    next.events = ev.length ? ev : prev.events
    next.social = so.length ? so : prev.social
    next.weather = humWeather(places, mockWeather(now)) ?? prev.weather
    next.placeState = humPlaceState(places)
    next.status.events = ev.length ? source : 'cached'
    next.status.social = so.length ? source : 'cached' // bots have not written posts yet -> mock stays, marked cached
    next.status.weather = source
  } else {
    const msg = hum.status === 'rejected' ? String(hum.reason) : 'empty store'
    next.status.events = next.status.social = next.status.weather = 'error'
    next.errors.events = next.errors.social = next.errors.weather = msg
  }

  if (inc.status === 'fulfilled' && inc.value.length) {
    next.incidents = inc.value
    next.status.traffic = 'live'
  } else {
    next.status.traffic = prev.status.traffic === 'live' ? 'cached' : 'error'
    next.errors.traffic = inc.status === 'rejected' ? String(inc.reason) : 'no incidents returned'
  }

  if (cams.status === 'fulfilled' && cams.value.length) {
    next.cameras = cams.value
    next.status.cameras = 'live'
  } else {
    next.status.cameras = prev.status.cameras === 'live' ? 'cached' : 'error'
    next.errors.cameras = cams.status === 'rejected' ? String(cams.reason) : 'no cameras returned'
  }
  return next
}

export function useLiveData(): LiveData & { placeState: Record<string, HumPlaceState> } {
  const [snap, setSnap] = useState<Snapshot>(initial)
  const inflight = useRef<AbortController | null>(null)

  const run = useCallback(() => {
    inflight.current?.abort()
    const ac = new AbortController()
    inflight.current = ac
    setSnap((prev) => {
      load(prev, ac.signal)
        .then((n) => {
          if (!ac.signal.aborted) setSnap(n)
        })
        .catch(() => {})
      return prev
    })
  }, [])

  useEffect(() => {
    run()
    const id = window.setInterval(run, TICK_MS)
    return () => {
      window.clearInterval(id)
      inflight.current?.abort()
    }
  }, [run])

  const feed = useMemo(
    () =>
      buildFeed({
        weather: snap.weather,
        weatherProvider: 'NWS',
        incidents: snap.incidents,
        events: snap.events,
        social: snap.social,
        sun: snap.sun,
        now: new Date(snap.updatedAt).getTime(),
      }),
    [snap],
  )

  const sources = useMemo<SourceState[]>(
    () =>
      (Object.keys(LABELS) as SourceId[]).map((id) => ({
        id,
        label: LABELS[id],
        status: snap.status[id],
        updatedAt: snap.updatedAt,
        error: snap.errors[id],
      })),
    [snap.status, snap.errors, snap.updatedAt],
  )

  return {
    weather: snap.weather,
    sun: snap.sun,
    incidents: snap.incidents,
    cameras: snap.cameras,
    feed,
    sources,
    placeState: snap.placeState,
    refresh: run,
  }
}
