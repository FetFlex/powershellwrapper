import { Activity } from '@prisma/client'

// CTL/ATL/TSB constants
const CTL_DECAY = Math.exp(-1 / 42)  // 42-day time constant
const ATL_DECAY = Math.exp(-1 / 7)   // 7-day time constant

export interface TrainingLoad {
  ctl: number  // Chronic Training Load (fitness)
  atl: number  // Acute Training Load (fatigue)
  tsb: number  // Training Stress Balance (form)
}

export interface WeeklyStats {
  weekStart: Date
  totalDistanceKm: number
  totalDurationHours: number
  numberOfRuns: number
  avgPaceSecPerKm: number | null
  totalTSS: number
}

export interface AthleteMetrics {
  currentLoad: TrainingLoad
  weeklyStats: WeeklyStats[]
  longestRunKm: number
  avgWeeklyKm: number
  totalActivities: number
  estimatedVO2max: number | null
  paceZones: PaceZones | null
  hrZones: HRZones | null
}

export interface PaceZones {
  zone1: { name: string; minSecPerKm: number; maxSecPerKm: number }
  zone2: { name: string; minSecPerKm: number; maxSecPerKm: number }
  zone3: { name: string; minSecPerKm: number; maxSecPerKm: number }
  zone4: { name: string; minSecPerKm: number; maxSecPerKm: number }
  zone5: { name: string; minSecPerKm: number; maxSecPerKm: number }
}

export interface HRZones {
  zone1: { name: string; min: number; max: number }
  zone2: { name: string; min: number; max: number }
  zone3: { name: string; min: number; max: number }
  zone4: { name: string; min: number; max: number }
  zone5: { name: string; min: number; max: number }
}

export function calculateTSS(activity: {
  durationSeconds: number
  avgHeartRate?: number | null
  avgPaceSecPerKm?: number | null
  tss?: number | null
}, profile: { maxHeartRate?: number | null; restingHeartRate?: number | null; currentFTP?: number | null }): number {
  // Use existing TSS if available (e.g. from Intervals.icu)
  if (activity.tss) return activity.tss

  const durationHours = activity.durationSeconds / 3600

  // HR-based TSS (hrTSS) when heart rate available
  if (activity.avgHeartRate && profile.maxHeartRate && profile.restingHeartRate) {
    const hrReserve = profile.maxHeartRate - profile.restingHeartRate
    const intensity = (activity.avgHeartRate - profile.restingHeartRate) / hrReserve
    // hrTSS formula: duration * IF^2 * 100 (IF relative to lactate threshold at ~0.88)
    const thresholdIntensity = 0.88
    const normalizedIntensity = intensity / thresholdIntensity
    return Math.round(durationHours * normalizedIntensity * normalizedIntensity * 100)
  }

  // Rough estimate based on duration alone (40 TSS/hour = easy pace)
  return Math.round(durationHours * 40)
}

export function computeLoadHistory(activities: Activity[], profile: { maxHeartRate?: number | null; restingHeartRate?: number | null; currentFTP?: number | null }): Map<string, TrainingLoad> {
  const sorted = [...activities].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )

  const loadMap = new Map<string, TrainingLoad>()
  let ctl = 0
  let atl = 0

  if (sorted.length === 0) return loadMap

  const firstDate = new Date(sorted[0].startTime)
  const today = new Date()
  const dayMs = 86400000

  // Index activities by date
  const byDate = new Map<string, Activity[]>()
  for (const act of sorted) {
    const key = new Date(act.startTime).toISOString().split('T')[0]
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key)!.push(act)
  }

  // Walk day by day from first activity to today
  let cursor = new Date(firstDate)
  cursor.setHours(0, 0, 0, 0)
  today.setHours(23, 59, 59, 999)

  while (cursor <= today) {
    const key = cursor.toISOString().split('T')[0]
    const dayActivities = byDate.get(key) ?? []
    const dayTSS = dayActivities.reduce((sum, a) => sum + calculateTSS(a, profile), 0)

    ctl = ctl * CTL_DECAY + dayTSS * (1 - CTL_DECAY)
    atl = atl * ATL_DECAY + dayTSS * (1 - ATL_DECAY)

    loadMap.set(key, {
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round((ctl - atl) * 10) / 10,
    })

    cursor = new Date(cursor.getTime() + dayMs)
  }

  return loadMap
}

