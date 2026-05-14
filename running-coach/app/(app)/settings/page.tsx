'use client'

import { useState, useEffect } from 'react'

export default function SettingsPage() {
  const [intervals, setIntervals] = useState({ apiKey: '', athleteId: '', connected: false, name: '' })
  const [intervalsMsg, setIntervalsMsg] = useState('')
  const [intervalsSaving, setIntervalsSaving] = useState(false)

  useEffect(() => {
    fetch('/api/intervals/settings').then((r) => r.json()).then((data) => {
      setIntervals((s) => ({
        ...s,
        athleteId: data.athleteId ?? '',
        connected: !!(data.athleteId && data.hasApiKey),
      }))
    })
  }, [])

  async function saveIntervals() {
    if (!intervals.apiKey || !intervals.athleteId) return
    setIntervalsSaving(true)
    setIntervalsMsg('')

    const res = await fetch('/api/intervals/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: intervals.apiKey, athleteId: intervals.athleteId }),
    })
    const data = await res.json()

    if (res.ok) {
      setIntervalsMsg(`Forbundet som ${data.name}`)
      setIntervals((s) => ({ ...s, connected: true, name: data.name, apiKey: '' }))
    } else {
      setIntervalsMsg(data.error ?? 'Fejl')
    }
    setIntervalsSaving(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Indstillinger</h1>

      {/* Intervals.icu */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Intervals.icu</h2>
          {intervals.connected && (
            <span className="text-xs bg-brand-900 text-brand-300 px-2 py-1 rounded-full">
              Forbundet {intervals.name && `som ${intervals.name}`}
            </span>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-300 space-y-1">
          <p><strong>Sådan finder du din API-nøgle:</strong></p>
          <p>1. Log ind på intervals.icu</p>
          <p>2. Gå til Indstillinger → Udviklere → API-nøgle</p>
          <p><strong>Athlete ID:</strong> det er den kode i URL&apos;en, f.eks. intervals.icu/athlete/<strong>i12345</strong>/...</p>
        </div>

        <div>
          <label className="label">Athlete ID</label>
          <input
            className="input"
            placeholder="i12345"
            value={intervals.athleteId}
            onChange={(e) => setIntervals({ ...intervals, athleteId: e.target.value })}
          />
        </div>
        <div>
          <label className="label">API-nøgle</label>
          <input
            className="input"
            type="password"
            placeholder={intervals.connected ? '••••••••••••••••' : 'Indsæt API-nøgle'}
            value={intervals.apiKey}
            onChange={(e) => setIntervals({ ...intervals, apiKey: e.target.value })}
            autoComplete="new-password"
          />
        </div>

        {intervalsMsg && (
          <p className={`text-sm ${intervalsMsg.startsWith('Forbundet') ? 'text-brand-400' : 'text-red-400'}`}>
            {intervalsMsg}
          </p>
        )}

        <button onClick={saveIntervals} disabled={intervalsSaving || !intervals.apiKey || !intervals.athleteId} className="btn-primary">
          {intervalsSaving ? 'Forbinder...' : intervals.connected ? 'Opdater forbindelse' : 'Forbind Intervals.icu'}
        </button>
      </div>

      {/* AI provider info */}
      <div className="card space-y-3">
        <h2 className="font-semibold">AI-udbyder</h2>
        <p className="text-sm text-gray-400">
          AI-coaching konfigureres via miljøvariabler i <code className="bg-gray-800 px-1 rounded">.env</code>-filen på serveren.
        </p>
        <div className="bg-gray-800 rounded-lg p-3 text-xs font-mono text-gray-300 space-y-1">
          <p className="text-gray-500"># Vælg én:</p>
          <p>ANTHROPIC_API_KEY=sk-ant-...    <span className="text-gray-500"># Claude</span></p>
          <p>GOOGLE_AI_KEY=AIza...           <span className="text-gray-500"># Gemini (gratis tier)</span></p>
          <p className="text-gray-500 mt-2"># Automatisk prioritering: Claude {'>'} Gemini</p>
          <p>AI_PROVIDER=auto</p>
        </div>
        <p className="text-xs text-gray-500">
          Uden API-nøgle fungerer alle andre funktioner (import, dashboard, metrics) stadig normalt.
        </p>
      </div>
    </div>
  )
}
