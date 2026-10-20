# Happening

A live map of what's happening in Austin right now: events, traffic, cameras, sunset and the Congress Bridge bats, and social chatter, pinned to the places people actually go.

Built for the Grokathon.

## Run it

```bash
npm install
npm run dev
```

## Stack

Vite + React 19 + TypeScript, MapLibre GL (CARTO / ESRI basemaps, no API key), Tailwind v4, lucide icons, suncalc.

## Layout

- `src/types.ts` — shared data contract (`Place`, `FeedItem`, `LiveData`, …)
- `src/data/` — `useLiveData()` hook. **Currently returns mock data** from `src/data/mock/`; each source has a `TODO(backend)` marker showing what to swap in. Sun/bat times are computed locally with suncalc.
- `src/data/places.ts` — the 15 seeded Austin places
- `src/map/` — the map: place pins, incidents, cameras, activity heat, 3D buildings, location, controls
- `src/ui/` — sidebar (Live / Upcoming / Social), place detail, camera viewer, map toolbar

## Keyboard

`⌘K` search · `+`/`-` zoom · `N` north · `T` 3D · `C` recenter · `L` locate · `Esc` close
