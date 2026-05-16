import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Nav } from '@/components/ui/nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
