// Shared contract between the data layer (src/data), the map (src/map) and the UI (src/ui).
// Change this file only in coordination with all three.

export type Category = 'music' | 'outdoors' | 'food' | 'landmark' | 'sports' | 'nightlife'

export interface Place {
  id: string
  name: string
  category: Category
  lat: number
  lng: number
  neighborhood: string
  blurb: string
  emoji: string
  /** Keywords used for social search (X), e.g. ['Zilker', 'Barton Springs'] */
  keywords: string[]
  /** Optional cover image URL (Unsplash etc.) */
  image?: string
}

export type FeedKind = 'event' | 'weather' | 'traffic' | 'social' | 'nature' | 'camera'
export type FeedTab = 'live' | 'upcoming' | 'social'

export interface FeedItem {
  id: string
  kind: FeedKind
  tab: FeedTab
  placeId?: string // nearest Place, if any
  title: string
  subtitle?: string
  /** ISO timestamp the item starts / was observed */
  time: string
  endTime?: string
  lat?: number
  lng?: number
  url?: string
  image?: string
  source: string // human label, e.g. "City of Austin", "NWS"
  severity?: 'low' | 'med' | 'high'
}

export interface TrafficIncident {
  id: string
  issue: string // e.g. "Crash Urgent"
  address: string
  lat: number
  lng: number
  time: string
  status: string
}

export interface TrafficCamera {
  id: string
  name: string
  lat: number
  lng: number
  imageUrl: string // snapshot JPEG; append ?t=<ts> to bust cache
}

export interface WeatherNow {
  tempF: number
  shortForecast: string
  icon?: string
  windSpeed?: string
  precipChance?: number
  hourly: { time: string; tempF: number; shortForecast: string; precipChance?: number }[]
  updatedAt: string
}

export interface SunInfo {
  sunset: string
  sunrise: string
  /** Congress Ave Bridge bat emergence, ~15 min after sunset */
  batEmergence: string
  batSeasonActive: boolean
}

export type SourceStatus = 'loading' | 'live' | 'cached' | 'error'

export interface SourceState {
  id: 'weather' | 'traffic' | 'cameras' | 'sun' | 'events' | 'social'
  label: string
  status: SourceStatus
  updatedAt?: string
  error?: string
}

export interface LiveData {
  weather?: WeatherNow
  sun?: SunInfo
  incidents: TrafficIncident[]
  cameras: TrafficCamera[]
  feed: FeedItem[]
  sources: SourceState[]
  refresh: () => void
}

export type MapStyleId = 'light' | 'dark' | 'satellite'

export interface LayerToggles {
  places: boolean
  incidents: boolean
  cameras: boolean
  heat: boolean // social/activity heat
}
