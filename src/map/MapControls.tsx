import { House, LoaderCircle, LocateFixed, Locate, LocateOff, Minus, Plus } from 'lucide-react'
import type { CSSProperties } from 'react'

export type GeoState = 'off' | 'locating' | 'on' | 'error'

interface Props {
  bearing: number
  pitch: number
  geo: GeoState
  hint: string | null
  onZoomIn: () => void
  onZoomOut: () => void
  onResetNorth: () => void
  onToggle3D: () => void
  onLocate: () => void
  onRecenter: () => void
  style?: CSSProperties
}

export default function MapControls(p: Props) {
  const rotated = Math.abs(p.bearing) > 0.5
  const is3D = p.pitch > 10
  return (
    <div className="gm-controls" style={p.style}>
      {p.hint && <div className="gm-hint" role="status">{p.hint}</div>}

      <div className="gm-glass gm-stack">
        <button type="button" className="gm-btn" onClick={p.onZoomIn} aria-label="Zoom in" title="Zoom in (+)">
          <Plus size={18} strokeWidth={2.25} />
        </button>
        <span className="gm-divider" />
        <button type="button" className="gm-btn" onClick={p.onZoomOut} aria-label="Zoom out" title="Zoom out (−)">
          <Minus size={18} strokeWidth={2.25} />
        </button>
      </div>

      <button
        type="button"
        className={`gm-glass gm-btn gm-round gm-compass ${rotated ? 'is-rotated' : ''}`}
        onClick={p.onResetNorth}
        aria-label="Reset bearing to north"
        title="Reset north (N)"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" style={{ transform: `rotate(${-p.bearing}deg)` }} aria-hidden>
          <path d="M12 2.5 15.2 12H8.8Z" fill="#ef4444" />
          <path d="M12 21.5 8.8 12h6.4Z" fill="currentColor" opacity="0.38" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" opacity="0.9" />
        </svg>
      </button>

      <button
        type="button"
        className={`gm-glass gm-btn gm-round gm-text ${is3D ? 'is-active' : ''}`}
        onClick={p.onToggle3D}
        aria-label={is3D ? 'Switch to 2D view' : 'Switch to 3D view'}
        aria-pressed={is3D}
        title={is3D ? '2D view (T)' : '3D view (T)'}
      >
        {is3D ? '2D' : '3D'}
      </button>

      <button
        type="button"
        className={`gm-glass gm-btn gm-round ${p.geo === 'on' ? 'is-active' : ''} ${p.geo === 'error' ? 'is-error' : ''}`}
        onClick={p.onLocate}
        aria-label="Show my location"
        title="My location (L)"
      >
        {p.geo === 'locating' ? (
          <LoaderCircle size={18} strokeWidth={2.25} className="gm-spin" />
        ) : p.geo === 'on' ? (
          <LocateFixed size={18} strokeWidth={2.25} />
        ) : p.geo === 'error' ? (
          <LocateOff size={18} strokeWidth={2.25} />
        ) : (
          <Locate size={18} strokeWidth={2.25} />
        )}
      </button>

      <button type="button" className="gm-glass gm-btn gm-round" onClick={p.onRecenter} aria-label="Recenter on Austin" title="Recenter on Austin (C)">
        <House size={17} strokeWidth={2.25} />
      </button>
    </div>
  )
}
