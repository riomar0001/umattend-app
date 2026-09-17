import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * Shared shell for the public legal pages.
 *
 * These deliberately sit outside `ProtectedRoute` — the login screen links to
 * them, so they have to be readable before anyone signs in.
 */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="bg-background min-h-screen px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <h1 className="mb-2 text-4xl font-bold text-balance transition-opacity hover:opacity-80">
              <span className="text-yellow-500">UM</span>
              <span className="text-foreground">Attend</span>
            </h1>
          </Link>
        </div>

        <div className="border-border bg-card rounded-lg border p-6 shadow-sm sm:p-10">
          <h2 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
          <p className="text-muted-foreground mt-2 text-sm">Last updated {updated}</p>

          <div className="mt-8 space-y-8">{children}</div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
          <Link href="/" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to UMAttend
          </Link>
          <div className="text-muted-foreground flex gap-4">
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A numbered top-level section. */
export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-foreground text-lg font-semibold">{heading}</h3>
      <div className="text-muted-foreground space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

/** Bulleted list with consistent spacing. */
export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** Definition-style row for "what we collect" tables. */
export function DataRow({ what, why }: { what: string; why: string }) {
  return (
    <div className="border-border grid gap-1 border-t py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] sm:gap-4">
      <div className="text-foreground text-sm font-medium">{what}</div>
      <div className="text-sm">{why}</div>
    </div>
  );
}
