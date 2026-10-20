import type { WeatherNow } from '../../types'

// Mock NWS-style hourly forecast for a mild October evening in Austin.
const ICON_BASE = 'https://api.weather.gov/icons/land'

/** Base temperature curve (°F) by Austin-local hour — warm afternoon, cool night. */
function baseTemp(hour: number): number {
  // Peak ~84°F at 3pm, low ~62°F at 6am.
  const t = Math.cos(((hour - 15) / 24) * 2 * Math.PI)
  return Math.round(73 + 11 * t)
}

function forecastFor(hour: number): string {
  if (hour >= 21 || hour < 4) return 'Mostly Clear'
  if (hour >= 19 || hour < 7) return 'Partly Cloudy'
  if (hour < 10) return 'Mostly Sunny'
  return 'Sunny'
}

function iconFor(hour: number, forecast: string): string {
  const night = hour >= 19 || hour < 7
  const code = forecast.startsWith('Partly') ? 'sct' : forecast.startsWith('Mostly') ? 'few' : 'skc'
  return `${ICON_BASE}/${night ? 'night' : 'day'}/${code}?size=small`
}

const austinHour = (d: Date) =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: '2-digit', hourCycle: 'h23' }).format(d))

/** @param jitter small offset (±1°F) applied to the current temp to simulate live readings */
export function mockWeather(now = new Date(), jitter = 0): WeatherNow {
  const top = new Date(now)
  top.setMinutes(0, 0, 0)
  const hourly = Array.from({ length: 12 }, (_, i) => {
    const t = new Date(top.getTime() + i * 3600_000)
    const h = austinHour(t)
    return {
      time: t.toISOString(),
      tempF: baseTemp(h),
      shortForecast: forecastFor(h),
      precipChance: i > 8 ? 10 : 0,
    }
  })
  const h = austinHour(now)
  const shortForecast = forecastFor(h)
  return {
    tempF: baseTemp(h) + jitter,
    shortForecast,
    icon: iconFor(h, shortForecast),
    windSpeed: '6 mph SSE',
    precipChance: 0,
    hourly,
    updatedAt: now.toISOString(),
  }
}
