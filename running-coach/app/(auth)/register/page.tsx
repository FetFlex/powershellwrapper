'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Registrering fejlede')
      setLoading(false)
      return
    }

    router.push('/login?registered=1')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-400">Løbecoach AI</h1>
          <p className="text-gray-400 mt-2">Din personlige AI-løbetræner</p>
        </div>
        <div className="card">
          <h2 className="text-xl font-semibold mb-6">Opret konto</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Navn</label>
              <input
                type="text"
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Adgangskode (min. 8 tegn)</label>
              <input
                type="password"
                className="input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Opretter konto...' : 'Opret konto'}
            </button>
          </form>
          <p className="text-center text-gray-400 text-sm mt-4">
            Har du allerede en konto?{' '}
            <Link href="/login" className="text-brand-400 hover:underline">
              Log ind
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
