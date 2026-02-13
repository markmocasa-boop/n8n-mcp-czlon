import Link from 'next/link'
import {
  Search,
  Brain,
  ListChecks,
  Mail,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Navbar from '@/components/navbar'
import Footer from '@/components/footer'
import PricingTable from '@/components/pricing-table'

const features = [
  {
    icon: Search,
    title: '10-Faktor-Analyse',
    description:
      'Dein Google Business Profil wird anhand von 10 entscheidenden Faktoren analysiert — von NAP-Konsistenz bis hin zu Bewertungen.',
  },
  {
    icon: Brain,
    title: 'KI-gestuetzter Report',
    description:
      'Unsere KI bewertet jedes Detail und erstellt einen verstaendlichen Report mit konkreten Handlungsempfehlungen.',
  },
  {
    icon: ListChecks,
    title: 'Priorisierte Massnahmen',
    description:
      'Die 5 wichtigsten Massnahmen werden nach Aufwand und Wirkung priorisiert — damit du sofort weisst, was zu tun ist.',
  },
  {
    icon: Mail,
    title: 'E-Mail-Zustellung',
    description:
      'Der fertige Report wird automatisch per E-Mail zugestellt — zum Teilen mit Kunden oder Kollegen.',
  },
]

const steps = [
  {
    step: 1,
    title: 'Daten eingeben',
    description:
      'Gib den Firmennamen, die Stadt und die Branche ein. Mehr brauchen wir nicht.',
  },
  {
    step: 2,
    title: 'KI analysiert',
    description:
      'Unsere KI prueft dein Google Business Profil anhand von 10 Bewertungsfaktoren in Echtzeit.',
  },
  {
    step: 3,
    title: 'Report erhalten',
    description:
      'Du erhaeltst einen detaillierten Report mit Score, Analyse und priorisierten Massnahmen.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-text sm:text-5xl lg:text-6xl">
            Wie gut ist dein Google Business Profil{' '}
            <span className="text-primary">wirklich</span>?
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-text-secondary sm:text-xl">
            Erhalte in unter 2 Minuten einen umfassenden Score, eine
            10-Faktor-Analyse und 5 priorisierte Massnahmen — kostenlos.
          </p>
          <div className="mt-10">
            <Button asChild size="lg" className="text-base px-8">
              <Link href="/signup">Kostenlos testen</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold text-text sm:text-4xl">
            Alles, was du fuer ein professionelles Audit brauchst
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-text-secondary">
            Unser KI-gestuetztes Audit deckt alle relevanten Bereiche deines
            Google Business Profils ab.
          </p>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-card border border-border bg-surface p-6 transition-colors hover:border-border-light"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-text-secondary">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section className="py-20 sm:py-28 bg-surface">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-3xl font-bold text-text sm:text-4xl">
            So funktioniert&apos;s
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-text-secondary">
            In drei einfachen Schritten zum vollstaendigen Audit deines Google
            Business Profils.
          </p>
          <div className="mt-16 space-y-12">
            {steps.map((item) => (
              <div key={item.step} className="flex gap-6 items-start">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-white font-bold text-lg">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-text">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-text-secondary">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold text-text sm:text-4xl">
            Preise
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-text-secondary">
            Starte kostenlos und upgrade, wenn du mehr brauchst.
          </p>
          <div className="mt-16">
            <PricingTable />
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 sm:py-28 bg-surface">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-text sm:text-4xl">
            Jetzt kostenlosen Audit starten
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-text-secondary">
            Finde heraus, wie gut dein Google Business Profil wirklich
            aufgestellt ist — und was du sofort verbessern kannst.
          </p>
          <div className="mt-10">
            <Button asChild size="lg" className="text-base px-8">
              <Link href="/signup">Kostenlos testen</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
