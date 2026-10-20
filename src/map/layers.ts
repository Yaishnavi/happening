import type * as GeoJSON from 'geojson'
import type { Map as MLMap, GeoJSONSource, ExpressionSpecification } from 'maplibre-gl'
import type { FeedItem, LayerToggles, Place, TrafficCamera, TrafficIncident } from '../types'
import { FONT_BOLD } from './styles'
import { SEVERITY_COLOR, cameraIcon, incidentSeverity } from './utils'

export const SRC = {
  incidents: 'gm-incidents',
  cameras: 'gm-cameras',
  heat: 'gm-heat',
  accuracy: 'gm-user-accuracy',
} as const

export const LYR = {
  buildings: 'gm-3d-buildings',
  heat: 'gm-heat',
  accuracyFill: 'gm-user-accuracy-fill',
  accuracyLine: 'gm-user-accuracy-line',
  incClusterHalo: 'gm-inc-cluster-halo',
  incCluster: 'gm-inc-cluster',
  incClusterCount: 'gm-inc-cluster-count',
  incHalo: 'gm-inc-halo',
  incPoint: 'gm-inc-point',
  camCluster: 'gm-cam-cluster',
  camClusterCount: 'gm-cam-cluster-count',
  camPoint: 'gm-cam-point',
} as const

export const CAMERA_IMG = 'gm-camera-icon'
export const CAMERA_MINZOOM = 12

type FC = GeoJSON.FeatureCollection

export function incidentsGeoJSON(list: TrafficIncident[]): FC {
  return {
    type: 'FeatureCollection',
    features: list
      .filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng))
      .map((i) => {
        const sev = incidentSeverity(i)
        return {
          type: 'Feature',
          id: i.id,
          properties: { id: i.id, sev, color: SEVERITY_COLOR[sev], rank: sev === 'high' ? 3 : sev === 'med' ? 2 : 1 },
          geometry: { type: 'Point', coordinates: [i.lng, i.lat] },
        }
      }),
  }
}

export function camerasGeoJSON(list: TrafficCamera[]): FC {
  return {
    type: 'FeatureCollection',
    features: list
      .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
      .map((c) => ({
        type: 'Feature',
        properties: { id: c.id },
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      })),
  }
}

/** Activity heat: places weighted by social + live feed items, plus free-floating geo-tagged items. */
export function heatGeoJSON(places: Place[], feed: FeedItem[]): FC {
  const weights = new Map<string, number>()
  const features: GeoJSON.Feature[] = []
  for (const f of feed) {
    if (f.tab !== 'social' && f.tab !== 'live') continue
    const w = f.tab === 'live' ? 1.5 : 1
    if (f.placeId) weights.set(f.placeId, (weights.get(f.placeId) ?? 0) + w)
    else if (f.lat != null && f.lng != null)
      features.push({ type: 'Feature', properties: { w }, geometry: { type: 'Point', coordinates: [f.lng, f.lat] } })
  }
  for (const p of places) {
    features.push({
      type: 'Feature',
      properties: { w: 0.25 + (weights.get(p.id) ?? 0) },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    })
  }
  return { type: 'FeatureCollection', features }
}

const EMPTY: FC = { type: 'FeatureCollection', features: [] }

export interface LayerData {
  incidents: FC
  cameras: FC
  heat: FC
  accuracy: FC
}

function firstSymbolLayer(map: MLMap): string | undefined {
  return map.getStyle().layers?.find((l) => l.type === 'symbol')?.id
}

function vectorBuildingSource(map: MLMap): string | undefined {
  const style = map.getStyle()
  const uses = style.layers?.find((l) => 'source-layer' in l && l['source-layer'] === 'building')
  if (uses && 'source' in uses) return uses.source as string
  return undefined
}

const vis = (on: boolean) => (on ? 'visible' : 'none') as 'visible' | 'none'

