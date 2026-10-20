import type * as GeoJSON from 'geojson'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from 'react'
import {
  Map as MLMap,
  Marker,
  LngLatBounds,
  Popup,
  ScaleControl,
  type GeoJSONSource,
  type MapGeoJSONFeature,
  type MapMouseEvent,
  type PaddingOptions,
  setWorkerUrl,
} from 'maplibre-gl'
// Vite pre-bundles maplibre-gl, which breaks its import.meta.url-based worker lookup.
// The worker bundle is self-contained, so point maplibre at it explicitly.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { FeedItem, LayerToggles, MapStyleId, Place, TrafficCamera, TrafficIncident } from '../types'
import { AUSTIN_CENTER, PLACES } from '../data/places'
import { styleFor, themeFor } from './styles'
import {
  CAMERA_MINZOOM,
  EMPTY_FC,
  LYR,
  SRC,
  buildingOpacity,
  camerasGeoJSON,
  heatGeoJSON,
  incidentsGeoJSON,
  installLayers,
  setLayerVisibility,
  setSourceData,
} from './layers'
import { PlaceMarkers, feedBadges } from './markers'
import MapControls, { type GeoState } from './MapControls'
import { SEVERITY_LABEL, circlePolygon, distanceKm, escapeHtml, incidentSeverity, timeAgo, withCacheBust } from './utils'
import './map.css'

setWorkerUrl(maplibreWorkerUrl)

export interface MapViewProps {
  places: Place[] // already filtered by the UI
  incidents: TrafficIncident[]
  cameras: TrafficCamera[]
  feed: FeedItem[] // used to badge places that have live/upcoming items
  layers: LayerToggles
  styleId: MapStyleId
  selectedPlaceId: string | null
  /** Place ids to ring after an Ask Hum answer. */
  highlightIds?: string[]
  /** Bumps when a new answer should fly the map to highlightIds. */
  focusNonce?: number
  onSelectPlace: (id: string | null) => void
  onSelectCamera?: (cam: TrafficCamera) => void
  /** px padding to keep fly-to targets clear of the floating sidebar, e.g. {left: 420} */
  padding?: { top?: number; bottom?: number; left?: number; right?: number }
  sunsetMode?: boolean // optional: subtle warm tint overlay near dusk
  /** Fires with [lng, lat] on every position fix, or null if location fails */
  onUserLocation?: (lngLat: [number, number] | null) => void
}

const HOME_ZOOM = 12.6
const HOME_PITCH = 30
const AUSTIN_RADIUS_KM = 70
const ATTRIBUTION = '<a href="https://maplibre.org/" target="_blank" rel="noopener">MapLibre</a>'

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function fullPadding(p: MapViewProps["padding"]): Required<PaddingOptions> {
  return { top: p?.top ?? 0, bottom: p?.bottom ?? 0, left: p?.left ?? 0, right: p?.right ?? 0 }
}

const INTERACTIVE = [LYR.incCluster, LYR.incPoint, LYR.camCluster, LYR.camPoint] as const