export function computeWeeklyStats(activities: Activity[]): WeeklyStats[] {
  if (activities.length === 0) return []

  const byWeek = new Map<string, Activity[]>()
  for (const act of activities) {
    const d = new Date(act.startTime)
    const dayOfWeek = d.getDay()
    const mondayOffset = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek)
    const monday = new Date(d)
    monday.setDate(d.getDate() + mondayOffset)
    monday.setHours(0, 0, 0, 0)
    const key = monday.toISOString().split('T')[0]
    if (!byWeek.has(key)) byWeek.set(key, [])
    byWeek.get(key)!.push(act)
  }

  const weeks: WeeklyStats[] = []
  for (const [key, acts] of Array.from(byWeek.entries()).sort()) {
    const totalDistanceM = acts.reduce((s, a) => s + (a.distanceMeters ?? 0), 0)
    const totalDurationS = acts.reduce((s, a) => s + a.durationSeconds, 0)
    const totalTSS = acts.reduce((s, a) => s + (a.tss ?? 0), 0)
    const pacedRuns = acts.filter((a) => a.avgPaceSecPerKm && (a.distanceMeters ?? 0) > 0)
    const avgPace =
      pacedRuns.length > 0
        ? pacedRuns.reduce((s, a) => s + (a.avgPaceSecPerKm ?? 0), 0) / pacedRuns.length
        : null

    weeks.push({
      weekStart: new Date(key),
      totalDistanceKm: Math.round((totalDistanceM / 1000) * 10) / 10,
      totalDurationHours: Math.round((totalDurationS / 3600) * 10) / 10,
      numberOfRuns: acts.length,
      avgPaceSecPerKm: avgPace ? Math.round(avgPace) : null,
      totalTSS: Math.round(totalTSS),
    })
  }

  return weeks
}

export function estimateVO2max(activities: Activity[]): number | null {
  // Use best 5km effort or Riegel formula from race performances
  // Simplified: use best pace over 10+ min sustained efforts
  const longRuns = activities.filter(
    (a) => a.durationSeconds >= 600 && a.avgPaceSecPerKm && (a.distanceMeters ?? 0) >= 1000
  )
  if (longRuns.length === 0) return null

  const bestPace = Math.min(...longRuns.map((a) => a.avgPaceSecPerKm!))
  const speedMPerS = 1000 / bestPace
  // Jack Daniels VO2max estimate from velocity
  const vo2 = -4.6 + 0.182258 * speedMPerS * 60 + 0.000104 * Math.pow(speedMPerS * 60, 2)
  return Math.round(vo2 * 10) / 10
}

export function computePaceZones(thresholdPaceSecPerKm: number): PaceZones {
  // Based on Jack Daniels running zones relative to threshold pace (T-pace)
  const tp = thresholdPaceSecPerKm
  return {
    zone1: { name: 'Recovery / Easy', minSecPerKm: Math.round(tp * 1.3), maxSecPerKm: 999 },
    zone2: { name: 'Aerobic / Easy', minSecPerKm: Math.round(tp * 1.15), maxSecPerKm: Math.round(tp * 1.3) - 1 },
    zone3: { name: 'Tempo', minSecPerKm: Math.round(tp * 1.05), maxSecPerKm: Math.round(tp * 1.15) - 1 },
    zone4: { name: 'Threshold', minSecPerKm: Math.round(tp * 0.97), maxSecPerKm: Math.round(tp * 1.05) - 1 },
    zone5: { name: 'VO2max / Speed', minSecPerKm: 0, maxSecPerKm: Math.round(tp * 0.97) - 1 },
  }
}

export function computeHRZones(maxHR: number, restingHR: number): HRZones {
  const hrr = maxHR - restingHR
  const z = (pct: number) => Math.round(restingHR + hrr * pct)
  return {
    zone1: { name: 'Recovery', min: 0, max: z(0.6) },
    zone2: { name: 'Aerobic / Fat burning', min: z(0.6), max: z(0.7) },
    zone3: { name: 'Tempo', min: z(0.7), max: z(0.8) },
    zone4: { name: 'Threshold', min: z(0.8), max: z(0.9) },
    zone5: { name: 'VO2max', min: z(0.9), max: maxHR },
  }
}

export function formatPace(secPerKm: number): string {
  const min = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  return `${min}:${sec.toString().padStart(2, '0')} /km`
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s.toString().padStart(2, '0')}s`
}
