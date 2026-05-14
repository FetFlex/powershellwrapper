// Parse GPX, TCX, and FIT files into our activity format

export interface ParsedActivity {
  name: string
  type: string
  startTime: Date
  durationSeconds: number
  distanceMeters: number | null
  elevationGainM: number | null
  avgPaceSecPerKm: number | null
  avgHeartRate: number | null
  maxHeartRate: number | null
  avgCadence: number | null
  source: 'file'
}

export async function parseGPX(content: string): Promise<ParsedActivity[]> {
  const parser = new DOMParser ? new DOMParser() : null

  // Server-side: use regex-based parsing since DOMParser isn't available
  const activities: ParsedActivity[] = []

  // Extract track metadata
  const nameMatch = content.match(/<name>([^<]+)<\/name>/)
  const name = nameMatch ? nameMatch[1].trim() : 'Imported Run'

  // Extract time points
  const timeMatches = content.match(/<time>([^<]+)<\/time>/g) ?? []
  const times = timeMatches.map((t) => new Date(t.replace(/<\/?time>/g, '')))

  if (times.length < 2) return []

  const startTime = times[0]
  const endTime = times[times.length - 1]
  const durationSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000)

  // Extract distance from track points
  const coordPattern = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"/g
  const coords: Array<{ lat: number; lon: number }> = []
  let match
  while ((match = coordPattern.exec(content)) !== null) {
    coords.push({ lat: parseFloat(match[1]), lon: parseFloat(match[2]) })
  }

  let distanceMeters = 0
  for (let i = 1; i < coords.length; i++) {
    distanceMeters += haversineDistance(coords[i - 1], coords[i])
  }

  // Extract elevation
  const eleMatches = content.match(/<ele>([^<]+)<\/ele>/g) ?? []
  const elevations = eleMatches.map((e) => parseFloat(e.replace(/<\/?ele>/g, '')))
  let elevationGain = 0
  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1]
    if (diff > 0) elevationGain += diff
  }

  // Extract heart rate
  const hrMatches = content.match(/<gpxtpx:hr>(\d+)<\/gpxtpx:hr>/g) ?? []
  const hrValues = hrMatches.map((h) => parseInt(h.replace(/<\/?gpxtpx:hr>/g, '')))
  const avgHR = hrValues.length > 0 ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length) : null
  const maxHR = hrValues.length > 0 ? Math.max(...hrValues) : null

  // Calculate pace
  const paceSecPerKm = distanceMeters > 0 ? Math.round((durationSeconds / distanceMeters) * 1000) : null

  activities.push({
    name,
    type: 'Run',
    startTime,
    durationSeconds,
    distanceMeters: distanceMeters > 0 ? Math.round(distanceMeters) : null,
    elevationGainM: elevationGain > 0 ? Math.round(elevationGain) : null,
    avgPaceSecPerKm: paceSecPerKm,
    avgHeartRate: avgHR,
    maxHeartRate: maxHR,
    avgCadence: null,
    source: 'file',
  })

  return activities
}

export async function parseTCX(content: string): Promise<ParsedActivity[]> {
  const nameMatch = content.match(/<Name>([^<]+)<\/Name>/)
  const name = nameMatch ? nameMatch[1].trim() : 'Imported Run'

  const startTimeMatch = content.match(/<Id>([^<]+)<\/Id>/)
  const startTime = startTimeMatch ? new Date(startTimeMatch[1]) : new Date()

  const totalTimeMatch = content.match(/<TotalTimeSeconds>([\d.]+)<\/TotalTimeSeconds>/)
  const durationSeconds = totalTimeMatch ? Math.round(parseFloat(totalTimeMatch[1])) : 0

  const distanceMatch = content.match(/<DistanceMeters>([\d.]+)<\/DistanceMeters>/)
  const distanceMeters = distanceMatch ? parseFloat(distanceMatch[1]) : null

  const hrMatches = content.match(/<Value>(\d+)<\/Value>/g) ?? []
  const hrValues = hrMatches.map((h) => parseInt(h.replace(/<\/?Value>/g, '')))
  const avgHR = hrValues.length > 0 ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length) : null
  const maxHR = hrValues.length > 0 ? Math.max(...hrValues) : null

  const paceSecPerKm =
    distanceMeters && distanceMeters > 0 ? Math.round((durationSeconds / distanceMeters) * 1000) : null

  return [
    {
      name,
      type: 'Run',
      startTime,
      durationSeconds,
      distanceMeters,
      elevationGainM: null,
      avgPaceSecPerKm: paceSecPerKm,
      avgHeartRate: avgHR,
      maxHeartRate: maxHR,
      avgCadence: null,
      source: 'file',
    },
  ]
}

export async function parseFIT(buffer: ArrayBuffer): Promise<ParsedActivity[]> {
  // FIT parsing is done client-side using fit-file-parser
  // This function is called from the API route with the raw buffer
  // The actual parsing happens in the browser or via dynamic import

  try {
    // Dynamic import to avoid SSR issues
    const FitParser = (await import('fit-file-parser')).default

    return new Promise((resolve, reject) => {
      const parser = new FitParser({ force: true, speedUnit: 'ms', lengthUnit: 'm', elapsedRecordField: true })

      parser.parse(buffer as unknown as Buffer, (error: Error | null, data: Record<string, unknown>) => {
        if (error) return reject(error)

        const sessions = (data.session as Record<string, unknown>[] | undefined) ?? []
        const activities: ParsedActivity[] = []

        for (const session of sessions) {
          const start = session.start_time as Date | undefined
          const duration = session.total_elapsed_time as number | undefined ?? session.total_timer_time as number | undefined ?? 0
          const distance = session.total_distance as number | undefined ?? null
          const avgHR = session.avg_heart_rate as number | undefined ?? null
          const maxHR = session.max_heart_rate as number | undefined ?? null
          const avgCadence = session.avg_cadence as number | undefined ?? null
          const elevGain = session.total_ascent as number | undefined ?? null
          const sport = (session.sport as string | undefined) ?? 'running'

          const paceSecPerKm = distance && distance > 0 ? Math.round((duration / distance) * 1000) : null

          activities.push({
            name: 'Imported Run',
            type: sport === 'running' ? 'Run' : sport,
            startTime: start ?? new Date(),
            durationSeconds: Math.round(duration),
            distanceMeters: distance,
            elevationGainM: elevGain,
            avgPaceSecPerKm: paceSecPerKm,
            avgHeartRate: avgHR,
            maxHeartRate: maxHR,
            avgCadence: avgCadence ? Math.round(avgCadence * 2) : null, // cadence x2 for spm
            source: 'file',
          })
        }

        resolve(activities)
      })
    })
  } catch {
    throw new Error('FIT file parsing failed. Ensure fit-file-parser is installed.')
  }
}

function haversineDistance(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000 // meters
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}
