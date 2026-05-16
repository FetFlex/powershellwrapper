'use client'

import { useState, useEffect } from 'react'

interface PlannedWorkout {
  id: string
  scheduledDate: string
  name: string
  type: string
  durationMinutes: number
  targetDistanceKm: number | null
  description: string | null
  completed: boolean
  intervalsEventId: string | null
}

interface Plan {
  id: string
  name: string
  startDate: string
  endDate: string
  goalDescription: string | null
  weeklySessionsTarget: number
  status: string
  workouts: PlannedWorkout[]
}

const WORKOUT_TYPE_COLORS: Record<string, string> = {
  'Easy Run': 'bg-blue-900 text-blue-300',
  'Recovery Run': 'bg-gray-800 text-gray-300',
  'Long Run': 'bg-purple-900 text-purple-300',
  'Tempo': 'bg-orange-900 text-orange-300',
  'Intervals': 'bg-red-900 text-red-300',
}

export default function TrainingPlanPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [hasIntervals, setHasIntervals] = useState(false)

  const [form, setForm] = useState({
    weeks: 8,
    sessionsPerWeek: 4,
    sessionDurations: [45, 60, 45, 90],
    intensityLevel: 'medium' as 'low' | 'medium' | 'high',
    goalDescription: '',
    startDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    pushToIntervals: false,
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/training-plan').then((r) => r.json()),
      fetch('/api/intervals/settings').then((r) => r.json()),
    ]).then(([p, s]) => {
      setPlans(p.plans ?? [])
      setHasIntervals(!!(s.athleteId && s.hasApiKey))
      setLoading(false)
    })
  }, [])

  function updateSessionCount(n: number) {
    const durations = Array.from({ length: n }, (_, i) => form.sessionDurations[i] ?? 45)
    setForm({ ...form, sessionsPerWeek: n, sessionDurations: durations })
  }

  async function generate() {
    if (!form.goalDescription.trim()) {
      setError('Beskriv venligst dit mål')
      return
    }
    setGenerating(true)
    setError('')

    const res = await fetch('/api/training-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Fejl ved generering')
      setGenerating(false)
      return
    }

    const updated = await fetch('/api/training-plan').then((r) => r.json())
    setPlans(updated.plans ?? [])
    setShowForm(false)
    setGenerating(false)
  }

  function groupByWeek(workouts: PlannedWorkout[]) {
    const weeks: Map<string, PlannedWorkout[]> = new Map()
    for (const w of workouts) {
      const d = new Date(w.scheduledDate)
      const dayOfWeek = d.getDay()
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const monday = new Date(d)
      monday.setDate(d.getDate() + diff)
      monday.setHours(0, 0, 0, 0)
      const key = monday.toISOString().split('T')[0]
      if (!weeks.has(key)) weeks.set(key, [])
      weeks.get(key)!.push(w)
    }
    return Array.from(weeks.entries()).sort(([a], [b]) => a.localeCompare(b))
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Indlæser...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Træningsplan</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          + Generer ny plan
        </button>
      </div>

      {/* Plan generator form */}
      {showForm && (
        <div className="card border-brand-800 space-y-5">
          <h2 className="font-semibold text-lg">Nyt træningsprogram</h2>

          <div>
            <label className="label">Mit mål</label>
            <input
              className="input"
              placeholder="F.eks. 'Løbe halvmarathon under 2 timer om 10 uger' eller 'Opbygge base til næste sæson'"
              value={form.goalDescription}
              onChange={(e) => setForm({ ...form, goalDescription: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Antal uger</label>
              <input
                type="number"
                className="input"
                min={4}
                max={52}
                value={form.weeks}
                onChange={(e) => setForm({ ...form, weeks: +e.target.value })}
              />
            </div>
            <div>
              <label className="label">Startdato</label>
              <input
                type="date"
                className="input"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Pas per uge</label>
              <select
                className="input"
                value={form.sessionsPerWeek}
                onChange={(e) => updateSessionCount(+e.target.value)}
              >
                {[2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} pas</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Varighed per pas (minutter)</label>
            <div className="flex flex-wrap gap-3">
              {form.sessionDurations.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-12">Pas {i + 1}</span>
                  <input
                    type="number"
                    className="input w-20"
                    min={20}
                    max={300}
                    step={5}
                    value={d}
                    onChange={(e) => {
                      const next = [...form.sessionDurations]
                      next[i] = +e.target.value
                      setForm({ ...form, sessionDurations: next })
                    }}
                  />
                  <span className="text-xs text-gray-500">min</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Intensitetsniveau</label>
            <div className="flex gap-3">
              {([['low', 'Lav (zone 2)'], ['medium', 'Moderat'], ['high', 'Hård']] as const).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm({ ...form, intensityLevel: v })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.intensityLevel === v ? 'bg-brand-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {hasIntervals && (
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="pushIntervals"
                checked={form.pushToIntervals}
                onChange={(e) => setForm({ ...form, pushToIntervals: e.target.checked })}
                className="w-4 h-4 accent-brand-500"
              />
              <label htmlFor="pushIntervals" className="text-sm text-gray-300">
                Push workouts til Intervals.icu
              </label>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button onClick={generate} disabled={generating} className="btn-primary">
              {generating ? 'Genererer plan (ca. 30 sek.)...' : 'Generer træningsplan'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">
              Annuller
            </button>
          </div>
        </div>
      )}

      {/* Existing plans */}
      {plans.length === 0 && !showForm ? (
        <div className="card text-center py-12">
          <p className="text-gray-400">Du har ingen træningsplaner endnu.</p>
          <p className="text-sm text-gray-500 mt-2">
            Klik &quot;Generer ny plan&quot; for at lave dit første AI-genererede træningsprogram.
          </p>
        </div>
      ) : (
        plans.map((plan) => {
          const weeks = groupByWeek(plan.workouts)
          return (
            <div key={plan.id} className="card space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{plan.name}</h2>
                  <p className="text-sm text-gray-400">
                    {new Date(plan.startDate).toLocaleDateString('da-DK')} –{' '}
                    {new Date(plan.endDate).toLocaleDateString('da-DK')} · {plan.weeklySessionsTarget} pas/uge
                  </p>
                  {plan.goalDescription && (
                    <p className="text-sm text-gray-400 mt-1">Mål: {plan.goalDescription}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${plan.status === 'active' ? 'bg-brand-900 text-brand-300' : 'bg-gray-800 text-gray-400'}`}>
                  {plan.status === 'active' ? 'Aktiv' : plan.status}
                </span>
              </div>

              {weeks.map(([weekKey, workouts]) => (
                <div key={weekKey}>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Uge starter {new Date(weekKey).toLocaleDateString('da-DK', { day: 'numeric', month: 'long' })}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {workouts.map((w) => (
                      <div key={w.id} className={`rounded-lg p-3 border border-gray-800 ${w.completed ? 'opacity-60' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${WORKOUT_TYPE_COLORS[w.type] ?? 'bg-gray-800 text-gray-300'}`}>
                            {w.type}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(w.scheduledDate).toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        <p className="font-medium text-sm">{w.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {w.durationMinutes} min{w.targetDistanceKm ? ` · ${w.targetDistanceKm} km` : ''}
                          {w.intervalsEventId && ' · synkroniseret til Intervals.icu'}
                        </p>
                        {w.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{w.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        })
      )}
    </div>
  )
}
