import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateTrainingPlan } from '@/lib/claude'
import { computeLoadHistory, computeWeeklyStats, estimateVO2max, AthleteMetrics } from '@/lib/metrics'
import { createEvent } from '@/lib/intervals-api'

const schema = z.object({
  weeks: z.number().int().min(4).max(52),
  sessionsPerWeek: z.number().int().min(1).max(7),
  sessionDurations: z.array(z.number().min(20).max(300)),
  intensityLevel: z.enum(['low', 'medium', 'high']),
  goalDescription: z.string().min(1).max(500),
  startDate: z.string(),
  pushToIntervals: z.boolean().optional(),
})

async function getMetrics(userId: string): Promise<AthleteMetrics> {
  const [activities, profile] = await Promise.all([
    prisma.activity.findMany({ where: { userId }, orderBy: { startTime: 'asc' } }),
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

  return {
    currentLoad,
    weeklyStats,
    longestRunKm: Math.max(...activities.map((a) => (a.distanceMeters ?? 0) / 1000), 0),
    avgWeeklyKm,
    totalActivities: activities.length,
    estimatedVO2max: estimateVO2max(activities),
    paceZones: null,
    hrZones: null,
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY mangler' }, { status: 500 })
  }

  try {
    const body = schema.parse(await req.json())
    const [metrics, journalEntries, user] = await Promise.all([
      getMetrics(session.user.id),
      prisma.journalEntry.findMany({
        where: { userId: session.user.id },
        orderBy: { date: 'desc' },
        take: 5,
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { intervalsApiKey: true, intervalsAthleteId: true },
      }),
    ])

    const { planName, workouts } = await generateTrainingPlan(
      { ...body, startDate: new Date(body.startDate) },
      metrics,
      journalEntries
    )

    const startDate = new Date(body.startDate)
    const endDate = new Date(body.startDate)
    endDate.setDate(endDate.getDate() + body.weeks * 7)

    const plan = await prisma.trainingPlan.create({
      data: {
        userId: session.user.id,
        name: planName,
        startDate,
        endDate,
        goalDescription: body.goalDescription,
        weeklySessionsTarget: body.sessionsPerWeek,
        status: 'active',
      },
    })

    // Create workouts
    const createdWorkouts = await Promise.all(
      workouts.map((w) =>
        prisma.plannedWorkout.create({
          data: {
            planId: plan.id,
            scheduledDate: w.date,
            name: w.name,
            type: w.type,
            durationMinutes: w.durationMinutes,
            targetDistanceKm: w.targetDistanceKm,
            description: w.description,
          },
        })
      )
    )

    // Push to Intervals.icu if requested and credentials available
    if (body.pushToIntervals && user?.intervalsApiKey && user?.intervalsAthleteId) {
      for (const workout of createdWorkouts) {
        try {
          const event = await createEvent(user.intervalsAthleteId, user.intervalsApiKey, {
            start_date_local: workout.scheduledDate.toISOString().split('T')[0] + 'T08:00:00',
            name: workout.name,
            type: 'Run',
            description: workout.description ?? undefined,
            category: 'WORKOUT',
            athlete_id: user.intervalsAthleteId,
            moving_time: workout.durationMinutes * 60,
            distance: workout.targetDistanceKm ? workout.targetDistanceKm * 1000 : undefined,
          })

          if (event.id) {
            await prisma.plannedWorkout.update({
              where: { id: workout.id },
              data: { intervalsEventId: String(event.id) },
            })
          }
        } catch {
          // Non-fatal: workout saved locally even if Intervals sync fails
        }
      }
    }

    return NextResponse.json({ planId: plan.id, planName, workoutCount: createdWorkouts.length })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Ukendt fejl'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const plans = await prisma.trainingPlan.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      workouts: { orderBy: { scheduledDate: 'asc' } },
    },
  })

  return NextResponse.json({ plans })
}
