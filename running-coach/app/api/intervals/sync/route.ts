import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getActivities, getAthlete, intervalsActivityToDb } from '@/lib/intervals-api'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { intervalsApiKey: true, intervalsAthleteId: true },
  })

  if (!user?.intervalsApiKey || !user?.intervalsAthleteId) {
    return NextResponse.json({ error: 'Intervals.icu API nøgle mangler. Gå til Indstillinger.' }, { status: 400 })
  }

  try {
    // Get athlete info to verify credentials
    await getAthlete(user.intervalsAthleteId, user.intervalsApiKey)

    // Find newest existing activity from intervals
    const newest = await prisma.activity.findFirst({
      where: { userId: session.user.id, source: 'intervals' },
      orderBy: { startTime: 'desc' },
      select: { startTime: true },
    })

    const oldestParam = newest
      ? new Date(newest.startTime.getTime() + 1000).toISOString().split('T')[0]
      : undefined

    const rawActivities = await getActivities(user.intervalsAthleteId, user.intervalsApiKey, {
      oldest: oldestParam,
      limit: 200,
    })

    // Filter to running activities
    const runningTypes = ['Run', 'TrailRun', 'VirtualRun', 'Treadmill']
    const runs = rawActivities.filter((a) => runningTypes.includes(a.type))

    let imported = 0
    for (const act of runs) {
      const data = intervalsActivityToDb(act, session.user.id)
      await prisma.activity.upsert({
        where: { intervalsId: data.intervalsId },
        update: data,
        create: data,
      })
      imported++
    }

    return NextResponse.json({ imported, total: runs.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ukendt fejl'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
