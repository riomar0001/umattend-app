import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function EventNotFound() {
  return (
    <div className="bg-background relative">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="from-primary/[0.18] via-primary/[0.06] dark:from-primary/[0.26] dark:via-primary/[0.09] absolute inset-x-0 top-0 h-96 bg-gradient-to-b to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-neutral-100/60 to-transparent dark:from-neutral-900/60" />
        <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg" fill="none">
          <ellipse cx="50%" cy="-10%" rx="500" ry="380" stroke="oklch(0.85 0.18 95 / 0.30)" strokeWidth="1.5" />
          <ellipse cx="50%" cy="-10%" rx="380" ry="280" stroke="oklch(0.85 0.18 95 / 0.22)" strokeWidth="1.5" />
          <ellipse cx="50%" cy="-10%" rx="260" ry="180" stroke="oklch(0.85 0.18 95 / 0.18)" strokeWidth="1.5" />
          <line x1="8%" y1="0%" x2="8%" y2="60%" stroke="oklch(0.85 0.18 95 / 0.28)" strokeWidth="1" strokeDasharray="3 10" />
          <line x1="5%" y1="0%" x2="5%" y2="45%" stroke="oklch(0.85 0.18 95 / 0.20)" strokeWidth="1" strokeDasharray="3 10" />
          <line x1="92%" y1="0%" x2="92%" y2="60%" stroke="oklch(0.85 0.18 95 / 0.28)" strokeWidth="1" strokeDasharray="3 10" />
          <line x1="95%" y1="0%" x2="95%" y2="45%" stroke="oklch(0.85 0.18 95 / 0.20)" strokeWidth="1" strokeDasharray="3 10" />
          <circle cx="18%" cy="8%" r="3" fill="oklch(0.85 0.18 95 / 0.80)" />
          <circle cx="78%" cy="6%" r="2.5" fill="oklch(0.85 0.18 95 / 0.70)" />
          <circle cx="12%" cy="18%" r="2" fill="oklch(0.85 0.18 95 / 0.55)" />
          <circle cx="86%" cy="16%" r="2" fill="oklch(0.85 0.18 95 / 0.55)" />
          <circle cx="0" cy="100%" r="300" style={{ stroke: 'var(--dec-n1)' }} strokeWidth="1.5" />
          <circle cx="0" cy="100%" r="160" style={{ stroke: 'var(--dec-n2)' }} strokeWidth="1.5" />
          <line x1="3%" y1="30%" x2="7%" y2="30%" stroke="oklch(0.85 0.18 95 / 0.65)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="5%" y1="28%" x2="5%" y2="32%" stroke="oklch(0.85 0.18 95 / 0.65)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="93%" y1="28%" x2="97%" y2="28%" stroke="oklch(0.85 0.18 95 / 0.65)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="95%" y1="26%" x2="95%" y2="30%" stroke="oklch(0.85 0.18 95 / 0.65)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="46%" y1="88%" x2="50%" y2="88%" style={{ stroke: 'var(--dec-n4)' }} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="48%" y1="86.5%" x2="48%" y2="89.5%" style={{ stroke: 'var(--dec-n4)' }} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <div className="relative flex flex-col items-center justify-center px-4 py-32 text-center">
        <p className="text-primary mb-3 text-xs font-bold tracking-widest uppercase">404</p>
        <h2 className="text-foreground mb-3 text-3xl font-black tracking-tighter sm:text-4xl">Event Not Found</h2>
        <p className="text-muted-foreground mb-8 max-w-sm text-sm leading-relaxed">The event you&apos;re looking for doesn&apos;t exist or has been removed.</p>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/events">
            <ChevronLeft className="h-4 w-4" />
            Back to Events
          </Link>
        </Button>
      </div>
    </div>
  );
}
