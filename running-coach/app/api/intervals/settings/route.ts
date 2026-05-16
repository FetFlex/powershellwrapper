import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAthlete } from '@/lib/intervals-api'

const schema = z.object({
  apiKey: z.string().min(1),
  athleteId: z.string().min(1),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  try {
    const { apiKey, athleteId } = schema.parse(await req.json())

    // Verify credentials
    const athlete = await getAthlete(athleteId, apiKey)

    await prisma.user.update({
      where: { id: session.user.id },
      data: { intervalsApiKey: apiKey, intervalsAthleteId: athleteId },
    })

    return NextResponse.json({ name: athlete.name })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Ugyldige felter' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Kunne ikke forbinde til Intervals.icu. Tjek API-nøgle og Athlete ID.' }, { status: 400 })
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { intervalsAthleteId: true, intervalsApiKey: true },
  })

  return NextResponse.json({
    athleteId: user?.intervalsAthleteId ?? null,
    hasApiKey: !!user?.intervalsApiKey,
  })
}
