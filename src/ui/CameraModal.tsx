import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ExternalLink, ImageOff, RefreshCw, X } from 'lucide-react'
import type { TrafficCamera } from '../types'
import { bustCache, cx, secondsAgo, useNow } from './format'
import './ui.css'

const REFRESH_MS = 60_000

interface Snap {
  src: string | null
  loadedAt: number | null
  loading: boolean
  error: boolean
}

export default function CameraModal(props: { camera: TrafficCamera | null; onClose: () => void }) {
  const { camera, onClose } = props
  if (!camera) return null
  return <CameraModalInner key={camera.id} camera={camera} onClose={onClose} />
}

function CameraModalInner({ camera, onClose }: { camera: TrafficCamera; onClose: () => void }) {
  const now = useNow(1000)
  const [snap, setSnap] = useState<Snap>({ src: null, loadedAt: null, loading: true, error: false })
  const closeRef = useRef<HTMLButtonElement>(null)
  const reqRef = useRef(0)

  const load = useCallback(() => {
    const req = ++reqRef.current
    const url = bustCache(camera.imageUrl, Date.now())
    setSnap((s) => ({ ...s, loading: true }))
    const img = new Image()
    img.onload = () => {
      if (req !== reqRef.current) return
      setSnap({ src: url, loadedAt: Date.now(), loading: false, error: false })
    }
    img.onerror = () => {
      if (req !== reqRef.current) return
      setSnap((s) => ({ ...s, loading: false, error: true }))
    }
    img.src = url
  }, [camera.imageUrl])

  // initial load + auto refresh
  useEffect(() => {
    load()
    const id = window.setInterval(load, REFRESH_MS)
    return () => {
      window.clearInterval(id)
      reqRef.current++ // ignore in-flight loads after unmount
    }
  }, [load])

  // Esc (capture, so it wins over other Esc handlers) + focus management
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      prev?.focus?.({ preventScroll: true })
    }
  }, [onClose])

  const stale = snap.loadedAt != null && now - snap.loadedAt > REFRESH_MS * 2.5
  const titleId = `hp-cam-${camera.id}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" role="presentation">
      <div className="hp-anim-fade absolute inset-0 bg-zinc-950/45 backdrop-blur-[6px]" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="hp-glass hp-anim-zoom relative w-full max-w-[760px] rounded-[28px] p-2"
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-[20px] bg-zinc-900">
          {snap.src && (
            <img
              src={snap.src}
              alt={`Live traffic camera: ${camera.name}`}
              className={cx('h-full w-full object-cover transition-opacity duration-500', snap.loading ? 'opacity-90' : 'opacity-100')}
            />
          )}

          {!snap.src && snap.loading && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="flex flex-col items-center gap-3 text-white/60">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10">
                  <Camera size={20} />
                </span>
                <span className="text-[12.5px] font-medium">Connecting to camera…</span>
              </div>
              <div className="absolute inset-0 animate-pulse bg-white/[0.03]" />
            </div>
          )}

          {!snap.src && snap.error && (
            <div className="absolute inset-0 grid place-items-center text-center">
              <div className="flex flex-col items-center gap-3 px-6 text-white/70">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10">
                  <ImageOff size={20} />
                </span>
                <span className="text-[13px] font-medium text-white/85">Snapshot unavailable</span>
                <span className="max-w-[280px] text-[12px] text-white/50">This camera isn’t responding right now. It may be offline for maintenance.</span>
                <button
                  type="button"
                  onClick={load}
                  className="mt-1 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-white/25"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* top gradient for legibility */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-linear-to-b from-black/40 to-transparent" />

          {/* status pill */}
          <div className="absolute left-3 top-3 inline-flex h-7 items-center gap-1.5 rounded-full bg-black/50 px-2.5 text-[11.5px] font-semibold text-white backdrop-blur-md">
            {snap.error && snap.src ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span>STALE</span>
              </>
            ) : snap.loadedAt ? (
              <>
                <span className={cx('tracking-wide', stale ? 'text-amber-300' : 'text-white')}>LIVE</span>
              </>
            ) : (
              <>
                <span>LOADING</span>
              </>
            )}
            {snap.loadedAt && (
              <span className="font-medium tabular-nums text-white/75">· updated {secondsAgo(snap.loadedAt, now)}</span>
            )}
          </div>

          <div className="absolute right-3 top-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={load}
              aria-label="Refresh snapshot"
              title="Refresh now"
              className="grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white/90 outline-none backdrop-blur-md transition hover:bg-black/65 focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <RefreshCw size={14} strokeWidth={2.4} className={cx(snap.loading && snap.src && 'animate-spin')} />
            </button>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close camera"
              title="Close (Esc)"
              className="grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white outline-none backdrop-blur-md transition hover:bg-black/65 focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <X size={16} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 px-3 pb-2 pt-3">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-zinc-900/[0.05] text-zinc-600" aria-hidden>
            <Camera size={17} strokeWidth={2.1} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-[15px] font-semibold leading-5 text-zinc-900" title={camera.name}>
              {camera.name}
            </h2>
            <p className="truncate text-[12.5px] leading-[18px] text-zinc-500">Traffic camera · refreshes every minute</p>
          </div>
          <a
            href={camera.imageUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 flex-none items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/70 px-3 text-[12px] font-medium text-zinc-700 outline-none transition hover:bg-white hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900/50"
          >
            <ExternalLink size={13} />
            <span className="max-sm:hidden">Open image</span>
          </a>
        </div>
      </div>
    </div>
  )
}
