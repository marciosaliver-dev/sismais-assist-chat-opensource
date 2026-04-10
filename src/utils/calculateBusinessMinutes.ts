export interface BusinessHourEntry {
  day_of_week: number // 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time: string  // "HH:MM" format
  end_time: string    // "HH:MM" format
  is_active: boolean
}

/**
 * Parse a "HH:MM" string to minutes since midnight.
 */
function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

/**
 * Calculate elapsed business minutes between two timestamps,
 * considering only active business hours for each day of the week.
 *
 * @param start  - Start timestamp
 * @param end    - End timestamp
 * @param hours  - Business hours configuration (one per day_of_week, 0-6)
 * @returns Total business minutes elapsed
 */
export function calculateBusinessMinutes(
  start: Date,
  end: Date,
  hours: BusinessHourEntry[]
): number {
  if (end <= start) return 0
  if (hours.length === 0) {
    // No config — fallback to wall-clock minutes
    return Math.round((end.getTime() - start.getTime()) / 60000)
  }

  // Build a lookup: day_of_week -> { startMin, endMin } (only active days)
  const dayMap = new Map<number, { startMin: number; endMin: number }>()
  for (const h of hours) {
    if (h.is_active) {
      dayMap.set(h.day_of_week, {
        startMin: parseTimeToMinutes(h.start_time),
        endMin: parseTimeToMinutes(h.end_time),
      })
    }
  }

  let totalMinutes = 0

  // Iterate day by day
  const current = new Date(start)
  const endDate = new Date(end)

  // Cap at 365 days to prevent infinite loops
  const maxIterations = 365
  let iterations = 0

  while (current < endDate && iterations < maxIterations) {
    iterations++
    const dow = current.getDay()
    const dayConfig = dayMap.get(dow)

    if (!dayConfig) {
      // Non-business day — skip to next day
      current.setDate(current.getDate() + 1)
      current.setHours(0, 0, 0, 0)
      continue
    }

    const { startMin, endMin } = dayConfig
    if (startMin >= endMin) {
      // Invalid config — skip
      current.setDate(current.getDate() + 1)
      current.setHours(0, 0, 0, 0)
      continue
    }

    // Current time in minutes since midnight
    const currentMin = current.getHours() * 60 + current.getMinutes()

    // End of this day in the iteration
    const dayEnd = new Date(current)
    dayEnd.setDate(dayEnd.getDate() + 1)
    dayEnd.setHours(0, 0, 0, 0)

    // Effective end for this day: min of endDate and dayEnd
    const effectiveEnd = endDate < dayEnd ? endDate : dayEnd
    const effectiveEndMin = effectiveEnd < dayEnd
      ? effectiveEnd.getHours() * 60 + effectiveEnd.getMinutes()
      : 24 * 60 // full day

    // Calculate overlap: [max(currentMin, startMin), min(effectiveEndMin, endMin)]
    const overlapStart = Math.max(currentMin, startMin)
    const overlapEnd = Math.min(effectiveEndMin, endMin)

    if (overlapEnd > overlapStart) {
      totalMinutes += overlapEnd - overlapStart
    }

    // Move to next day
    current.setDate(current.getDate() + 1)
    current.setHours(0, 0, 0, 0)
  }

  return totalMinutes
}

/**
 * Calculate business seconds (convenience wrapper).
 */
export function calculateBusinessSeconds(
  start: Date,
  end: Date,
  hours: BusinessHourEntry[]
): number {
  return calculateBusinessMinutes(start, end, hours) * 60
}
