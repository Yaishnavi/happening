import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FeedItem, LiveData, SourceState, SunInfo, TrafficCamera, TrafficIncident, WeatherNow } from '../types'
import { buildFeed } from './feed'
import { mockCameras } from './mock/cameras'
import { mockEvents } from './mock/events'
import { mockIncidents, stepIncidents } from './mock/incidents'
import { mockSocial } from './mock/social'
import { mockWeather } from './mock/weather'
import { computeSun } from './sun'

// =============================================================================
// SWAP POINT — this file is the only place the app gets data from.
// Everything below is MOCK data generated in the browser (src/data/mock/*).
// When the backend is ready, replace each `mock*` call marked
// `TODO(backend)` with an API fetch that returns the same shape; the
// LiveData interface (src/types.ts) and buildFeed() stay as they are.
// =============================================================================

const TICK_MS = 30_000

type SourceId = SourceState['id']
const SOURCES: { id: SourceId; label: string }[] = [
  { id: 'weather', label: 'Weather' },
  { id: 'traffic', label: 'Traffic' },
  { id: 'cameras', label: 'Cameras' },
  { id: 'sun', label: 'Sun' },
  { id: 'events', label: 'Events' },
  { id: 'social', label: 'Social' },
]

interface Snapshot {
  weather: WeatherNow
  incidents: TrafficIncident[]
  cameras: TrafficCamera[]
  events: FeedItem[]
  social: FeedItem[]
  sun: SunInfo
  updatedAt: string
}

/** Full (re)load of every source. */
function loadAll(): Snapshot {
  const now = new Date()
  return {
    weather: mockWeather(now), // TODO(backend): replace mock with API (GET /weather → WeatherNow)
    incidents: mockIncidents(now.getTime()), // TODO(backend): replace mock with API (GET /traffic → TrafficIncident[])
    cameras: mockCameras(), // TODO(backend): replace mock with API (GET /cameras → TrafficCamera[])
    events: mockEvents(now), // TODO(backend): replace mock with API (GET /events → FeedItem[] kind 'event')
    social: mockSocial(now.getTime()), // TODO(backend): replace mock with API (GET /social → FeedItem[] kind 'social')
    sun: computeSun(now), // local (suncalc) — no backend needed
    updatedAt: now.toISOString(),
  }
}

/** Light liveness simulation between full loads. Delete once real polling exists. */
function tick(prev: Snapshot): Snapshot {
  const now = new Date()
  const jitter = Math.round(Math.random() * 2 - 1) // ±1°F
  return {
    ...prev,
    weather: mockWeather(now, jitter), // TODO(backend): poll weather API (~10 min)
    incidents: stepIncidents(prev.incidents, now.getTime()), // TODO(backend): poll traffic API (~2 min)
    events: mockEvents(now), // TODO(backend): poll events API (~30 min)
    social: mockSocial(now.getTime()), // TODO(backend): poll social API (~5 min)
    sun: computeSun(now),
    updatedAt: now.toISOString(),
  }
}

export function useLiveData(): LiveData {
  const [snap, setSnap] = useState<Snapshot>(loadAll)

  useEffect(() => {
    // StrictMode-safe: cleanup clears the interval, so a double mount never double-polls.
    const id = window.setInterval(() => setSnap(tick), TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  const refresh = useCallback(() => setSnap(loadAll()), [])

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
    () => SOURCES.map((s) => ({ ...s, status: 'live', updatedAt: snap.updatedAt })),
    [snap.updatedAt],
  )

  return {
    weather: snap.weather,
    sun: snap.sun,
    incidents: snap.incidents,
    cameras: snap.cameras,
    feed,
    sources,
    refresh,
  }
}
