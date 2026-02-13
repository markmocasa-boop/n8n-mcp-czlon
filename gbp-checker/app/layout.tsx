import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import './globals.css'

export const metadata: Metadata = {
  title: 'GBP Checker — Google Business Profil Audit',
  description:
    'Automatisierte Google Business Profil Audits mit KI-gestützter Analyse. Score, 10 Bewertungsfaktoren und 5 priorisierte Maßnahmen.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" className={GeistSans.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