/** (Re)installs all of our sources/layers on the current style. Idempotent. */
export function installLayers(map: MLMap, data: LayerData, layers: LayerToggles, dark: boolean, pitched: boolean) {
  const beforeLabels = firstSymbolLayer(map)

  if (!map.hasImage(CAMERA_IMG)) {
    map.addImage(CAMERA_IMG, cameraIcon(dark), { pixelRatio: 2 })
  }

  // 3D buildings (vector styles only)
  const bsrc = vectorBuildingSource(map)
  if (bsrc && !map.getLayer(LYR.buildings)) {
    map.addLayer(
      {
        id: LYR.buildings,
        type: 'fill-extrusion',
        source: bsrc,
        'source-layer': 'building',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': dark ? '#2b2f38' : '#ece7df',
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'],
            14, 0,
            15.2, ['coalesce', ['get', 'render_height'], ['get', 'height'], 8],
          ],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0],
          'fill-extrusion-opacity': buildingOpacity(pitched),
          'fill-extrusion-vertical-gradient': true,
        },
      },
      beforeLabels,
    )
  }

  // Heat
  if (!map.getSource(SRC.heat)) map.addSource(SRC.heat, { type: 'geojson', data: data.heat })
  if (!map.getLayer(LYR.heat)) {
    map.addLayer(
      {
        id: LYR.heat,
        type: 'heatmap',
        source: SRC.heat,
        maxzoom: 17,
        layout: { visibility: vis(layers.heat) },
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'w'], 0, 0, 4, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 1, 15, 2],
          'heatmap-radius': ['interpolate', ['exponential', 1.6], ['zoom'], 10, 22, 13, 46, 16, 110],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 15, 0.5, 17, 0],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(168,85,247,0)',
            0.15, 'rgba(168,85,247,0.22)',
            0.35, 'rgba(192,132,252,0.4)',
            0.55, 'rgba(217,70,239,0.5)',
            0.75, 'rgba(236,72,153,0.6)',
            1, 'rgba(251,113,133,0.72)',
          ],
        },
      },
      beforeLabels,
    )
  }

  // User accuracy halo
  if (!map.getSource(SRC.accuracy)) map.addSource(SRC.accuracy, { type: 'geojson', data: data.accuracy })
  if (!map.getLayer(LYR.accuracyFill)) {
    map.addLayer({ id: LYR.accuracyFill, type: 'fill', source: SRC.accuracy, paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.12 } })
    map.addLayer({ id: LYR.accuracyLine, type: 'line', source: SRC.accuracy, paint: { 'line-color': '#3b82f6', 'line-opacity': 0.35, 'line-width': 1 } })
  }

  // Incidents
  if (!map.getSource(SRC.incidents)) {
    map.addSource(SRC.incidents, {
      type: 'geojson',
      data: data.incidents,
      cluster: true,
      clusterRadius: 44,
      clusterMaxZoom: 12,
      clusterProperties: { maxRank: ['max', ['get', 'rank']] },
    })
  }
  const incVis = vis(layers.incidents)
  const clusterColor: ExpressionSpecification = ['match', ['get', 'maxRank'], 3, SEVERITY_COLOR.high, 2, SEVERITY_COLOR.med, SEVERITY_COLOR.low]
  if (!map.getLayer(LYR.incPoint)) {
    map.addLayer({
      id: LYR.incClusterHalo,
      type: 'circle',
      source: SRC.incidents,
      filter: ['has', 'point_count'],
      layout: { visibility: incVis },
      paint: {
        'circle-color': clusterColor,
        'circle-opacity': 0.18,
        'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 2, 22, 20, 30, 100, 38],
        'circle-blur': 0.4,
      },
    })
    map.addLayer({
      id: LYR.incCluster,
      type: 'circle',
      source: SRC.incidents,
      filter: ['has', 'point_count'],
      layout: { visibility: incVis },
      paint: {
        'circle-color': clusterColor,
        'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 2, 13, 20, 17, 100, 22],
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#ffffff',
      },
    })
    map.addLayer({
      id: LYR.incClusterCount,
      type: 'symbol',
      source: SRC.incidents,
      filter: ['has', 'point_count'],
      layout: {
        visibility: incVis,
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': FONT_BOLD,
        'text-size': 12,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#ffffff' },
    })
    map.addLayer({
      id: LYR.incHalo,
      type: 'circle',
      source: SRC.incidents,
      filter: ['!', ['has', 'point_count']],
      layout: { visibility: incVis },
      paint: {
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.2,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 10, 15, 18],
        'circle-blur': 0.5,
      },
    })
    map.addLayer({
      id: LYR.incPoint,
      type: 'circle',
      source: SRC.incidents,
      filter: ['!', ['has', 'point_count']],
      layout: { visibility: incVis },
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4.5, 15, 7],
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 15, 2.5],
        'circle-stroke-color': '#ffffff',
        'circle-radius-transition': { duration: 200 },
      },
    })
  }

  // Cameras
  if (!map.getSource(SRC.cameras)) {
    map.addSource(SRC.cameras, { type: 'geojson', data: data.cameras, cluster: true, clusterRadius: 40, clusterMaxZoom: 14 })
  }
  const camVis = vis(layers.cameras)
  if (!map.getLayer(LYR.camPoint)) {
    map.addLayer({
      id: LYR.camCluster,
      type: 'circle',
      source: SRC.cameras,
      minzoom: CAMERA_MINZOOM,
      filter: ['has', 'point_count'],
      layout: { visibility: camVis },
      paint: {
        'circle-color': dark ? '#3f3f46' : '#334155',
        'circle-opacity': 0.92,
        'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 2, 12, 20, 16, 80, 20],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    })
    map.addLayer({
      id: LYR.camClusterCount,
      type: 'symbol',
      source: SRC.cameras,
      minzoom: CAMERA_MINZOOM,
      filter: ['has', 'point_count'],
      layout: {
        visibility: camVis,
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': FONT_BOLD,
        'text-size': 11,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#ffffff' },
    })
    map.addLayer({
      id: LYR.camPoint,
      type: 'symbol',
      source: SRC.cameras,
      minzoom: CAMERA_MINZOOM,
      filter: ['!', ['has', 'point_count']],
      layout: {
        visibility: camVis,
        'icon-image': CAMERA_IMG,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.85, 16, 1.1],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: { 'icon-opacity': ['interpolate', ['linear'], ['zoom'], CAMERA_MINZOOM, 0, CAMERA_MINZOOM + 0.4, 1] },
    })
  }
}

export function buildingOpacity(pitched: boolean): ExpressionSpecification | number {
  return pitched ? ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 0.6] : 0
}

export function setLayerVisibility(map: MLMap, layers: LayerToggles) {
  const set = (ids: string[], on: boolean) => {
    for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis(on))
  }
  set([LYR.incClusterHalo, LYR.incCluster, LYR.incClusterCount, LYR.incHalo, LYR.incPoint], layers.incidents)
  set([LYR.camCluster, LYR.camClusterCount, LYR.camPoint], layers.cameras)
  set([LYR.heat], layers.heat)
}

export function setSourceData(map: MLMap, id: string, data: FC) {
  const src = map.getSource(id) as GeoJSONSource | undefined
  src?.setData(data)
}

export { EMPTY as EMPTY_FC }
