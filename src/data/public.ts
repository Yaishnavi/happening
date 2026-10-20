import type { TrafficCamera, TrafficIncident } from '../types'

// =============================================================================
// Free City of Austin feeds the browser can read directly (CORS enabled, no key).
// Used for traffic incidents and cameras so these two layers don't depend on
// the bot fleet at all. Both fall back to mock data on any error.
// =============================================================================

const INCIDENTS_URL =
  "https://data.austintexas.gov/resource/dx9v-zd7x.json?$where=traffic_report_status='ACTIVE'&$order=published_date%20DESC&$limit=80"
const CAMERAS_URL = 'https://data.austintexas.gov/resource/b4k4-adkb.json?$limit=400'
const CCTV_IMAGE = (id: string) => `https://cctv.austinmobility.io/image/${id}.jpg`

type Row = Record<string, unknown>
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN)
const str = (v: unknown) => (v == null ? '' : String(v))

function latLng(r: Row): [number, number] | undefined {
  const loc = r.location as Row | undefined
  const lat = num(r.latitude ?? r.location_latitude ?? loc?.latitude ?? (loc?.coordinates as number[] | undefined)?.[1])
  const lng = num(r.longitude ?? r.location_longitude ?? loc?.longitude ?? (loc?.coordinates as number[] | undefined)?.[0])
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : undefined
}

export async function fetchIncidents(signal?: AbortSignal): Promise<TrafficIncident[]> {
  const r = await fetch(INCIDENTS_URL, { signal })
  if (!r.ok) throw new Error(`incidents ${r.status}`)
  const rows = (await r.json()) as Row[]
  return rows.flatMap((row) => {
    const ll = latLng(row)
    if (!ll) return []
    return [{
      id: str(row.traffic_report_id ?? row.id),
      issue: str(row.issue_reported),
      address: str(row.address),
      lat: ll[0],
      lng: ll[1],
      time: new Date(str(row.published_date)).toISOString(),
      status: str(row.traffic_report_status || 'ACTIVE'),
    }]
  })
}

export async function fetchCameras(signal?: AbortSignal): Promise<TrafficCamera[]> {
  const r = await fetch(CAMERAS_URL, { signal })
  if (!r.ok) throw new Error(`cameras ${r.status}`)
  const rows = (await r.json()) as Row[]
  return rows.flatMap((row) => {
    const ll = latLng(row)
    const id = str(row.camera_id)
    if (!ll || !id) return []
    if (row.camera_status && !/active|turned_on|ok/i.test(str(row.camera_status))) return []
    return [{ id, name: str(row.location_name ?? row.camera_name ?? `Camera ${id}`), lat: ll[0], lng: ll[1], imageUrl: CCTV_IMAGE(id) }]
  })
}
