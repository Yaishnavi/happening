import { Marker, type Map as MLMap } from 'maplibre-gl'
import type { FeedItem, Place } from '../types'
import { CATEGORY_META } from '../data/places'
import { labelWidth } from './utils'

/** Zoom at which place names are shown (subject to collision). */
export const LABEL_ZOOM = 13

interface Entry {
  place: Place
  marker: Marker
  el: HTMLDivElement
  liveEl: HTMLSpanElement
  countEl: HTMLSpanElement
  labelEl: HTMLSpanElement
  emojiEl: HTMLSpanElement
  live: number
  upcoming: number
  removing?: number
}

export interface BadgeCounts {
  live: number
  upcoming: number
}

export function feedBadges(feed: FeedItem[]): Map<string, BadgeCounts> {
  const out = new Map<string, BadgeCounts>()
  const now = Date.now()
  for (const f of feed) {
    if (!f.placeId) continue
    if (f.tab !== 'live' && f.tab !== 'upcoming') continue
    const c = out.get(f.placeId) ?? { live: 0, upcoming: 0 }
    if (f.tab === 'live') {
      const end = f.endTime ? new Date(f.endTime).getTime() : NaN
      if (!(end < now)) c.live++
    } else c.upcoming++
    out.set(f.placeId, c)
  }
  return out
}

/**
 * Manages the HTML place markers: diffed by id, animated in/out, label collision,
 * hover + selected state, live/upcoming badges.
 */
export class PlaceMarkers {
  private map: MLMap
  private entries = new Map<string, Entry>()
  private selectedId: string | null = null
  private hoverId: string | null = null
  private badges = new Map<string, BadgeCounts>()
  private onClick: (id: string) => void
  private raf = 0

  constructor(map: MLMap, onClick: (id: string) => void) {
    this.map = map
    this.onClick = onClick
    map.on('zoom', this.syncZoomClass)
    map.on('moveend', this.scheduleCollide)
    map.on('resize', this.scheduleCollide)
    this.syncZoomClass()
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.map.off('zoom', this.syncZoomClass)
    this.map.off('moveend', this.scheduleCollide)
    this.map.off('resize', this.scheduleCollide)
    for (const e of this.entries.values()) {
      if (e.removing) clearTimeout(e.removing)
      e.marker.remove()
    }
    this.entries.clear()
  }

  private syncZoomClass = () => {
    const c = this.map.getContainer()
    const z = this.map.getZoom()
    c.classList.toggle('gm-far', z < 11.5)
    const on = z >= LABEL_ZOOM
    if (c.classList.contains('gm-labels') !== on) {
      c.classList.toggle('gm-labels', on)
      if (on) this.scheduleCollide()
    }
  }

  setPlaces(places: Place[]) {
    const next = new Set(places.map((p) => p.id))
    // remove (animated)
    for (const [id, e] of this.entries) {
      if (next.has(id) || e.removing) continue
      e.el.classList.add('gm-exit')
      e.removing = window.setTimeout(() => {
        e.marker.remove()
        this.entries.delete(id)
      }, 220)
    }
    let i = 0
    for (const p of places) {
      const existing = this.entries.get(p.id)
      if (existing) {
        if (existing.removing) {
          clearTimeout(existing.removing)
          existing.removing = undefined
          existing.el.classList.remove('gm-exit')
        }
        if (existing.place.lat !== p.lat || existing.place.lng !== p.lng) existing.marker.setLngLat([p.lng, p.lat])
        if (existing.place.name !== p.name) existing.labelEl.textContent = p.name
        if (existing.place.emoji !== p.emoji) existing.emojiEl.textContent = p.emoji
        existing.place = p
        continue
      }
      this.entries.set(p.id, this.create(p, i++))
    }
    this.applyBadges()
    this.applySelected()
    this.scheduleCollide()
  }

