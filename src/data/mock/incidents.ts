import type { TrafficIncident } from '../../types'

// Mock City of Austin traffic incidents (shape mirrors Socrata dx9v-zd7x after mapping).

type Seed = [issue: string, address: string, lat: number, lng: number]

// Plausible central-Austin locations. A few sit within 800m of seeded places
// (Congress Bridge, Sixth St, Moody Center/DKR, Zilker, South Congress, Rainey).
const SEEDS: Seed[] = [
  ['Crash Urgent', 'S Congress Ave / W Riverside Dr', 30.2603, -97.7466], // near Congress Bridge
  ['Traffic Hazard', 'E 6th St / Red River St', 30.2677, -97.7363], // near Sixth / Mohawk
  ['Crash Service', 'N IH 35 Svc Rd / E Martin Luther King Jr Blvd', 30.2817, -97.7298], // near Moody / DKR
  ['Stalled Vehicle', 'Barton Springs Rd / S Lamar Blvd', 30.2617, -97.7615], // near Zilker
  ['Collision', 'S Congress Ave / E Annie St', 30.2489, -97.7497], // near South Congress
  ['Traffic Hazard / Debris', 'E Cesar Chavez St / Rainey St', 30.2597, -97.7387], // near Rainey
  ['Crash Urgent', 'N Mopac Expy / W 35th St', 30.3062, -97.7551],
  ['Traffic Hazard', 'N Lamar Blvd / W 24th St', 30.2873, -97.7477],
  ['Collision', 'E Riverside Dr / S Pleasant Valley Rd', 30.2393, -97.7272],
  ['Crash Service', 'Airport Blvd / E 51st St', 30.3122, -97.7128],
  ['Stalled Vehicle', 'S IH 35 Svc Rd / E Oltorf St', 30.2361, -97.7454],
  ['Traffic Hazard / Debris', 'N Mopac Expy / W 5th St', 30.2713, -97.7697],
  ['Collision / Left Scene', 'E 7th St / Chicon St', 30.2627, -97.7240],
  ['Crash Urgent', 'Guadalupe St / W 29th St', 30.2958, -97.7419],
  ['Traffic Hazard', 'W Cesar Chavez St / Lamar Blvd', 30.2669, -97.7563],
  ['Collision With Injury', 'E Ben White Blvd / S Congress Ave', 30.2201, -97.7643],
  ['Crash Service', 'Manor Rd / Airport Blvd', 30.2869, -97.7066],
  ['Blocked Driveway / Highway', 'W 38th St / Medical Pkwy', 30.3055, -97.7448],
  ['Stalled Vehicle', 'S 1st St / W Mary St', 30.2479, -97.7556],
  ['Traffic Hazard', 'E Martin Luther King Jr Blvd / Chicon St', 30.2812, -97.7189],
  ['Crash Urgent', 'N Burnet Rd / W Koenig Ln', 30.3283, -97.7398],
  ['Collision', 'S Lamar Blvd / W Oltorf St', 30.2462, -97.7748],
  ['Traffic Hazard', 'E Cesar Chavez St / Pleasant Valley Rd', 30.2537, -97.7207],
]

let counter = 0
const mkId = () => `mock-inc-${Date.now().toString(36)}-${(counter++).toString(36)}`

function toIncident(seed: Seed, minutesAgo: number, now: number, status = 'ACTIVE'): TrafficIncident {
  const [issue, address, lat, lng] = seed
  return { id: mkId(), issue, address, lat, lng, time: new Date(now - minutesAgo * 60_000).toISOString(), status }
}

/** ~20 incidents, mostly ACTIVE, spread over the last ~3 hours. */
export function mockIncidents(now = Date.now()): TrafficIncident[] {
  return SEEDS.slice(0, 20).map((s, i) => toIncident(s, 3 + i * 9, now, i % 7 === 6 ? 'ARCHIVED' : 'ACTIVE'))
}

/**
 * One liveness step: occasionally clear an ACTIVE incident and/or add a fresh one
 * from an unused location. Keeps the list between ~15 and ~25 entries.
 */
export function stepIncidents(prev: TrafficIncident[], now = Date.now(), rand = Math.random): TrafficIncident[] {
  let next = prev
  const active = next.filter((i) => i.status === 'ACTIVE')
  if (active.length > 12 && rand() < 0.35) {
    const victim = active[Math.floor(rand() * active.length)]
    next = next.map((i) => (i.id === victim.id ? { ...i, status: 'ARCHIVED' } : i))
  }
  if (rand() < 0.4) {
    const used = new Set(next.filter((i) => i.status === 'ACTIVE').map((i) => i.address))
    const free = SEEDS.filter((s) => !used.has(s[1]))
    if (free.length) {
      const seed = free[Math.floor(rand() * free.length)]
      next = [toIncident(seed, 0, now), ...next.filter((i) => i.address !== seed[1] || i.status === 'ACTIVE')]
    }
  }
  // Drop the oldest archived entries beyond 25.
  if (next.length > 25) {
    const archived = next.filter((i) => i.status !== 'ACTIVE').sort((a, b) => a.time.localeCompare(b.time))
    const drop = new Set(archived.slice(0, next.length - 25).map((i) => i.id))
    next = next.filter((i) => !drop.has(i.id))
  }
  return sortIncidents(next)
}

export function sortIncidents(list: TrafficIncident[]): TrafficIncident[] {
  return [...list].sort((a, b) => {
    const aa = a.status === 'ACTIVE' ? 0 : 1
    const bb = b.status === 'ACTIVE' ? 0 : 1
    return aa - bb || b.time.localeCompare(a.time)
  })
}

export function incidentSeverity(issue: string): 'low' | 'med' | 'high' {
  const s = issue.toLowerCase()
  if (/crash|urgent|collision|accident|injur|fatal|pedestrian|fire/.test(s)) return 'high'
  if (/hazard|debris|blocked/.test(s)) return 'med'
  return 'low'
}
