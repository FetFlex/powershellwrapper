import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  date: z.string(),
  content: z.string().min(1).max(2000),
  mood: z.number().int().min(1).max(5).optional(),
  energyLevel: z.number().int().min(1).max(5).optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  stressLevel: z.number().int().min(1).max(5).optional(),
  lifeTags: z.array(z.string()).optional(),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  try {
    const body = schema.parse(await req.json())
    const entry = await prisma.journalEntry.create({
      data: {
        userId: session.user.id,
        date: new Date(body.date),
        content: body.content,
        mood: body.mood,
        energyLevel: body.energyLevel,
        sleepHours: body.sleepHours,
        stressLevel: body.stressLevel,
        lifeTags: JSON.stringify(body.lifeTags ?? []),
      },
    })

    return NextResponse.json({
      ...entry,
      lifeTags: JSON.parse(entry.lifeTags as string),
    }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Server fejl' }, { status: 500 })
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const entries = await prisma.journalEntry.findMany({
    where: { userId: session.user.id },
    orderBy: { date: 'desc' },
    take: 50,
  })

  return NextResponse.json({
    entries: entries.map((e) => ({
      ...e,
      lifeTags: JSON.parse(e.lifeTags as string),
    })),
  })
}
