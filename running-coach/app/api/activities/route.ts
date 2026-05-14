import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') ?? '100')
  const offset = parseInt(searchParams.get('offset') ?? '0')
  const type = searchParams.get('type')

  const activities = await prisma.activity.findMany({
    where: {
      userId: session.user.id,
      ...(type ? { type } : {}),
    },
    orderBy: { startTime: 'desc' },
    take: Math.min(limit, 500),
    skip: offset,
    select: {
      id: true,
      name: true,
      type: true,
      startTime: true,
      durationSeconds: true,
      distanceMeters: true,
      elevationGainM: true,
      avgPaceSecPerKm: true,
      avgHeartRate: true,
      maxHeartRate: true,
      tss: true,
      ctl: true,
      atl: true,
      tsb: true,
      source: true,
    },
  })

  const total = await prisma.activity.count({
    where: { userId: session.user.id, ...(type ? { type } : {}) },
  })

  return NextResponse.json({ activities, total })
}
