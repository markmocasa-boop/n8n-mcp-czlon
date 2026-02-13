import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row sm:px-6 lg:px-8">
        <p className="text-sm text-text-muted">
          &copy; 2026 GBP Checker
        </p>
        <div className="flex items-center gap-6">
          <Link
            href="/impressum"
            className="text-sm text-text-muted transition-colors hover:text-text-secondary"
          >
            Impressum
          </Link>
          <Link
            href="/datenschutz"
            className="text-sm text-text-muted transition-colors hover:text-text-secondary"
          >
            Datenschutz
          </Link>
        </div>
      </div>
    </footer>
  )
}