  private create(p: Place, index: number): Entry {
    const color = CATEGORY_META[p.category]?.color ?? '#64748b'
    const el = document.createElement('div')
    el.className = 'gm-pin gm-enter'
    el.style.setProperty('--c', color)
    el.style.setProperty('--d', `${Math.min(index * 18, 360)}ms`)
    el.setAttribute('role', 'button')
    el.setAttribute('tabindex', '0')
    el.setAttribute('aria-label', p.name)
    el.dataset.placeId = p.id

    const inner = document.createElement('div')
    inner.className = 'gm-pin-inner'
    const body = document.createElement('div')
    body.className = 'gm-pin-body'
    const emojiEl = document.createElement('span')
    emojiEl.className = 'gm-pin-emoji'
    emojiEl.textContent = p.emoji
    const labelEl = document.createElement('span')
    labelEl.className = 'gm-pin-label'
    labelEl.textContent = p.name
    body.append(emojiEl, labelEl)
    const tail = document.createElement('span')
    tail.className = 'gm-pin-tail'
    const liveEl = document.createElement('span')
    liveEl.className = 'gm-pin-live'
    liveEl.textContent = 'Now'
    const countEl = document.createElement('span')
    countEl.className = 'gm-pin-count'
    inner.append(tail, body, liveEl, countEl)
    el.append(inner)

    el.addEventListener('click', (ev) => {
      ev.stopPropagation()
      this.onClick(p.id)
    })
    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault()
        this.onClick(p.id)
      }
    })
    el.addEventListener('mouseenter', () => this.setHover(p.id))
    el.addEventListener('mouseleave', () => this.setHover(null))
    el.addEventListener('animationend', () => el.classList.remove('gm-enter'), { once: true })

    const marker = new Marker({ element: el, anchor: 'bottom', subpixelPositioning: true })
      .setLngLat([p.lng, p.lat])
      .addTo(this.map)
    return { place: p, marker, el, liveEl, countEl, labelEl, emojiEl, live: 0, upcoming: 0 }
  }

  private setHover(id: string | null) {
    const prev = this.hoverId ? this.entries.get(this.hoverId) : undefined
    prev?.el.classList.remove('is-hover')
    this.hoverId = id
    const e = id ? this.entries.get(id) : undefined
    e?.el.classList.add('is-hover')
    this.applyZ()
  }

  setBadges(b: Map<string, BadgeCounts>) {
    this.badges = b
    this.applyBadges()
    this.scheduleCollide()
  }

  private applyBadges() {
    for (const [id, e] of this.entries) {
      const c = this.badges.get(id) ?? { live: 0, upcoming: 0 }
      if (c.live === e.live && c.upcoming === e.upcoming && e.el.dataset.badged) continue
      e.el.dataset.badged = '1'
      e.live = c.live
      e.upcoming = c.upcoming
      e.el.classList.toggle('has-live', c.live > 0)
      e.el.classList.toggle('has-count', c.upcoming > 0)
      e.countEl.textContent = c.upcoming > 9 ? '9+' : String(c.upcoming)
      const extra = [c.live ? 'live now' : '', c.upcoming ? `${c.upcoming} upcoming` : ''].filter(Boolean).join(', ')
      e.el.setAttribute('aria-label', extra ? `${e.place.name} (${extra})` : e.place.name)
    }
    this.applyZ()
  }

  setSelected(id: string | null) {
    this.selectedId = id
    this.applySelected()
    this.scheduleCollide()
  }

  private applySelected() {
    this.map.getContainer().classList.toggle('gm-has-selection', !!this.selectedId && this.entries.has(this.selectedId))
    for (const [id, e] of this.entries) {
      const on = id === this.selectedId
      e.el.classList.toggle('is-selected', on)
      e.el.setAttribute('aria-pressed', on ? 'true' : 'false')
    }
    this.applyZ()
  }

  private priority(id: string, e: Entry): number {
    if (id === this.selectedId) return 1000
    if (id === this.hoverId) return 900
    return (e.live ? 100 : 0) + Math.min(e.upcoming, 9) * 5
  }

  private applyZ() {
    for (const [id, e] of this.entries) e.el.style.zIndex = String(this.priority(id, e) + 1)
  }

  private scheduleCollide = () => {
    cancelAnimationFrame(this.raf)
    this.raf = requestAnimationFrame(this.collide)
  }

  /** Greedy label collision: higher priority labels win, overlapping ones collapse to the emoji. */
  private collide = () => {
    if (this.map.getZoom() < LABEL_ZOOM) return
    const items = [...this.entries.entries()]
      .filter(([, e]) => !e.removing)
      .map(([id, e]) => ({ id, e, pr: this.priority(id, e), pt: this.map.project(e.marker.getLngLat()) }))
      .sort((a, b) => b.pr - a.pr || a.pt.y - b.pt.y)
    const kept: { x0: number; x1: number; y0: number; y1: number }[] = []
    const W = this.map.getContainer().clientWidth
    const H = this.map.getContainer().clientHeight
    for (const it of items) {
      const sel = it.id === this.selectedId ? 1.12 : 1
      const x0 = it.pt.x - 17 * sel - 2
      const x1 = x0 + (34 + labelWidth(it.e.place.name) + 12) * sel + 4
      const y1 = it.pt.y - 4
      const y0 = y1 - 36 * sel
      const offscreen = x1 < 0 || x0 > W || y1 < 0 || y0 > H
      const hit = !offscreen && kept.some((r) => x0 < r.x1 && x1 > r.x0 && y0 < r.y1 && y1 > r.y0)
      it.e.el.classList.toggle('gm-label-hidden', hit)
      // the pin itself always occupies space even when its label is hidden
      kept.push(hit ? { x0, x1: x0 + 38, y0, y1 } : { x0, x1, y0, y1 })
    }
  }
}
