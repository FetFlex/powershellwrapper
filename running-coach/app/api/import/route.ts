import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseGPX, parseTCX, parseFIT } from '@/lib/file-parser'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]

    if (files.length === 0) {
      return NextResponse.json({ error: 'Ingen filer uploadet' }, { status: 400 })
    }

    let imported = 0
    const errors: string[] = []

    for (const file of files) {
      try {
        const ext = file.name.toLowerCase().split('.').pop()
        let activities = []

        if (ext === 'gpx') {
          const text = await file.text()
          activities = await parseGPX(text)
        } else if (ext === 'tcx') {
          const text = await file.text()
          activities = await parseTCX(text)
        } else if (ext === 'fit') {
          const buffer = await file.arrayBuffer()
          activities = await parseFIT(buffer)
        } else {
          errors.push(`${file.name}: Ikke-understøttet filformat (brug GPX, TCX eller FIT)`)
          continue
        }

        for (const act of activities) {
          await prisma.activity.create({
            data: {
              userId: session.user.id,
              name: act.name || file.name.replace(/\.[^.]+$/, ''),
              type: act.type,
              startTime: act.startTime,
              durationSeconds: act.durationSeconds,
              distanceMeters: act.distanceMeters,
              elevationGainM: act.elevationGainM,
              avgPaceSecPerKm: act.avgPaceSecPerKm,
              avgHeartRate: act.avgHeartRate,
              maxHeartRate: act.maxHeartRate,
              avgCadence: act.avgCadence,
              source: 'file',
            },
          })
          imported++
        }
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Parsefejl'}`)
      }
    }

    return NextResponse.json({ imported, errors })
  } catch {
    return NextResponse.json({ error: 'Server fejl' }, { status: 500 })
  }
}
