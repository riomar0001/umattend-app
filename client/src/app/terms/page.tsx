import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section, List, NotAffiliatedNotice, OPERATOR } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Terms of Service — UMAttend',
  description: 'The terms that govern your use of UMAttend.'
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="17 September 2026">
      <NotAffiliatedNotice />

      <Section heading="1. About these terms">
        <p>
          UMAttend is an event attendance tool built and operated by {OPERATOR.name}, {OPERATOR.description}. These terms are an agreement between you and that
          team — not with any university or school.
        </p>
        <p>By signing in to UMAttend, you agree to these terms. If you do not agree, please do not use it.</p>
      </Section>

      <Section heading="2. Who may use UMAttend">
        <p>
          Sign-in is restricted to Google accounts on the <span className="text-foreground font-medium">{OPERATOR.domain}</span> domain. This is a technical
          choice we made to keep the tool scoped to one campus community; it is not a university access-control policy, and it does not mean the university
          administers accounts here.
        </p>
        <p>If you lose access to that Google account, you lose access to UMAttend.</p>
      </Section>

      <Section heading="3. Your account">
        <List
          items={[
            'You sign in with Google. We never see or store your Google password.',
            'You are responsible for activity carried out under your account. Do not let anyone else use it.',
            'Some campus email addresses contain a student number and some do not. If yours does not, you will be asked for your student number during onboarding. You must provide your own, and it must be accurate — attendance is recorded against it.',
            'Providing another person’s student number, or using an account that is not yours, is a misuse of this service.'
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
            'Do not check in on behalf of another person, or ask another person to check in on your behalf.',
            'Do not attempt to forge, replay, tamper with, or reverse-engineer attendance tokens.'
          ]}
        />
        <p>
          Attendance records are created by an event organizer scanning your code, or by an organizer recording you manually. We record what was scanned; we do
          not decide whether you attended, and we have no authority over how an organizer or any school uses what we record.
        </p>
        <p>
          If a record looks wrong — a missing check-in, a check-out that never happened — raise it with the event organizer first. If the problem is with the
          software rather than the event, tell us through{' '}
          <Link href="/contact" className="text-foreground underline underline-offset-4">
            support
          </Link>
          .
        </p>
      </Section>

      <Section heading="5. If you organize events">
        <p>
          Organizers and event creators can see attendees’ personal details, scan codes on their behalf, and export attendance lists. If that is you, you are
          handling other people’s personal data, and you are responsible for it:
        </p>
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
            'Circumvent rate limits, authentication, or other protections.',
            'Automate, scrape, or bulk-download data from the service.',
            'Upload unlawful, harassing, or deliberately misleading content in event details or form fields.',
            'Interfere with the service’s availability for others.'
          ]}
        />
        <p>
          Security testing is covered separately in section 7 — we would rather hear about a flaw than have it sit there, so good-faith research is not
          prohibited by the list above.
        </p>
      </Section>

      <Section heading="7. Security and reporting vulnerabilities">
        <p>
          We take the security of the service seriously and describe the specific measures in place in our{' '}
          <Link href="/privacy" className="text-foreground underline underline-offset-4">
            Privacy Policy
          </Link>
          . We are also students, not a professional security team, and we would rather find out about a problem from you than from an incident.
        </p>
        <p>
          <span className="text-foreground font-medium">If you find a vulnerability, tell us.</span> Email{' '}
          <span className="text-foreground font-medium">{OPERATOR.email}</span> with enough detail to reproduce it, and give us a reasonable chance to fix it
          before telling anyone else.
        </p>
        <p>If you are researching in good faith and you stay within these lines, we will not treat your testing as a breach of these terms:</p>
        <List
          items={[
            'Test only against your own account and your own events.',
            'Do not access, modify, download, or retain another person’s data. If you come across someone else’s personal data, stop and tell us.',
            'Do not degrade the service for other users — no load testing, no automated scanning that generates significant traffic, no destructive testing.',
            'Do not use social engineering, phishing, or physical attacks against users or maintainers.',
            'Report promptly, and keep the details private until we have had a chance to fix the issue.'
          ]}
        />
        <p>
          We cannot offer a bug bounty — this is unfunded volunteer work — and we cannot waive anyone else’s rights, including those of the university or our
          infrastructure providers. Testing that goes outside the lines above, or that targets systems that are not ours, is not covered.
        </p>
      </Section>

      <Section heading="8. Availability and limits">
        <p>
          UMAttend is provided free, <span className="text-foreground font-medium">as is</span> and{' '}
          <span className="text-foreground font-medium">as available</span>, by volunteers working on it in their own time. There is no service level, no
          guaranteed uptime, and no support obligation. It may be unavailable, may change, may lose data, or may be discontinued.
        </p>
        <p>
          <span className="text-foreground font-medium">Do not rely on UMAttend as your only record of attendance.</span> If attendance matters for grades,
          credit, or any official purpose, the authoritative record is whatever the organizing body keeps — not this application. We make no guarantee that
          records here are complete or correct, and we accept no liability for decisions made on the basis of them.
        </p>
        <p>To the fullest extent permitted by law, the team’s liability arising from your use of UMAttend is limited to nothing beyond ceasing to process your data on request.</p>
      </Section>

      <Section heading="9. Suspension">
        <p>
          We may suspend or remove access where an account is being misused, where attendance is being falsified, or where continued access threatens the
          service or other users. That is the limit of what we can do — we are not a disciplinary body and we do not impose academic or administrative
          penalties. Where conduct here also breaches a school’s own rules, that is a matter between you and that school.
        </p>
      </Section>

      <Section heading="10. Changes to these terms">
        <p>
          We may update these terms as the service changes. The “last updated” date above will change when we do. Continued use after an update means you accept
          the revised terms.
        </p>
      </Section>

      <Section heading="11. Governing law">
        <p>
          These terms are governed by the laws of the Republic of the Philippines. Personal data is handled in accordance with the Data Privacy Act of 2012
          (Republic Act No. 10173) — see our{' '}
          <Link href="/privacy" className="text-foreground underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
      </Section>

      <Section heading="12. Contact">
        <p>
          Questions about these terms can be sent through the{' '}
          <Link href="/contact" className="text-foreground underline underline-offset-4">
            contact form
          </Link>{' '}
          or to <span className="text-foreground font-medium">{OPERATOR.email}</span>. We answer when we can — this is volunteer-run.
        </p>
      </Section>
    </LegalPage>
  );
}
