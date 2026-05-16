import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Løbecoach AI',
  description: 'Din personlige AI-drevne løbetræner',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da" className="dark">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
