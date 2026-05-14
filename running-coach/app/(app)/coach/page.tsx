'use client'

import { useState, useEffect, useRef } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const LIFE_TAGS = [
  { value: 'sick', label: 'Sygdom' },
  { value: 'travel', label: 'Rejse' },
  { value: 'high_stress', label: 'Højt stress' },
  { value: 'race', label: 'Løb/konkurrence' },
  { value: 'injury', label: 'Skade' },
  { value: 'extra_tired', label: 'Ekstra træt' },
]

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState('')
  const [analysisLoading, setAnalysisLoading] = useState(true)
  const [aiAvailable, setAiAvailable] = useState(true)
  const [showJournal, setShowJournal] = useState(false)
  const [journal, setJournal] = useState({ content: '', mood: 3, energyLevel: 3, sleepHours: 7.5, lifeTags: [] as string[] })
  const [journalSaving, setJournalSaving] = useState(false)
  const [journalMsg, setJournalMsg] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/coach')
      .then((r) => r.json())
      .then((data) => {
        if (data.error && data.error.includes('API')) setAiAvailable(false)
        setAnalysis(data.analysis ?? '')
        setAnalysisLoading(false)
      })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMessage: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMessages }),
    })
    const data = await res.json()
    setMessages([...newMessages, { role: 'assistant', content: data.reply ?? data.error ?? 'Fejl' }])
    setLoading(false)
  }

  async function saveJournal() {
    if (!journal.content.trim()) return
    setJournalSaving(true)
    const res = await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...journal, date: new Date().toISOString() }),
    })
    if (res.ok) {
      setJournalMsg('Note gemt!')
      setJournal({ content: '', mood: 3, energyLevel: 3, sleepHours: 7.5, lifeTags: [] })
      setShowJournal(false)
    } else {
      setJournalMsg('Fejl ved gemning')
    }
    setJournalSaving(false)
    setTimeout(() => setJournalMsg(''), 3000)
  }

  function toggleTag(tag: string) {
    setJournal((j) => ({
      ...j,
      lifeTags: j.lifeTags.includes(tag) ? j.lifeTags.filter((t) => t !== tag) : [...j.lifeTags, tag],
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI Træner</h1>
        <div className="flex gap-2">
          {journalMsg && <span className="text-sm text-brand-400">{journalMsg}</span>}
          <button onClick={() => setShowJournal(!showJournal)} className="btn-secondary text-sm">
            + Tilføj note
          </button>
        </div>
      </div>

      {!aiAvailable && (
        <div className="card border-yellow-700 bg-yellow-950/30">
          <p className="text-yellow-400 text-sm font-medium">AI-funktioner er ikke aktiveret</p>
          <p className="text-gray-400 text-sm mt-1">
            Tilføj <code className="bg-gray-800 px-1 rounded">ANTHROPIC_API_KEY</code> eller{' '}
            <code className="bg-gray-800 px-1 rounded">GOOGLE_AI_KEY</code> til din{' '}
            <code className="bg-gray-800 px-1 rounded">.env</code> fil for at aktivere AI-coaching.
          </p>
        </div>
      )}

      {/* Journal entry form */}
      {showJournal && (
        <div className="card border-brand-800">
          <h2 className="font-semibold mb-4">Fortæl din træner om dig selv</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Hvad vil du dele? (form, hændelser, oplevelser)</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="F.eks. 'Har haft en stressende uge på arbejde. Benene føles tunge. Sigter mod et halvmarathon om 10 uger...'"
                value={journal.content}
                onChange={(e) => setJournal({ ...journal, content: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Humør (1-5)</label>
                <input type="range" min={1} max={5} value={journal.mood} onChange={(e) => setJournal({ ...journal, mood: +e.target.value })} className="w-full accent-brand-500" />
                <p className="text-center text-sm text-gray-400">{journal.mood}/5</p>
              </div>
              <div>
                <label className="label">Energi (1-5)</label>
                <input type="range" min={1} max={5} value={journal.energyLevel} onChange={(e) => setJournal({ ...journal, energyLevel: +e.target.value })} className="w-full accent-brand-500" />
                <p className="text-center text-sm text-gray-400">{journal.energyLevel}/5</p>
              </div>
              <div>
                <label className="label">Søvn (timer)</label>
                <input type="number" className="input" step={0.5} min={0} max={24} value={journal.sleepHours} onChange={(e) => setJournal({ ...journal, sleepHours: +e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Hvad sker der i dit liv?</label>
              <div className="flex flex-wrap gap-2">
                {LIFE_TAGS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => toggleTag(t.value)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      journal.lifeTags.includes(t.value)
                        ? 'bg-brand-700 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveJournal} disabled={journalSaving || !journal.content.trim()} className="btn-primary">
                {journalSaving ? 'Gemmer...' : 'Gem note'}
              </button>
              <button onClick={() => setShowJournal(false)} className="btn-secondary">
                Annuller
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status analysis */}
      <div className="card">
        <h2 className="font-semibold mb-3">Trænerens statusanalyse</h2>
        {analysisLoading ? (
          <p className="text-gray-400 text-sm">Analyserer din træning...</p>
        ) : analysis ? (
          <div className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">{analysis}</div>
        ) : (
          <p className="text-gray-400 text-sm">Ingen analyse tilgængelig endnu. Import dine løb og prøv igen.</p>
        )}
      </div>

      {/* Chat */}
      <div className="card flex flex-col" style={{ minHeight: 400 }}>
        <h2 className="font-semibold mb-4">Chat med din træner</h2>
        <div className="flex-1 overflow-y-auto space-y-3 mb-4" style={{ maxHeight: 400 }}>
          {messages.length === 0 && (
            <div className="text-gray-500 text-sm text-center py-8">
              Stil din træner et spørgsmål om din træning, restitution eller næste mål.
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {['Hvordan ser min form ud?', 'Hvad skal jeg fokusere på denne uge?', 'Er jeg klar til at øge min distance?'].map((q) => (
                  <button key={q} onClick={() => setInput(q)} className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-full text-gray-300 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                  m.role === 'user' ? 'bg-brand-800 text-white' : 'bg-gray-800 text-gray-100'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400">Tænker...</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Stil dit spørgsmål..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={loading}
          />
          <button onClick={sendMessage} disabled={loading || !input.trim()} className="btn-primary px-6">
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
