import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { chatWithCoach, generateStatusAnalysis, CoachMessage } from '@/lib/claude'
import { computeLoadHistory, computeWeeklyStats, estimateVO2max, AthleteMetrics } from '@/lib/metrics'

const chatSchema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })),
})

async function getMetrics(userId: string): Promise<AthleteMetrics> {
  const [activities, profile] = await Promise.all([
    prisma.activity.findMany({
      where: { userId },
      orderBy: { startTime: 'asc' },
    }),
    prisma.userProfile.findUnique({ where: { userId } }),
  ])

  const loadHistory = computeLoadHistory(activities, profile ?? {})
  const todayKey = new Date().toISOString().split('T')[0]
  const currentLoad = loadHistory.get(todayKey) ?? { ctl: 0, atl: 0, tsb: 0 }

  const weeklyStats = computeWeeklyStats(activities)
  const recentWeeks = weeklyStats.slice(-8)
  const avgWeeklyKm =
    recentWeeks.length > 0
      ? Math.round((recentWeeks.reduce((s, w) => s + w.totalDistanceKm, 0) / recentWeeks.length) * 10) / 10
      : 0

  const longestRunKm = Math.max(...activities.map((a) => (a.distanceMeters ?? 0) / 1000), 0)
  const vo2max = estimateVO2max(activities)

  return {
    currentLoad,
    weeklyStats,
    longestRunKm: Math.round(longestRunKm * 10) / 10,
    avgWeeklyKm,
    totalActivities: activities.length,
    estimatedVO2max: vo2max,
    paceZones: null,
    hrZones: null,
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY mangler i miljøvariablerne' }, { status: 500 })
  }

  try {
    const { messages } = chatSchema.parse(await req.json())
    const [metrics, journalEntries] = await Promise.all([
      getMetrics(session.user.id),
      prisma.journalEntry.findMany({
        where: { userId: session.user.id },
        orderBy: { date: 'desc' },
        take: 10,
      }),
    ])

    const reply = await chatWithCoach(messages as CoachMessage[], metrics, journalEntries)
    return NextResponse.json({ reply })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ukendt fejl'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ analysis: null, error: 'ANTHROPIC_API_KEY mangler' })
  }

  try {
    const [metrics, journalEntries] = await Promise.all([
      getMetrics(session.user.id),
      prisma.journalEntry.findMany({
        where: { userId: session.user.id },
        orderBy: { date: 'desc' },
        take: 10,
      }),
    ])

    const analysis = await generateStatusAnalysis(metrics, journalEntries)
    return NextResponse.json({ analysis, metrics })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ukendt fejl'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
