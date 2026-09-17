import React from 'react';
import Link from 'next/link';

const Footer = () => {
  return (
    <footer className="border-border border-t">
      <div className="container mx-auto max-w-4xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="text-muted-foreground flex flex-col items-center justify-between gap-2 text-xs sm:flex-row">
          <p>Powered by UMAttend Engineering Team</p>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">
              Contact Support
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
