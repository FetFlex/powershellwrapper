// AI coaching logic - provider-agnostic via ai-client.ts
import { JournalEntry } from '@prisma/client'
import { getAIClient, AIMessage } from './ai-client'
import { AthleteMetrics, formatPace } from './metrics'

export type CoachMessage = AIMessage

const SYSTEM_PROMPT = `Du er en erfaren løbetræner og sportsfysiolog med speciale i udholdenhedstræning.
Du taler dansk med atleter og giver præcise, datadrevne anbefalinger baseret på deres træningshistorik.

Du kombinerer viden om:
- Periodisering og træningsplanlægning (Lydiard, Jack Daniels, 80/20-metoden)
- Træningsbelastning (CTL/ATL/TSB - fitness/træthed/form)
- Løbsøkonomi og pacing
- Restitution og overtrænningsforebyggelse

Vær konkret, direkte og brug trænerens sprog. Giv altid en begrundelse baseret på atletens data.`

export interface TrainingPlanRequest {
  weeks: number
  sessionsPerWeek: number
  sessionDurations: number[]
  intensityLevel: 'low' | 'medium' | 'high'
  goalDescription: string
  startDate: Date
}

function formatMetricsContext(metrics: AthleteMetrics): string {
  const recentWeeks = metrics.weeklyStats.slice(-8)
  return `
## Aktuel træningsstatus
- Fitness (CTL): ${metrics.currentLoad.ctl}
- Træthed (ATL): ${metrics.currentLoad.atl}
- Form (TSB): ${metrics.currentLoad.tsb}
- Gennemsnitlig ugentlig km (seneste 8 uger): ${metrics.avgWeeklyKm} km
- Længste løb: ${metrics.longestRunKm} km
- Estimeret VO2max: ${metrics.estimatedVO2max ?? 'ukendt'}
- Antal aktiviteter i alt: ${metrics.totalActivities}

## Seneste 8 uger
${recentWeeks
  .map(
    (w) =>
      `- Uge ${w.weekStart.toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit' })}: ${w.totalDistanceKm} km, ${w.numberOfRuns} løb, ${w.totalDurationHours}t${w.avgPaceSecPerKm ? ', ' + formatPace(w.avgPaceSecPerKm) : ''}`
  )
  .join('\n')}
`
}

function formatJournalContext(entries: JournalEntry[]): string {
  if (entries.length === 0) return ''
  const recent = entries.slice(-5)
  return `
## Atletens egne noter (seneste)
${recent
  .map(
    (e) =>
      `- ${new Date(e.date).toLocaleDateString('da-DK')}: ${e.content}${e.mood ? ` [humør: ${e.mood}/5]` : ''}${e.energyLevel ? ` [energi: ${e.energyLevel}/5]` : ''}`
  )
  .join('\n')}
`
}

export async function chatWithCoach(
  messages: CoachMessage[],
  metrics: AthleteMetrics,
  journalEntries: JournalEntry[]
): Promise<string> {
  const context = formatMetricsContext(metrics) + formatJournalContext(journalEntries)
  const systemWithContext = `${SYSTEM_PROMPT}\n\n${context}\n\nSvar altid på dansk og baser dine svar på ovenstående data.`

  const client = getAIClient()
  return client.chat(messages, systemWithContext)
}

export async function generateTrainingPlan(
  request: TrainingPlanRequest,
  metrics: AthleteMetrics,
  journalEntries: JournalEntry[]
): Promise<{
  planName: string
  workouts: Array<{
    date: Date
    name: string
    type: string
    durationMinutes: number
    targetDistanceKm: number | null
    description: string
  }>
}> {
  const context = formatMetricsContext(metrics) + formatJournalContext(journalEntries)

  const prompt = `${context}

Generer et ${request.weeks}-ugers løbetræningsprogram med følgende parametre:
- ${request.sessionsPerWeek} træningspas per uge
- Varighed per pas: ${request.sessionDurations.map((d, i) => `Pas ${i + 1}: ${d} min`).join(', ')}
- Intensitetsniveau: ${request.intensityLevel === 'low' ? 'Lav (primært zone 2)' : request.intensityLevel === 'medium' ? 'Moderat (blanding zone 2-4)' : 'Høj (inkl. intervaller og tempo)'}
- Mål: ${request.goalDescription}
- Startdato: ${request.startDate.toLocaleDateString('da-DK')}

Returner et JSON-objekt med denne struktur (KUN JSON, ingen markdown eller forklaring):
{
  "planName": "Planens navn",
  "workouts": [
    {
      "date": "YYYY-MM-DD",
      "name": "Workout navn",
      "type": "Easy Run|Tempo|Intervals|Long Run|Recovery Run",
      "durationMinutes": 45,
      "targetDistanceKm": 8.0,
      "description": "Detaljeret beskrivelse inkl. opvarmning, hoveddel og nedkøling"
    }
  ]
}

Sørg for progressiv stigning (ca. 10%/uge), restitutionstage, én lang tur/uge.
Tilpas til atletens nuværende fitnessniveau (CTL: ${metrics.currentLoad.ctl}).`

  const client = getAIClient()
  const text = await client.chat([{ role: 'user', content: prompt }], SYSTEM_PROMPT)

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI returnerede ikke gyldigt JSON')

  const parsed = JSON.parse(jsonMatch[0])
  return {
    planName: parsed.planName,
    workouts: parsed.workouts.map((w: Record<string, unknown>) => ({
      ...w,
      date: new Date(w.date as string),
    })),
  }
}

export async function generateStatusAnalysis(
  metrics: AthleteMetrics,
  journalEntries: JournalEntry[]
): Promise<string> {
  const context = formatMetricsContext(metrics) + formatJournalContext(journalEntries)

  const client = getAIClient()
  return client.chat(
    [
      {
        role: 'user',
        content: `${context}\n\nLav en kort træneranalyse (3-4 afsnit) af atletens nuværende status. Inkluder: overordnet vurdering, styrker, opmærksomhedspunkter, og 2-3 konkrete anbefalinger til næste uge.`,
      },
    ],
    SYSTEM_PROMPT
  )
}
