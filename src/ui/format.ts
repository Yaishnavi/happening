import { useEffect, useState } from 'react'
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSun,
  Moon,
  Snowflake,
  Sun,
  Wind,
  type LucideIcon,
} from 'lucide-react'

export const APP_NAME = 'Happening'
const TZ = 'America/Chicago'

const toDate = (d: string | number | Date) => (d instanceof Date ? d : new Date(d))
const valid = (d: Date) => !Number.isNaN(d.getTime())

/** "now", "4m ago", "2h ago", "3d ago"; future times become "in 5m". */
export function timeAgo(iso: string | number | Date, now: number = Date.now()): string {
  const d = toDate(iso)
  if (!valid(d)) return ''
  const diff = Math.round((now - d.getTime()) / 1000)
  const abs = Math.abs(diff)
  let s: string
  if (abs < 45) return diff >= 0 ? 'just now' : 'now'
  if (abs < 3600) s = `${Math.max(1, Math.round(abs / 60))}m`
  else if (abs < 86400) s = `${Math.round(abs / 3600)}h`
  else if (abs < 86400 * 7) s = `${Math.round(abs / 86400)}d`
  else return formatDate(d)
  return diff >= 0 ? `${s} ago` : `in ${s}`
}

/** Seconds-precision variant for "updated 12s ago". */
export function secondsAgo(iso: string | number | Date, now: number = Date.now()): string {
  const d = toDate(iso)
  if (!valid(d)) return ''
  const s = Math.max(0, Math.round((now - d.getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

/** "7:13 PM" in Austin time. */
export function formatTime(iso: string | number | Date): string {
  const d = toDate(iso)
  if (!valid(d)) return ''
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })
}

/** Compact "7:13" (no meridiem) for chips. */
export function formatTimeShort(iso: string | number | Date): string {
  return formatTime(iso).replace(/\s?[AP]M$/, '')
}

export function formatDate(d: string | number | Date): string {
  const x = toDate(d)
  if (!valid(x)) return ''
  return x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ })
}

function dayKey(d: Date): string {
  // YYYY-MM-DD in Austin time
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}

export { dayKey as austinDayKey }

/** "Today", "Tomorrow", "Wed, Oct 22". */
export function dayLabel(iso: string | number | Date, now: number = Date.now()): string {
  const d = toDate(iso)
  if (!valid(d)) return 'Later'
  const k = dayKey(d)
  if (k === dayKey(new Date(now))) return 'Today'
  if (k === dayKey(new Date(now + 86400000))) return 'Tomorrow'
  if (k === dayKey(new Date(now - 86400000))) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ })
}

function isNightAt(d: Date): boolean {
  const h = Number(d.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: TZ }))
  return h < 7 || h >= 19
}

/** Pick a lucide icon for an NWS shortForecast string. */
export function weatherIcon(shortForecast: string | undefined, at: Date = new Date()): LucideIcon {
  const f = (shortForecast ?? '').toLowerCase()
  const night = isNightAt(at)
  if (/thunder|t-storm|storm/.test(f)) return CloudLightning
  if (/snow|sleet|flurr|ice|freez/.test(f)) return Snowflake
  if (/drizzle/.test(f)) return CloudDrizzle
  if (/rain|shower/.test(f)) return CloudRain
  if (/fog|haze|smoke|mist/.test(f)) return CloudFog
  if (/wind|breez|blustery/.test(f)) return Wind
  if (/partly|mostly sunny|mostly clear|few clouds/.test(f)) return night ? CloudMoon : CloudSun
  if (/cloud|overcast/.test(f)) return Cloud
  if (/sun|clear|fair/.test(f)) return night ? Moon : Sun
  return night ? Moon : CloudSun
}

export function initials(name: string): string {
  const clean = name.replace(/^@/, '').replace(/[_.-]+/g, ' ').trim()
  if (!clean) return '?'
  const parts = clean.split(/\s+/)
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase()
  // camelCase handle → two letters
  const caps = clean.match(/[A-Z]/g)
  if (caps && caps.length >= 2) return (caps[0] + caps[1]).toUpperCase()
  return clean.slice(0, 2).toUpperCase()
}

/** Stable pleasant color from a string (for avatars). */
export function hueColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  return `hsl(${h} 70% 45%)`
}

/** Re-render every `ms` so relative times stay fresh. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(id)
  }, [ms])
  return now
}

export function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function bustCache(url: string, t: number): string {
  return `${url}${url.includes('?') ? '&' : '?'}t=${t}`
}

export function directionsUrl(lat: number, lng: number, from?: [number, number] | null): string {
  const origin = from ? `&origin=${from[1]},${from[0]}` : ''
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${origin}`
}

/** Great-circle distance in miles between [lng, lat] and a lat/lng. */
export function milesBetween(from: [number, number], lat: number, lng: number): number {
  const R = 3958.8
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat - from[1])
  const dLng = toRad(lng - from[0])
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from[1])) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** "0.4 mi · 8 min walk", "3.2 mi", "1,204 mi" */
export function distanceLabel(mi: number, withWalk = false): string {
  const d = mi < 10 ? mi.toFixed(1) : Math.round(mi).toLocaleString()
  if (withWalk && mi <= 2) return `${d} mi · ${Math.max(1, Math.round((mi / 3) * 60))} min walk`
  return `${d} mi`
}
