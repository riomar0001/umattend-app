import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section, List } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Terms of Service — UMAttend',
  description: 'The terms that govern your use of UMAttend.'
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="17 September 2026">
      <Section heading="1. About these terms">
        <p>
          UMAttend is an event attendance system operated by the UMAttend Engineering Team under the College of Computing Education, University of Mindanao,
          Matina Campus, Davao City. These terms govern your use of the UMAttend website and its check-in tools.
        </p>
        <p>By signing in to UMAttend, you agree to these terms. If you do not agree, please do not use the service.</p>
      </Section>

      <Section heading="2. Who may use UMAttend">
        <p>
          Access is limited to members of the University of Mindanao community. Sign-in is restricted to Google accounts on the{' '}
          <span className="text-foreground font-medium">umindanao.edu.ph</span> domain — personal Google accounts cannot be used to create an account.
        </p>
        <p>
          If you lose access to your university Google account, you lose access to UMAttend. Your attendance records remain with the university regardless.
        </p>
      </Section>

      <Section heading="3. Your account">
        <List
          items={[
            'You sign in with Google. We never see or store your Google password.',
            'You are responsible for activity carried out under your account. Do not let anyone else use it.',
            'Some university email addresses contain a student number and some do not. If yours does not, you will be asked for your student number during onboarding. You must provide your own, and it must be accurate — attendance is recorded against it.',
            'Providing another person’s student number, or using an account that is not yours, is a misuse of the service and may be referred to the university.'
          ]}
        />
      </Section>

      <Section heading="4. Attendance and QR codes">
        <p>
          Your attendance QR code is personal, time-limited, and identifies you. It refreshes periodically and expires shortly after it is generated. Treat it
          like an ID card.
        </p>
        <List
          items={[
            'Do not share, photograph for others, forward, or publish your QR code.',
            'Do not check in on behalf of another person, or ask another person to check in on your behalf. Proxy attendance is a form of academic dishonesty.',
            'Do not attempt to forge, replay, tamper with, or reverse-engineer attendance tokens.'
          ]}
        />
        <p>
          Attendance records are created by an event organizer scanning your code, or by an organizer recording you manually. If you believe a record is wrong
          — a missing check-in, a check-out that never happened — raise it with the event organizer first, then with{' '}
          <Link href="/contact" className="text-foreground underline underline-offset-4">
            support
          </Link>
          . UMAttend records what was scanned; it does not adjudicate whether you attended.
        </p>
      </Section>

      <Section heading="5. If you organize events">
        <p>Organizers and event creators can see the personal details of attendees, scan codes on their behalf, and export attendance lists. If that is you:</p>
        <List
          items={[
            'Use attendee data only for running and reporting on that event.',
            'Do not redistribute, publish, or re-purpose exported attendance lists.',
            'Only add organizers who genuinely need access, and remove them when they no longer do.',
            'Keep event details accurate. Attendees rely on the times and location you publish.'
          ]}
        />
      </Section>

      <Section heading="6. Acceptable use">
        <p>Do not:</p>
        <List
          items={[
            'Attempt to gain access to accounts, events, or data that are not yours.',
            'Probe, scan, or test the security of the service, or circumvent rate limits and other protections.',
            'Automate, scrape, or bulk-download data from the service.',
            'Upload unlawful, harassing, or deliberately misleading content in event details or form fields.',
            'Interfere with the service’s availability for others.'
          ]}
        />
      </Section>

      <Section heading="7. Availability">
        <p>
          UMAttend is provided on an “as is” and “as available” basis. It is a university system maintained by a student engineering team, and may be
          unavailable for maintenance, may change, or may contain errors. We do not guarantee uninterrupted access or that every record will be free of defect.
        </p>
        <p>
          Where an event’s attendance affects your academic standing, the authoritative record is the one held by the university or the organizing unit, not
          this application.
        </p>
      </Section>

      <Section heading="8. Suspension">
        <p>
          We may suspend or remove access where an account is being misused, where attendance is being falsified, or where continued access threatens the
          service or other users. Where the conduct involves academic dishonesty, it may be referred to the appropriate university office.
        </p>
      </Section>

      <Section heading="9. Changes to these terms">
        <p>
          We may update these terms as the service changes. The “last updated” date above will change when we do. Continued use after an update means you accept
          the revised terms.
        </p>
      </Section>

      <Section heading="10. Governing law">
        <p>
          These terms are governed by the laws of the Republic of the Philippines. Personal data is handled in accordance with the Data Privacy Act of 2012
          (Republic Act No. 10173) — see our{' '}
          <Link href="/privacy" className="text-foreground underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
      </Section>

      <Section heading="11. Contact">
        <p>
          Questions about these terms can be sent through the{' '}
          <Link href="/contact" className="text-foreground underline underline-offset-4">
            contact form
          </Link>{' '}
          or to <span className="text-foreground font-medium">cce_csg@umindanao.edu.ph</span>.
        </p>
      </Section>
    </LegalPage>
  );
}
