'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { formatPace, formatDuration } from '@/lib/metrics'

interface LoadPoint {
  date: string
  ctl: number
  atl: number
  tsb: number
}

interface WeeklyStats {
  weekStart: string
  totalDistanceKm: number
  numberOfRuns: number
  totalDurationHours: number
  avgPaceSecPerKm: number | null
  totalTSS: number
}

interface MetricsData {
  currentLoad: { ctl: number; atl: number; tsb: number }
  loadHistory: LoadPoint[]
  weeklyStats: WeeklyStats[]
  totalActivities: number
  estimatedVO2max: number | null
  avgWeeklyKm: number
  longestRunKm: number
}

interface Activity {
  id: string
  name: string
  startTime: string
  durationSeconds: number
  distanceMeters: number | null
  avgPaceSecPerKm: number | null
  avgHeartRate: number | null
  tss: number | null
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/metrics').then((r) => r.json()),
      fetch('/api/activities?limit=10').then((r) => r.json()),
    ]).then(([m, a]) => {
      setMetrics(m)
      setActivities(a.activities ?? [])
      setLoading(false)
    })
  }, [])

  async function syncIntervals() {
    setSyncLoading(true)
    setSyncMsg('')
    const res = await fetch('/api/intervals/sync', { method: 'POST' })
    const data = await res.json()
    if (data.error) setSyncMsg(`Fejl: ${data.error}`)
    else setSyncMsg(`Synkroniseret: ${data.imported} nye løb importeret`)
    setSyncLoading(false)

    if (!data.error) {
      const [m, a] = await Promise.all([
        fetch('/api/metrics').then((r) => r.json()),
        fetch('/api/activities?limit=10').then((r) => r.json()),
      ])
      setMetrics(m)
      setActivities(a.activities ?? [])
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Indlæser...</div>
      </div>
    )
  }

  const tsbColor =
    (metrics?.currentLoad.tsb ?? 0) > 5
      ? 'text-brand-400'
      : (metrics?.currentLoad.tsb ?? 0) < -20
      ? 'text-red-400'
      : 'text-yellow-400'

  const recentWeeks = (metrics?.weeklyStats ?? []).slice(-12).map((w) => ({
    ...w,
    label: new Date(w.weekStart).toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit' }),
  }))

  const loadChartData = (metrics?.loadHistory ?? []).slice(-60).map((p) => ({
    ...p,
    label: p.date.slice(5),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          {syncMsg && <span className="text-sm text-gray-400">{syncMsg}</span>}
          <button onClick={syncIntervals} disabled={syncLoading} className="btn-secondary text-sm">
            {syncLoading ? 'Synkroniserer...' : 'Sync Intervals.icu'}
          </button>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Fitness (CTL)" value={metrics?.currentLoad.ctl ?? 0} sub="Kronisk træningsbelastning" />
        <StatCard label="Træthed (ATL)" value={metrics?.currentLoad.atl ?? 0} sub="Akut træningsbelastning" />
        <StatCard
          label="Form (TSB)"
          value={metrics?.currentLoad.tsb ?? 0}
          sub={
            (metrics?.currentLoad.tsb ?? 0) > 5
              ? 'Frisk og klar'
              : (metrics?.currentLoad.tsb ?? 0) < -20
              ? 'Meget træt'
              : 'Neutral'
          }
          color={tsbColor}
        />
        <StatCard
          label="VO2max (est.)"
          value={metrics?.estimatedVO2max ? `${metrics.estimatedVO2max} ml/kg/min` : 'Ukendt'}
          sub="Baseret på bedste indsats"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Gns. ugentlig km" value={`${metrics?.avgWeeklyKm ?? 0} km`} sub="Seneste 8 uger" />
        <StatCard label="Længste løb" value={`${metrics?.longestRunKm ?? 0} km`} />
        <StatCard label="Antal løb i alt" value={metrics?.totalActivities ?? 0} />
      </div>

      {/* CTL/ATL/TSB chart */}
      {loadChartData.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Træningsbelastning (seneste 60 dage)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={loadChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} interval={6} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="ctl" stroke="#22c55e" dot={false} name="Fitness (CTL)" strokeWidth={2} />
              <Line type="monotone" dataKey="atl" stroke="#f59e0b" dot={false} name="Træthed (ATL)" strokeWidth={2} />
              <Line type="monotone" dataKey="tsb" stroke="#60a5fa" dot={false} name="Form (TSB)" strokeWidth={2} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weekly km bar chart */}
      {recentWeeks.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Ugentlig kilometre</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={recentWeeks}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                formatter={(v: number) => [`${v} km`, 'Distance']}
              />
              <Bar dataKey="totalDistanceKm" fill="#16a34a" radius={[4, 4, 0, 0]} name="km" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent activities */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Seneste løb</h2>
          <Link href="/import" className="text-sm text-brand-400 hover:underline">
            Importer flere
          </Link>
        </div>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>Ingen løb endnu.</p>
            <p className="text-sm mt-2">
              <Link href="/import" className="text-brand-400 hover:underline">
                Importer dine løb
              </Link>{' '}
              eller synkroniser fra Intervals.icu.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activities.map((act) => (
              <div key={act.id} className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
                <div>
                  <p className="font-medium text-sm">{act.name}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(act.startTime).toLocaleDateString('da-DK', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                </div>
                <div className="flex gap-6 text-sm text-right">
                  {act.distanceMeters && (
                    <div>
                      <p className="font-medium">{(act.distanceMeters / 1000).toFixed(2)} km</p>
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{formatDuration(act.durationSeconds)}</p>
                  </div>
                  {act.avgPaceSecPerKm && (
                    <div className="hidden md:block">
                      <p className="text-gray-400">{formatPace(act.avgPaceSecPerKm)}</p>
                    </div>
                  )}
                  {act.avgHeartRate && (
                    <div className="hidden md:block">
                      <p className="text-gray-400">{act.avgHeartRate} bpm</p>
                    </div>
                  )}
                  {act.tss && (
                    <div className="hidden lg:block">
                      <p className="text-gray-400">TSS {Math.round(act.tss)}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/coach" className="card hover:border-brand-700 transition-colors group">
          <h3 className="font-semibold text-brand-400 group-hover:text-brand-300">AI Træner</h3>
          <p className="text-sm text-gray-400 mt-1">Chat med din AI-coach, få analyser og anbefalinger baseret på din træning.</p>
        </Link>
        <Link href="/training-plan" className="card hover:border-brand-700 transition-colors group">
          <h3 className="font-semibold text-brand-400 group-hover:text-brand-300">Træningsplan</h3>
          <p className="text-sm text-gray-400 mt-1">Generer et personligt træningsprogram og synkroniser til Intervals.icu.</p>
        </Link>
      </div>
    </div>
  )
}