export default function MapView(props: MapViewProps): JSX.Element {
  const { places, incidents, cameras, feed, layers, styleId, selectedPlaceId, highlightIds, focusNonce, padding, sunsetMode } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const markersRef = useRef<PlaceMarkers | null>(null)
  const userMarkerRef = useRef<Marker | null>(null)
  const userPosRef = useRef<{ lngLat: [number, number]; accuracy: number } | null>(null)
  const watchRef = useRef<number | null>(null)
  const hintTimer = useRef<number | undefined>(undefined)
  const styleIdRef = useRef<MapStyleId>(styleId)

  // Latest props for map event handlers (the map is created once).
  const propsRef = useRef(props)
  useLayoutEffect(() => {
    propsRef.current = props
  })

  const [bearing, setBearing] = useState(0)
  const [pitch, setPitch] = useState(0)
  const [geo, setGeo] = useState<GeoState>('off')
  const [hint, setHint] = useState<string | null>(null)

  const incidentsFC = useMemo(() => incidentsGeoJSON(incidents), [incidents])
  const camerasFC = useMemo(() => camerasGeoJSON(cameras), [cameras])
  const heatFC = useMemo(() => heatGeoJSON(places, feed), [places, feed])
  const badges = useMemo(() => feedBadges(feed), [feed])
  const dataRef = useRef({ incidents: incidentsFC, cameras: camerasFC, heat: heatFC })
  useLayoutEffect(() => {
    dataRef.current = { incidents: incidentsFC, cameras: camerasFC, heat: heatFC }
  }, [incidentsFC, camerasFC, heatFC])

  const flash = useCallback((msg: string, ms = 3200) => {
    setHint(msg)
    clearTimeout(hintTimer.current)
    hintTimer.current = window.setTimeout(() => setHint(null), ms)
  }, [])

  // ---------- map lifecycle (once) ----------
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const motion = !reducedMotion()
    const map = new MLMap({
      container: el,
      style: styleFor(styleIdRef.current),
      center: AUSTIN_CENTER,
      zoom: motion ? 11 : HOME_ZOOM,
      pitch: motion ? 0 : HOME_PITCH,
      maxPitch: 70,
      minZoom: 3,
      attributionControl: { compact: true, customAttribution: ATTRIBUTION },
      canvasContextAttributes: { antialias: true },
      fadeDuration: 180,
      dragRotate: true,
      cancelPendingTileRequestsWhileZooming: true,
    })
    mapRef.current = map
    map.addControl(new ScaleControl({ unit: 'imperial', maxWidth: 90 }), 'bottom-left')

    const markers = new PlaceMarkers(map, (id) => propsRef.current.onSelectPlace(id))
    markersRef.current = markers

    const install = () => {
      const p = propsRef.current
      const pos = userPosRef.current
      installLayers(
        map,
        {
          ...dataRef.current,
          accuracy: pos ? { type: 'FeatureCollection', features: [circlePolygon(pos.lngLat, pos.accuracy)] } : EMPTY_FC,
        },
        p.layers,
        themeFor(styleIdRef.current) === 'dark',
        map.getPitch() > 10,
      )
    }
    map.on('style.load', install)

    // ---- camera state for controls ----
    let raf = 0
    const syncCam = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        setBearing(map.getBearing())
        setPitch(map.getPitch())
      })
    }
    map.on('rotate', syncCam)
    map.on('pitch', syncCam)
    let wasPitched = false
    map.on('pitchend', () => {
      const pitched = map.getPitch() > 10
      if (pitched !== wasPitched && map.getLayer(LYR.buildings)) {
        map.setPaintProperty(LYR.buildings, 'fill-extrusion-opacity', buildingOpacity(pitched))
      }
      wasPitched = pitched
    })

    // ---- intro ----
    map.once('load', () => {
      wasPitched = map.getPitch() > 10
      if (motion) {
        map.flyTo({
          center: AUSTIN_CENTER,
          zoom: HOME_ZOOM,
          pitch: HOME_PITCH,
          bearing: -8,
          duration: 2600,
          curve: 1.2,
          padding: fullPadding(propsRef.current.padding),
          easing: (t) => 1 - Math.pow(1 - t, 3),
        })
      } else {
        map.jumpTo({ padding: fullPadding(propsRef.current.padding) })
      }
    })

    // ---- popups ----
    const incidentPopup = new Popup({ className: 'gm-popup', closeButton: true, maxWidth: '280px', offset: 14, focusAfterOpen: false })
    const cameraPopup = new Popup({ className: 'gm-popup gm-popup-camera', closeButton: false, closeOnClick: false, maxWidth: '260px', offset: 18 })
    let hoveredCam: string | null = null

    const expandCluster = async (source: string, f: MapGeoJSONFeature) => {
      const src = map.getSource(source) as GeoJSONSource | undefined
      const clusterId = f.properties?.cluster_id
      if (!src || clusterId == null) return
      try {
        const z = await src.getClusterExpansionZoom(clusterId)
        const g = f.geometry as GeoJSON.Point
        map.easeTo({ center: g.coordinates as [number, number], zoom: Math.max(z + 0.25, source === SRC.cameras ? CAMERA_MINZOOM + 0.5 : 0), duration: 600 })
      } catch {
        /* cluster vanished */
      }
    }

    const showIncident = (id: string, lngLat: [number, number]) => {
      const inc = propsRef.current.incidents.find((i) => i.id === id)
      if (!inc) return
      const sev = incidentSeverity(inc)
      incidentPopup
        .setLngLat(lngLat)
        .setHTML(
          `<div class="gm-pop">
            <div class="gm-pop-kicker"><span class="gm-sev gm-sev-${sev}"></span>${SEVERITY_LABEL[sev]} · ${escapeHtml(timeAgo(inc.time))}</div>
            <div class="gm-pop-title">${escapeHtml(inc.issue)}</div>
            <div class="gm-pop-sub">${escapeHtml(inc.address)}</div>
            ${inc.status ? `<div class="gm-pop-meta">${escapeHtml(inc.status)}</div>` : ''}
          </div>`,
        )
        .addTo(map)
    }

    const showCameraPreview = (id: string, lngLat: [number, number]) => {
      const cam = propsRef.current.cameras.find((c) => c.id === id)
      if (!cam) return
      cameraPopup
        .setLngLat(lngLat)
        .setHTML(
          `<div class="gm-cam">
            <div class="gm-cam-img"><img alt="" src="${escapeHtml(withCacheBust(cam.imageUrl))}" onload="this.parentNode.classList.add('is-loaded')" onerror="this.parentNode.classList.add('is-error')"/><span class="gm-cam-live">LIVE</span><span class="gm-cam-err">Snapshot unavailable</span></div>
            <div class="gm-cam-name">${escapeHtml(cam.name)}</div>
            <div class="gm-cam-cta">Click to open camera</div>
          </div>`,
        )
        .addTo(map)
    }

    map.on('click', (e: MapMouseEvent) => {
      const target = e.originalEvent.target as HTMLElement | null
      if (target?.closest('.gm-pin')) return
      const ids = INTERACTIVE.filter((id) => map.getLayer(id))
      const hits = ids.length ? map.queryRenderedFeatures(e.point, { layers: ids as unknown as string[] }) : []
      const f = hits[0]
      if (f) {
        const g = f.geometry as GeoJSON.Point
        const ll = g.coordinates as [number, number]
        if (f.layer.id === LYR.incCluster) void expandCluster(SRC.incidents, f)
        else if (f.layer.id === LYR.camCluster) void expandCluster(SRC.cameras, f)
        else if (f.layer.id === LYR.incPoint) showIncident(String(f.properties?.id), ll)
        else if (f.layer.id === LYR.camPoint) {
          const cam = propsRef.current.cameras.find((c) => c.id === String(f.properties?.id))
          cameraPopup.remove()
          if (cam) propsRef.current.onSelectCamera?.(cam)
        }
        return
      }
      if (propsRef.current.selectedPlaceId) propsRef.current.onSelectPlace(null)
    })

    for (const id of INTERACTIVE) {
      map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'))
      map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''))
    }
    map.on('mousemove', LYR.camPoint, (e) => {
      const f = e.features?.[0]
      if (!f) return
      const id = String(f.properties?.id)
      if (id === hoveredCam) return
      hoveredCam = id
      showCameraPreview(id, (f.geometry as GeoJSON.Point).coordinates as [number, number])
    })
    map.on('mouseleave', LYR.camPoint, () => {
      hoveredCam = null
      cameraPopup.remove()
    })

    // Resize when the parent changes size (sidebar collapse, mobile rotation...)
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(el)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      if (watchRef.current != null) navigator.geolocation?.clearWatch(watchRef.current)
      watchRef.current = null
      clearTimeout(hintTimer.current)
      markers.destroy()
      userMarkerRef.current?.remove()
      userMarkerRef.current = null
      incidentPopup.remove()
      cameraPopup.remove()
      map.remove()
      mapRef.current = null
      markersRef.current = null
    }
  }, [])

  // ---------- style switching ----------
  useEffect(() => {
    const map = mapRef.current
    if (!map || styleIdRef.current === styleId) return
    styleIdRef.current = styleId
    // full swap; our layers are re-added on 'style.load'
    map.setStyle(styleFor(styleId), { diff: false })
  }, [styleId])

  // ---------- data ----------
  useEffect(() => {
    const map = mapRef.current
    if (map) setSourceData(map, SRC.incidents, incidentsFC)
  }, [incidentsFC])
  useEffect(() => {
    const map = mapRef.current
    if (map) setSourceData(map, SRC.cameras, camerasFC)
  }, [camerasFC])
  useEffect(() => {
    const map = mapRef.current
    if (map) setSourceData(map, SRC.heat, heatFC)
  }, [heatFC])
  useEffect(() => {
    const map = mapRef.current
    if (map?.isStyleLoaded()) setLayerVisibility(map, layers)
    else map?.once('style.load', () => setLayerVisibility(map, propsRef.current.layers))
  }, [layers])

  // ---------- markers ----------
  useEffect(() => {
    markersRef.current?.setPlaces(places)
  }, [places])
  useEffect(() => {
    markersRef.current?.setBadges(badges)
  }, [badges])

  // Padding changes (sidebar/detail panel opening) – keep the selected place framed.
  const padKey = `${padding?.top ?? 0},${padding?.right ?? 0},${padding?.bottom ?? 0},${padding?.left ?? 0}`
  const firstPad = useRef(true)
  useEffect(() => {
    if (firstPad.current) {
      firstPad.current = false
      return
    }
    const map = mapRef.current
    if (!map) return
    map.easeTo({ padding: fullPadding(propsRef.current.padding), duration: 450 })
  }, [padKey])

  // ---------- selection → fly ----------
  useEffect(() => {
    markersRef.current?.setSelected(selectedPlaceId)
    const map = mapRef.current
    if (!map || !selectedPlaceId) return
    const place = propsRef.current.places.find((p) => p.id === selectedPlaceId) ?? PLACES.find((p) => p.id === selectedPlaceId)
    if (!place) return
    map.flyTo({
      center: [place.lng, place.lat],
      zoom: Math.max(map.getZoom(), 15),
      pitch: Math.max(map.getPitch(), 42),
      padding: fullPadding(propsRef.current.padding),
      duration: 1400,
      curve: 1.42,
    })
  }, [selectedPlaceId])

  useEffect(() => {
    markersRef.current?.setHighlighted(highlightIds ?? [])
  }, [highlightIds])

  useEffect(() => {
    if (!focusNonce) return
    const map = mapRef.current
    if (!map) return
    const ids = propsRef.current.highlightIds ?? []
    const pts = ids
      .map((id) => propsRef.current.places.find((p) => p.id === id))
      .filter((p): p is Place => !!p)
    if (!pts.length) return
    const pad = fullPadding(propsRef.current.padding)
    if (pts.length === 1) {
      const p = pts[0]
      map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 14.5), padding: pad, duration: 1200 })
      return
    }
    const b = new LngLatBounds()
    for (const p of pts) b.extend([p.lng, p.lat])
    map.fitBounds(b, { padding: pad, maxZoom: 14, duration: 1200 })
  }, [focusNonce])

  // ---------- control actions ----------
  const zoomBy = (d: number) => mapRef.current?.easeTo({ zoom: (mapRef.current?.getZoom() ?? 12) + d, duration: 260 })
  const resetNorth = () => mapRef.current?.easeTo({ bearing: 0, duration: 500 })
  const toggle3D = () => {
    const map = mapRef.current
    if (!map) return
    const flat = map.getPitch() > 10
    map.easeTo({ pitch: flat ? 0 : 55, bearing: flat ? map.getBearing() : map.getBearing() || -12, duration: 700 })
  }
  const recenter = () =>
    mapRef.current?.flyTo({
      center: AUSTIN_CENTER,
      zoom: HOME_ZOOM,
      pitch: HOME_PITCH,
      bearing: 0,
      padding: fullPadding(propsRef.current.padding),
      duration: 1400,
    })

  const flyToUser = () => {
    const map = mapRef.current
    const pos = userPosRef.current
    if (!map || !pos) return
    map.flyTo({ center: pos.lngLat, zoom: Math.max(map.getZoom(), 15), padding: fullPadding(propsRef.current.padding), duration: 1500 })
  }

  const updateUser = (lngLat: [number, number], accuracy: number) => {
    const map = mapRef.current
    if (!map) return
    userPosRef.current = { lngLat, accuracy }
    if (!userMarkerRef.current) {
      const el = document.createElement('div')
      el.className = 'gm-user'
      el.innerHTML = '<span class="gm-user-dot"></span>'
      el.setAttribute('aria-label', 'Your location')
      userMarkerRef.current = new Marker({ element: el, anchor: 'center' }).setLngLat(lngLat).addTo(map)
    } else userMarkerRef.current.setLngLat(lngLat)
    setSourceData(map, SRC.accuracy, { type: 'FeatureCollection', features: [circlePolygon(lngLat, Math.min(accuracy, 3000))] })
  }

  const locate = (fly = true) => {
    if (geo === 'on' && userPosRef.current) {
      flyToUser()
      return
    }
    if (!('geolocation' in navigator)) {
      setGeo('error')
      flash('Location isn’t available in this browser')
      return
    }
    setGeo('locating')
    let first = true
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const ll: [number, number] = [pos.coords.longitude, pos.coords.latitude]
        updateUser(ll, pos.coords.accuracy)
        setGeo('on')
        propsRef.current.onUserLocation?.(ll)
        if (first) {
          first = false
          if (fly) flyToUser()
          const km = distanceKm(ll, AUSTIN_CENTER)
          if (km > AUSTIN_RADIUS_KM) flash(`You’re ${Math.round(km * 0.621371).toLocaleString()} mi from Austin — tap the home button to jump back`, 4500)
        }
      },
      (err) => {
        setGeo('error')
        propsRef.current.onUserLocation?.(null)
        flash(
          err.code === err.PERMISSION_DENIED
            ? 'Location is blocked — allow it in your browser’s site settings'
            : 'Couldn’t find your location — try again',
          4500,
        )
        if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
        watchRef.current = null
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 },
    )
  }

  // ---------- keyboard shortcuts ----------
  const actions = useRef({ zoomBy, resetNorth, toggle3D, recenter, locate })
  useLayoutEffect(() => {
    actions.current = { zoomBy, resetNorth, toggle3D, recenter, locate }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName ?? ''))) return
      // the map canvas has its own keyboard handler for +/- and arrows
      if (t?.classList?.contains('maplibregl-canvas')) return
      const a = actions.current
      switch (e.key) {
        case '+':
        case '=':
          a.zoomBy(1)
          break
        case '-':
        case '_':
          a.zoomBy(-1)
          break
        case 'n':
        case 'N':
          a.resetNorth()
          break
        case 't':
        case 'T':
          a.toggle3D()
          break
        case 'c':
        case 'C':
          a.recenter()
          break
        case 'l':
        case 'L':
          a.locate()
          break
        default:
          return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Resume tracking silently if the user already granted location on a previous visit.
  useEffect(() => {
    let cancelled = false
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((st) => {
        if (!cancelled && st.state === 'granted') actions.current.locate(false)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const theme = themeFor(styleId)
  const pad = fullPadding(padding)
  const ctrlRight = Math.max(16, pad.right - 8)
  const ctrlBottom = Math.max(40, pad.bottom - 8)

  return (
    <div
      className={`gm-root gm-theme-${theme} gm-style-${styleId}`}
      style={
        {
          '--gm-pad-left': `${Math.max(0, pad.left - 16)}px`,
          '--gm-pad-right': `${Math.max(0, pad.right - 16)}px`,
          '--gm-pad-bottom': `${Math.max(0, pad.bottom - 16)}px`,
        } as CSSProperties
      }
    >
      <div ref={containerRef} className="gm-map" />
      <div className={`gm-sunset ${sunsetMode ? 'is-on' : ''}`} aria-hidden />
      <MapControls
        bearing={bearing}
        pitch={pitch}
        geo={geo}
        hint={hint}
        onZoomIn={() => zoomBy(1)}
        onZoomOut={() => zoomBy(-1)}
        onResetNorth={resetNorth}
        onToggle3D={toggle3D}
        onLocate={() => locate()}
        onRecenter={recenter}
        style={{ right: ctrlRight, bottom: ctrlBottom }}
      />
    </div>
  )
}
