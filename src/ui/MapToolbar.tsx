import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { Camera, ChevronDown, Flame, Layers, MapPin, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { LayerToggles, MapStyleId } from '../types'
import { cx } from './format'
import './ui.css'

const STYLES: { id: MapStyleId; label: string; swatch: CSSProperties }[] = [
  {
    id: 'light',
    label: 'Light',
    swatch: {
      background:
        'linear-gradient(135deg, transparent 44%, #ffffff 44%, #ffffff 56%, transparent 56%), linear-gradient(45deg, transparent 60%, #fde68a 60%, #fde68a 66%, transparent 66%), #e8ebe4',
    },
  },
  {
    id: 'dark',
    label: 'Dark',
    swatch: {
      background:
        'linear-gradient(135deg, transparent 44%, #4b5563 44%, #4b5563 56%, transparent 56%), linear-gradient(45deg, transparent 60%, #6366f1 60%, #6366f1 66%, transparent 66%), #18181b',
    },
  },
  {
    id: 'satellite',
    label: 'Satellite',
    swatch: {
      background:
        'radial-gradient(circle at 30% 30%, #6b8e4e 0 22%, transparent 23%), radial-gradient(circle at 75% 65%, #3f6b3a 0 28%, transparent 29%), linear-gradient(160deg, #8a7a5a 0%, #4d6b3c 55%, #2f4f5f 100%)',
    },
  },
]

const LAYERS: { key: keyof LayerToggles; label: string; hint: string; icon: LucideIcon; color: string }[] = [
  { key: 'places', label: 'Places', hint: 'Curated Austin spots', icon: MapPin, color: '#3b82f6' },
  { key: 'incidents', label: 'Traffic incidents', hint: 'City of Austin, live', icon: TriangleAlert, color: '#f59e0b' },
  { key: 'cameras', label: 'Cameras', hint: 'Live traffic snapshots', icon: Camera, color: '#52525b' },
  { key: 'heat', label: 'Activity heat', hint: 'Where people are posting', icon: Flame, color: '#ef4444' },
]

export default function MapToolbar(props: {
  styleId: MapStyleId
  onStyleChange: (s: MapStyleId) => void
  layers: LayerToggles
  onLayersChange: (l: LayerToggles) => void
}) {
  const { styleId, onStyleChange, layers, onLayersChange } = props
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popId = useId()
  const onCount = LAYERS.filter((l) => layers[l.key]).length

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault()
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    window.addEventListener('pointerdown', onDown)
    // capture so Esc closes the popover before the place panel hears it
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  return (
    <div ref={rootRef} className="fixed right-4 top-4 z-30 max-md:right-3 max-md:top-3">
      <div className="hp-glass flex h-11 items-center gap-1 rounded-2xl p-1">
        <div role="radiogroup" aria-label="Map style" className="flex items-center gap-0.5">
          {STYLES.map((s) => {
            const sel = s.id === styleId
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={sel}
                aria-label={`${s.label} map`}
                title={`${s.label} map`}
                onClick={() => onStyleChange(s.id)}
                className={cx(
                  'flex h-9 items-center gap-2 rounded-xl pl-1.5 pr-1.5 text-[12.5px] font-medium outline-none transition-colors md:pr-2.5',
                  'focus-visible:ring-2 focus-visible:ring-zinc-900/60',
                  sel ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-900/[0.05] hover:text-zinc-900',
                )}
              >
                <span
                  className={cx('h-6 w-6 flex-none rounded-lg ring-1 transition', sel ? 'ring-white/30' : 'ring-black/10')}
                  style={s.swatch}
                  aria-hidden
                />
                <span className="max-md:hidden">{s.label}</span>
              </button>
            )
          })}
        </div>

        <span className="mx-0.5 h-5 w-px bg-zinc-900/10" aria-hidden />

        <button
          ref={btnRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={popId}
          onClick={() => setOpen((o) => !o)}
          className={cx(
            'flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[12.5px] font-medium outline-none transition-colors',
            'focus-visible:ring-2 focus-visible:ring-zinc-900/60',
            open ? 'bg-zinc-900/[0.07] text-zinc-900' : 'text-zinc-700 hover:bg-zinc-900/[0.05] hover:text-zinc-900',
          )}
        >
          <Layers size={16} strokeWidth={2.1} />
          <span className="max-md:hidden">Layers</span>
          <span className="min-w-[18px] rounded-full bg-zinc-900/[0.07] px-1 text-center text-[11px] font-semibold tabular-nums leading-[18px] text-zinc-600">
            {onCount}
          </span>
          <ChevronDown size={14} className={cx('text-zinc-400 transition-transform duration-200 max-md:hidden', open && 'rotate-180')} />
        </button>
      </div>

      {open && (
        <div
          id={popId}
          role="dialog"
          aria-label="Map layers"
          className="hp-glass hp-anim-pop absolute right-0 top-full mt-2 w-[272px] rounded-2xl p-1.5"
        >
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">Map layers</p>
          {LAYERS.map((l) => {
            const on = layers[l.key]
            const Icon = l.icon
            return (
              <button
                key={l.key}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => onLayersChange({ ...layers, [l.key]: !on })}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none transition-colors hover:bg-zinc-900/[0.04] focus-visible:ring-2 focus-visible:ring-zinc-900/50"
              >
                <span
                  className="grid h-8 w-8 flex-none place-items-center rounded-[10px] transition-opacity"
                  style={{ background: `${l.color}1a`, color: l.color, opacity: on ? 1 : 0.55 }}
                  aria-hidden
                >
                  <Icon size={16} strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium leading-[18px] text-zinc-900">{l.label}</span>
                  <span className="block truncate text-[11.5px] leading-4 text-zinc-500">{l.hint}</span>
                </span>
                <Switch on={on} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        'relative inline-flex h-[22px] w-[38px] flex-none items-center rounded-full p-[2px] transition-colors duration-200',
        on ? 'bg-zinc-900' : 'bg-zinc-900/15',
      )}
    >
      <span
        className={cx(
          'h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.2)] transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
          on ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </span>
  )
}
