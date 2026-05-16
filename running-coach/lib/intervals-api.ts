// Intervals.icu API client

const BASE_URL = 'https://intervals.icu/api/v1'

export interface IntervalsActivity {
  id: number
  start_date_local: string
  name: string
  type: string
  distance: number        // meters
  moving_time: number     // seconds
  elapsed_time: number    // seconds
  total_elevation_gain: number
  average_speed: number   // m/s
  average_heartrate?: number
  max_heartrate?: number
  average_cadence?: number
  average_watts?: number
  icu_training_load?: number  // TSS
  icu_ctl?: number
  icu_atl?: number
  icu_tsb?: number
  description?: string
}

export interface IntervalsAthlete {
  id: string
  name: string
  sex: string
  ftp?: number
  lthr?: number
  weight?: number
  icu_resting_hr?: number
  icu_max_hr?: number
}

export interface IntervalsEvent {
  id?: number
  start_date_local: string
  name: string
  type: string
  description?: string
  category: string        // "WORKOUT"
  athlete_id: string
  moving_time?: number    // seconds
  distance?: number       // meters
  workout_doc?: WorkoutDoc
}

export interface WorkoutDoc {
  steps: WorkoutStep[]
  primaryLengthMetric: string
}

export interface WorkoutStep {
  type: string            // "steady", "warmup", "cooldown", "ramp", "free"
  duration: number        // seconds
  power?: { value: number; unit: string }
  pace?: { value: number; unit: string }
  hr?: { value: number; unit: string }
  cadence?: { value: number; unit: string }
}

function authHeader(apiKey: string): HeadersInit {
  const encoded = Buffer.from(`API_KEY:${apiKey}`).toString('base64')
  return {
    Authorization: `Basic ${encoded}`,
    'Content-Type': 'application/json',
  }
}

export async function getAthlete(athleteId: string, apiKey: string): Promise<IntervalsAthlete> {
  const res = await fetch(`${BASE_URL}/athlete/${athleteId}`, {
    headers: authHeader(apiKey),
  })
  if (!res.ok) throw new Error(`Intervals.icu error: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function getActivities(
  athleteId: string,
  apiKey: string,
  options: { oldest?: string; newest?: string; limit?: number } = {}
): Promise<IntervalsActivity[]> {
  const params = new URLSearchParams()
  if (options.oldest) params.set('oldest', options.oldest)
  if (options.newest) params.set('newest', options.newest)
  if (options.limit) params.set('limit', String(options.limit))

  const res = await fetch(`${BASE_URL}/athlete/${athleteId}/activities?${params}`, {
    headers: authHeader(apiKey),
  })
  if (!res.ok) throw new Error(`Intervals.icu error: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function createEvent(
  athleteId: string,
  apiKey: string,
  event: IntervalsEvent
): Promise<IntervalsEvent> {
  const res = await fetch(`${BASE_URL}/athlete/${athleteId}/events`, {
    method: 'POST',
    headers: authHeader(apiKey),
    body: JSON.stringify(event),
  })
  if (!res.ok) throw new Error(`Intervals.icu error: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function deleteEvent(
  athleteId: string,
  apiKey: string,
  eventId: number
): Promise<void> {
  const res = await fetch(`${BASE_URL}/athlete/${athleteId}/events/${eventId}`, {
    method: 'DELETE',
    headers: authHeader(apiKey),
  })
  if (!res.ok) throw new Error(`Intervals.icu error: ${res.status} ${await res.text()}`)
}

export function intervalsActivityToDb(act: IntervalsActivity, userId: string) {
  const speedMPerS = act.average_speed ?? 0
  const paceSecPerKm = speedMPerS > 0 ? Math.round(1000 / speedMPerS) : null

  return {
    userId,
    intervalsId: String(act.id),
    name: act.name,
    type: act.type,
    startTime: new Date(act.start_date_local),
    durationSeconds: act.moving_time || act.elapsed_time,
    distanceMeters: act.distance ?? null,
    elevationGainM: act.total_elevation_gain ?? null,
    avgPaceSecPerKm: paceSecPerKm,
    avgHeartRate: act.average_heartrate ? Math.round(act.average_heartrate) : null,
    maxHeartRate: act.max_heartrate ? Math.round(act.max_heartrate) : null,
    avgCadence: act.average_cadence ? Math.round(act.average_cadence) : null,
    avgPower: act.average_watts ? Math.round(act.average_watts) : null,
    tss: act.icu_training_load ?? null,
    ctl: act.icu_ctl ?? null,
    atl: act.icu_atl ?? null,
    tsb: act.icu_tsb ?? null,
    source: 'intervals' as const,
  }
}
