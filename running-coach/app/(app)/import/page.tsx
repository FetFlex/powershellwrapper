'use client'

import { useState, useCallback } from 'react'

export default function ImportPage() {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null)

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setResult(null)

    const formData = new FormData()
    for (const file of Array.from(files)) {
      formData.append('files', file)
    }

    const res = await fetch('/api/import', { method: 'POST', body: formData })
    const data = await res.json()
    setResult(data)
    setUploading(false)
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Importer løb</h1>

      {/* Intervals.icu guide */}
      <div className="card">
        <h2 className="font-semibold mb-3">Sync fra Intervals.icu</h2>
        <p className="text-sm text-gray-400 mb-3">
          Den hurtigste måde at importere alle dine løb. Kræver at du har sat din Intervals.icu API-nøgle op under{' '}
          <span className="text-brand-400">Indstillinger</span>. Derefter bruger du &quot;Sync&quot;-knappen på dashboardet.
        </p>
        <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-300 font-mono space-y-1">
          <p>1. Gå til Indstillinger → sæt Intervals.icu API-nøgle</p>
          <p>2. Gå til Dashboard → klik &quot;Sync Intervals.icu&quot;</p>
          <p>3. Alle løb importeres automatisk</p>
        </div>
      </div>

      {/* Apple Health guide */}
      <div className="card">
        <h2 className="font-semibold mb-3">Eksporter fra Apple Health / Apple Watch</h2>
        <p className="text-sm text-gray-400 mb-3">
          Da vi er en web-app kan vi ikke læse direkte fra Apple Health. Du kan eksportere via{' '}
          <strong>HealthFit-appen</strong> (koster ca. 30 kr) som eksporterer som FIT-filer.
        </p>
        <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-300 space-y-1">
          <p><strong>Via HealthFit (anbefalet):</strong></p>
          <p>1. Download HealthFit fra App Store</p>
          <p>2. Eksporter aktiviteter som FIT-filer</p>
          <p>3. Upload dem her nedenfor</p>
          <p className="mt-2"><strong>Via Apple Health direkte:</strong></p>
          <p>Sundhed → Profil → Eksporter alle sundhedsdata → Del ZIP → udpak og upload .xml-filen (GPX format)</p>
        </div>
      </div>

      {/* File upload */}
      <div className="card">
        <h2 className="font-semibold mb-3">Upload filer</h2>
        <p className="text-sm text-gray-400 mb-4">
          Understøttede formater: <strong>.gpx</strong>, <strong>.tcx</strong>, <strong>.fit</strong>
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
            dragging ? 'border-brand-500 bg-brand-950/20' : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <div className="text-4xl mb-3">🏃</div>
          <p className="text-gray-300 font-medium">Træk og slip filer her</p>
          <p className="text-gray-500 text-sm mt-1">eller</p>
          <label className="cursor-pointer">
            <span className="btn-primary inline-block mt-3 text-sm">Vælg filer</span>
            <input
              type="file"
              accept=".gpx,.tcx,.fit"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        </div>

        {uploading && (
          <div className="mt-4 text-center text-gray-400">
            <div className="inline-block animate-spin text-2xl">⟳</div>
            <p className="text-sm mt-2">Parser og importerer filer...</p>
          </div>
        )}

        {result && (
          <div className={`mt-4 p-4 rounded-lg ${result.errors.length === 0 ? 'bg-brand-950/40 border border-brand-800' : 'bg-yellow-950/40 border border-yellow-800'}`}>
            <p className={`font-medium ${result.errors.length === 0 ? 'text-brand-400' : 'text-yellow-400'}`}>
              {result.imported} løb importeret
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-sm text-red-400">{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* WorkOutDoors export guide */}
      <div className="card">
        <h2 className="font-semibold mb-3">Andre apps</h2>
        <div className="space-y-2 text-sm text-gray-400">
          <p><strong className="text-gray-200">Garmin Connect:</strong> Aktiviteter → vælg aktivitet → Eksporter original → upload .fit fil</p>
          <p><strong className="text-gray-200">Strava:</strong> Aktivitet → Mere → Eksporter GPX → upload her</p>
          <p><strong className="text-gray-200">WorkOutDoors:</strong> Eksporter som GPX eller FIT fra aktivitetslisten</p>
        </div>
      </div>
    </div>
  )
}
