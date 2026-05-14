'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/coach', label: 'AI Træner' },
  { href: '/training-plan', label: 'Træningsplan' },
  { href: '/import', label: 'Importer' },
  { href: '/settings', label: 'Indstillinger' },
]

export function Nav() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/dashboard" className="text-brand-400 font-bold text-lg">
          Løbecoach AI
        </Link>
        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith(l.href)
                  ? 'bg-brand-900 text-brand-300'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm hidden md:block">{session?.user?.name ?? session?.user?.email}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-sm text-gray-400 hover:text-gray-100 transition-colors"
          >
            Log ud
          </button>
        </div>
      </div>
      {/* Mobile nav */}
      <div className="md:hidden border-t border-gray-800 flex overflow-x-auto">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex-shrink-0 px-4 py-2 text-sm font-medium transition-colors ${
              pathname.startsWith(l.href) ? 'text-brand-400 border-b-2 border-brand-400' : 'text-gray-400'
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
