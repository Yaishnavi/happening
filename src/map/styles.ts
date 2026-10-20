import type { StyleSpecification } from 'maplibre-gl'
import type { MapStyleId } from '../types'

export const GLYPHS = 'https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf'
/** A font stack that the CARTO glyph server is known to serve (used by our cluster labels). */
export const FONT_BOLD = ['Montserrat Medium', 'Open Sans Bold', 'Noto Sans Regular', 'HanWangHeiLight Regular', 'NanumBarunGothic Regular']

const SATELLITE: StyleSpecification = {
  version: 8,
  name: 'Satellite',
  glyphs: GLYPHS,
  sources: {
    esri: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        'Imagery &copy; <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics',
    },
    roads: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
    },
    places: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#0b0f14' } },
    { id: 'esri-imagery', type: 'raster', source: 'esri', paint: { 'raster-saturation': -0.08, 'raster-contrast': 0.06, 'raster-fade-duration': 200 } },
    { id: 'esri-roads', type: 'raster', source: 'roads', paint: { 'raster-opacity': 0.5 } },
    { id: 'esri-places', type: 'raster', source: 'places', paint: { 'raster-opacity': 0.9 } },
  ],
}

export function styleFor(id: MapStyleId): string | StyleSpecification {
  switch (id) {
    case 'dark':
      return 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    case 'satellite':
      return SATELLITE
    default:
      return 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
  }
}

/** Theme used for HTML markers/popups/controls on top of each basemap. */
export function themeFor(id: MapStyleId): 'light' | 'dark' {
  return id === 'dark' ? 'dark' : 'light'
}
