import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeLoadHistory, computeWeeklyStats, estimateVO2max, computePaceZones, computeHRZones } from '@/lib/metrics'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const [activities, profile] = await Promise.all([
    prisma.activity.findMany({
      where: { userId: session.user.id },
      orderBy: { startTime: 'asc' },
    }),
    prisma.userProfile.findUnique({ where: { userId: session.user.id } }),
  ])

  const loadHistory = computeLoadHistory(activities, profile ?? {})
  const loadArray = Array.from(loadHistory.entries())
    .map(([date, load]) => ({ date, ...load }))
    .slice(-90) // last 90 days

  const todayKey = new Date().toISOString().split('T')[0]
  const currentLoad = loadHistory.get(todayKey) ?? { ctl: 0, atl: 0, tsb: 0 }

  const weeklyStats = computeWeeklyStats(activities)
  const vo2max = estimateVO2max(activities)

  const recentWeeks = weeklyStats.slice(-8)
  const avgWeeklyKm =
    recentWeeks.length > 0
      ? Math.round((recentWeeks.reduce((s, w) => s + w.totalDistanceKm, 0) / recentWeeks.length) * 10) / 10
      : 0

  const paceZones =
    profile?.currentFTP ? computePaceZones(profile.currentFTP) : null
  const hrZones =
    profile?.maxHeartRate && profile?.restingHeartRate
      ? computeHRZones(profile.maxHeartRate, profile.restingHeartRate)
      : null

  return NextResponse.json({
    currentLoad,
    loadHistory: loadArray,
    weeklyStats,
    totalActivities: activities.length,
    estimatedVO2max: vo2max,
    avgWeeklyKm,
    longestRunKm: Math.max(...activities.map((a) => (a.distanceMeters ?? 0) / 1000), 0),
    paceZones,
    hrZones,
  })
}
