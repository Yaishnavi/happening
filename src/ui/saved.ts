import { useSyncExternalStore } from 'react'

// Saved places, persisted per-browser. One shared store so the detail card,
// sidebar chip and map filter all stay in sync.
const KEY = 'happening:saved'
const listeners = new Set<() => void>()

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

let snapshot = read()

export function toggleSaved(id: string) {
  snapshot = snapshot.includes(id) ? snapshot.filter((x) => x !== id) : [...snapshot, id]
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot))
  } catch {
    /* storage unavailable — keep in-memory state only */
  }
  listeners.forEach((l) => l())
}

export function useSaved(): string[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => snapshot,
  )
}
