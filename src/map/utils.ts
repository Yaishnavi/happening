import type * as GeoJSON from 'geojson'
import type { TrafficIncident } from '../types'

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export function timeAgo(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 0) {
    const m = Math.round(-s / 60)
    return m < 60 ? `in ${m} min` : `in ${Math.round(m / 60)} hr`
  }
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hr ago`
  return `${Math.round(h / 24)}d ago`
}

export type Severity = 'high' | 'med' | 'low'
export const SEVERITY_COLOR: Record<Severity, string> = { high: '#ef4444', med: '#f97316', low: '#eab308' }
export const SEVERITY_LABEL: Record<Severity, string> = { high: 'Severe', med: 'Moderate', low: 'Minor' }

export function incidentSeverity(i: TrafficIncident): Severity {
  const s = i.issue.toLowerCase()
  if (/urgent|fatal|injur|crash|collision|fire|flood|rollover|wrong way/.test(s)) return 'high'
  if (/block|stall|hazard|debris|closure|closed|road|lane|traffic|signal/.test(s)) return 'med'
  return 'low'
}

/** Polygon approximating a circle of `meters` radius around [lng, lat]. */
export function circlePolygon(center: [number, number], meters: number, steps = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  const [lng, lat] = center
  const dLat = meters / 111320
  const dLng = meters / (111320 * Math.cos((lat * Math.PI) / 180))
  const ring: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }
}

export function distanceKm(a: [number, number], b: [number, number]): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

let measureCtx: CanvasRenderingContext2D | null = null
const widthCache = new Map<string, number>()
/** Width of a marker label in px (Inter 600 12.5px). */
export function labelWidth(text: string): number {
  const hit = widthCache.get(text)
  if (hit !== undefined) return hit
  measureCtx ??= document.createElement('canvas').getContext('2d')
  let w = text.length * 7
  if (measureCtx) {
    measureCtx.font = '600 12.5px Inter, ui-sans-serif, system-ui, sans-serif'
    w = measureCtx.measureText(text).width
  }
  widthCache.set(text, w)
  return w
}

export function withCacheBust(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`
}

/** Draws the camera glyph used by the cameras symbol layer (2x pixel ratio). */
export function cameraIcon(dark: boolean): { width: number; height: number; data: Uint8ClampedArray } {
  const S = 2
  const size = 26 * S
  const pad = 4 * S
  const c = document.createElement('canvas')
  c.width = size + pad * 2
  c.height = size + pad * 2
  const ctx = c.getContext('2d')!
  const cx = c.width / 2
  const cy = c.height / 2
  ctx.shadowColor = 'rgba(15,23,42,0.35)'
  ctx.shadowBlur = 3 * S
  ctx.shadowOffsetY = 1 * S
  ctx.beginPath()
  ctx.arc(cx, cy, size / 2 - S, 0, Math.PI * 2)
  ctx.fillStyle = dark ? '#27272a' : '#ffffff'
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.lineWidth = 1 * S
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)'
  ctx.stroke()
  // camera body
  const fg = dark ? '#e4e4e7' : '#1e293b'
  const bw = 13 * S
  const bh = 9 * S
  const bx = cx - bw / 2
  const by = cy - bh / 2 + 1 * S
  ctx.fillStyle = fg
  ctx.beginPath()
  ctx.roundRect(bx, by, bw, bh, 2 * S)
  ctx.fill()
  // viewfinder bump
  ctx.beginPath()
  ctx.roundRect(cx - 3 * S, by - 2 * S, 6 * S, 3 * S, 1 * S)
  ctx.fill()
  // lens
  ctx.beginPath()
  ctx.arc(cx, by + bh / 2, 2.8 * S, 0, Math.PI * 2)
  ctx.fillStyle = dark ? '#27272a' : '#ffffff'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, by + bh / 2, 1.4 * S, 0, Math.PI * 2)
  ctx.fillStyle = fg
  ctx.fill()
  // live dot
  ctx.beginPath()
  ctx.arc(bx + bw - 2.4 * S, by + 2.2 * S, 1 * S, 0, Math.PI * 2)
  ctx.fillStyle = '#ef4444'
  ctx.fill()
  const img = ctx.getImageData(0, 0, c.width, c.height)
  return { width: img.width, height: img.height, data: img.data }
}
