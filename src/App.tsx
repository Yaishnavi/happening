import { useEffect, useMemo, useState } from 'react'
import MapView from './map/MapView'
import Sidebar from './ui/Sidebar'
import PlaceDetail from './ui/PlaceDetail'
import CameraModal from './ui/CameraModal'
import MapToolbar from './ui/MapToolbar'
import { useLiveData } from './data/useLiveData'
import { resolveAnswerPlaceIds } from './data/hum'
import { useSaved } from './ui/saved'
import type { Category, FeedTab, LayerToggles, MapStyleId, TrafficCamera } from './types'

function useIsDesktop() {
  const q = '(min-width: 768px)'
  const [d, setD] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setD(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return d
}

export default function App() {
  const live = useLiveData()
  const isDesktop = useIsDesktop()
  const [tab, setTab] = useState<FeedTab>('live')
  const [query, setQuery] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [highlightIds, setHighlightIds] = useState<string[]>([])
  const [focusNonce, setFocusNonce] = useState(0)
  const [savedOnly, setSavedOnly] = useState(false)
  const saved = useSaved()
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [camera, setCamera] = useState<TrafficCamera | null>(null)
  const [styleId, setStyleId] = useState<MapStyleId>('light')
  const [layers, setLayers] = useState<LayerToggles>({ places: true, incidents: true, cameras: true, heat: false })

  const places = live.places
  const visiblePlaces = useMemo(() => {
    const q = query.trim().toLowerCase()
    return places.filter(
      (p) =>
        (categories.length === 0 || categories.includes(p.category)) &&
        (!savedOnly || saved.includes(p.id)) &&
        (!q || `${p.name} ${p.neighborhood} ${p.blurb}`.toLowerCase().includes(q)),
    )
  }, [places, query, categories, savedOnly, saved])

  const selectedPlace = places.find((p) => p.id === selectedPlaceId) ?? null

  const onAskPlaces = (ids: string[]) => {
    const resolved = resolveAnswerPlaceIds(ids, places)
    setHighlightIds(resolved)
    setFocusNonce((n) => n + 1)
    if (resolved.length === 1) setSelectedPlaceId(resolved[0])
  }

  const sunsetMode = useMemo(() => {
    if (!live.sun) return false
    const dt = Math.abs(Date.now() - new Date(live.sun.sunset).getTime())
    return dt < 45 * 60 * 1000
  }, [live.sun])

  const padding = isDesktop
    ? { left: 432, right: selectedPlace ? 392 : 24, top: 24, bottom: 24 }
    : { bottom: 260, top: 24, left: 16, right: 16 }

  return (
    <div className="fixed inset-0 overflow-hidden bg-zinc-100">
      <MapView
        places={layers.places ? visiblePlaces : []}
        incidents={live.incidents}
        cameras={live.cameras}
        feed={live.feed}
        layers={layers}
        styleId={styleId}
        selectedPlaceId={selectedPlaceId}
        highlightIds={highlightIds}
        focusNonce={focusNonce}
        onSelectPlace={setSelectedPlaceId}
        onSelectCamera={setCamera}
        padding={padding}
        sunsetMode={sunsetMode}
        onUserLocation={setUserLocation}
      />
      <Sidebar
        places={places}
        placeState={live.placeState}
        humUpdatedAt={live.humUpdatedAt}
        onAskPlaces={onAskPlaces}
        feed={live.feed}
        tab={tab}
        onTabChange={setTab}
        query={query}
        onQueryChange={setQuery}
        categories={categories}
        onCategoriesChange={setCategories}
        selectedPlaceId={selectedPlaceId}
        onSelectPlace={setSelectedPlaceId}
        sources={live.sources}
        weather={live.weather}
        sun={live.sun}
        userLocation={userLocation}
        savedOnly={savedOnly}
        onSavedOnlyChange={setSavedOnly}
      />
      <MapToolbar styleId={styleId} onStyleChange={setStyleId} layers={layers} onLayersChange={setLayers} />
      {selectedPlace && (
        <PlaceDetail
          key={selectedPlace.id}
          place={selectedPlace}
          state={live.placeState[selectedPlace.id]}
          feed={live.feed}
          weather={live.weather}
          userLocation={userLocation}
          onClose={() => setSelectedPlaceId(null)}
        />
      )}
      <CameraModal camera={camera} onClose={() => setCamera(null)} />
    </div>
  )
}
