// Austin-local time helpers (America/Chicago), independent of the viewer's timezone.

const TZ = 'America/Chicago'

function chicagoParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    weekday: get('weekday'), // Sun, Mon, ...
  }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Day of week (0=Sun) in Austin for the given instant. */
export function austinWeekday(d = new Date()): number {
  return WEEKDAYS.indexOf(chicagoParts(d).weekday)
}

/** The instant that is `hour:minute` Austin time, `dayOffset` days after Austin-today. */
export function austinAt(dayOffset: number, hour: number, minute = 0, now = new Date()): Date {
  const p = chicagoParts(now)
  // Start with a UTC guess, then correct by the observed Chicago offset (handles DST).
  const guess = Date.UTC(p.year, p.month - 1, p.day + dayOffset, hour, minute)
  const seen = chicagoParts(new Date(guess))
  const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute)
  return new Date(guess + (guess - seenAsUtc))
}

/** Days from Austin-today until the next given weekday (0=Sun). 0 if today. */
export function daysUntilWeekday(target: number, now = new Date()): number {
  return (target - austinWeekday(now) + 7) % 7
}
