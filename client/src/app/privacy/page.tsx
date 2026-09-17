import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section, List, DataRow, NotAffiliatedNotice, OPERATOR } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy — UMAttend',
  description: 'What personal data UMAttend collects, why, and what rights you have over it.'
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="17 September 2026">
      <NotAffiliatedNotice />

      <Section heading="1. Who handles your data">
        <p>
          UMAttend is operated by {OPERATOR.name}, {OPERATOR.description}. For the purposes of the Data Privacy Act of 2012 (Republic Act No. 10173), that team
          is the personal information controller for the data described below.
        </p>
        <p>
          No university or school is the controller of this data, and none of it is held on a university system. It is stored on third-party infrastructure that
          the team rents and administers, described in section 5.
        </p>
      </Section>

      <Section heading="2. What we collect">
        <p>We collect only what is needed to record attendance. We do not sell data, and we run no advertising or third-party analytics.</p>

        <div className="mt-4">
          <h4 className="text-foreground mb-1 text-sm font-semibold">From your Google sign-in</h4>
          <DataRow what="Email address" why={`Identifies your account. Sign-in is restricted to ${OPERATOR.domain} accounts.`} />
          <DataRow what="Google account ID" why="Links your session to the same account each time you sign in." />
          <DataRow what="Name and profile picture" why="Shown on your profile and to organizers when you check in." />
          <p className="mt-2 text-xs">
            We request only the <span className="text-foreground font-medium">email</span> and <span className="text-foreground font-medium">profile</span>{' '}
            scopes. We never receive your Google password, and we have no access to your Gmail, Drive, or contacts.
          </p>
        </div>

        <div className="mt-5">
          <h4 className="text-foreground mb-1 text-sm font-semibold">Your student profile</h4>
          <DataRow
            what="Student number"
            why="Attendance is recorded against it. Taken from your campus email where it contains one; otherwise you enter it during onboarding."
          />
          <DataRow what="Department and program" why="Lets organizers group and report attendance, and is included in event exports." />
        </div>

        <div className="mt-5">
          <h4 className="text-foreground mb-1 text-sm font-semibold">Attendance activity</h4>
          <DataRow what="Events you check in to" why="The core record the service exists to keep." />
          <DataRow what="Check-in and check-out times" why="Establishes whether and how long you attended." />
          <DataRow what="Who scanned you" why="The organizer who performed the check-in or check-out is recorded, so records can be traced and disputed." />
          <DataRow what="Events you create or organize" why="Title, description, department, location, capacity, schedule, and any custom form fields you add." />
        </div>

        <div className="mt-5">
          <h4 className="text-foreground mb-1 text-sm font-semibold">Session and security information</h4>
          <DataRow what="IP address" why="Used for security, abuse prevention, and rate limiting." />
          <DataRow what="Browser, operating system, and device type" why="Shown in your login history so you can spot sessions you do not recognize." />
          <DataRow
            what="Approximate location (city, region, country)"
            why="Derived from your IP address — never from GPS or precise device location — and shown in your login history."
          />
          <DataRow what="Sign-in times and session activity" why="Lets you review and revoke active sessions." />
        </div>
      </Section>

      <Section heading="3. Why we are allowed to hold it">
        <p>
          Our basis is <span className="text-foreground font-medium">your consent</span>, given when you sign in and complete onboarding, together with our
          legitimate interest in keeping the service running and secure.
        </p>
        <p>
          We cannot and do not rely on any university mandate to process your data — we are not acting on a university’s behalf. If you withdraw consent, we
          stop processing your data and your account is closed; the trade-off is that attendance can no longer be recorded for you here.
        </p>
      </Section>

      <Section heading="4. Who can see your data">
        <List
          items={[
            <>
              <span className="text-foreground font-medium">Event organizers.</span> For events you attend, organizers can see your name, student number,
              department, program, and your check-in and check-out times, and can export those to a spreadsheet. Once exported, that file is in their hands and
              outside our control — what they do with it is governed by their own obligations, not this policy.
            </>,
            <>
              <span className="text-foreground font-medium">The maintainers.</span> A small number of team members hold administrator access in order to operate
              and support the service.
            </>,
            <>
              <span className="text-foreground font-medium">You.</span> Your own profile, attendance history, and login history are visible to you.
            </>
          ]}
        />
        <p>We do not sell personal data and we do not share it for marketing. We disclose it to public authorities only where the law requires it.</p>
      </Section>

      <Section heading="5. Service providers we rely on">
        <p>Running the service means some data passes through third parties:</p>
        <List
          items={[
            <>
              <span className="text-foreground font-medium">Google</span> — authenticates your sign-in and delivers our notification emails.
            </>,
            <>
              <span className="text-foreground font-medium">Cloudflare</span> — hosts the application and database, and provides network protection. Your data
              is stored on Cloudflare infrastructure and may be processed outside the Philippines.
            </>,
            <>
              <span className="text-foreground font-medium">ip-api.com</span> — your IP address is sent to this service to turn it into an approximate city and
              country for your login history.
            </>
          ]}
        />
      </Section>

      <Section heading="6. Emails we send">
        <p>
          We send transactional email only — currently a confirmation when you check in to an event and when you check out. There are no marketing or
          promotional emails, so there is no mailing list to unsubscribe from.
        </p>
      </Section>

      <Section heading="7. Cookies">
        <p>
          We use cookies strictly to keep you signed in. They are <span className="text-foreground font-medium">HttpOnly</span> (unreadable by JavaScript),{' '}
          <span className="text-foreground font-medium">Secure</span> in production, and <span className="text-foreground font-medium">SameSite=Lax</span>. The
          sign-in cookie is short-lived and the session cookie expires within a day.
        </p>
        <p>We set no advertising, tracking, or analytics cookies. Clearing them signs you out; it does not delete your account.</p>
      </Section>

      <Section heading="8. How long we keep it">
        <List
          items={[
            'Account and profile data is kept while your account exists.',
            'Attendance records are kept so that the organizers who ran those events can still refer to them. They are not held under any university retention rule — we keep them because the service would be useless otherwise, and you can ask us to remove yours.',
            'Session records expire automatically, and expired sessions are cleared on a regular schedule.',
            'A closed account is marked as deleted and stops being usable. Ask us if you want it erased outright rather than deactivated, and we will do that.'
          ]}
        />
        <p>
          Because this is a volunteer project rather than an institution, we cannot promise indefinite storage either. If UMAttend is ever shut down we will
          give notice where we reasonably can, and delete what we hold.
        </p>
      </Section>

      <Section heading="9. Your rights">
        <p>Under the Data Privacy Act of 2012 you have the right to:</p>
        <List
          items={[
            'Be informed about how your data is collected and used.',
            'Access the personal data we hold about you.',
            'Correct data that is inaccurate or out of date.',
            'Object to processing, or withdraw consent.',
            'Erasure or blocking, where the data is incomplete, outdated, unlawfully obtained, or no longer necessary.',
            'Data portability — receive your data in a portable electronic format.',
            'Damages, where you suffer as a result of inaccurate, unlawfully obtained, or unauthorized use of your data.'
          ]}
        />
        <p>
          Much of this you can do yourself: your profile page lets you correct your details and review and revoke active sessions. For anything else, contact us
          below.
        </p>
      </Section>

      <Section heading="10. How we protect it">
        <List
          items={[
            'All traffic is encrypted in transit over HTTPS.',
            'Sign-in tokens are held in HttpOnly cookies, and session tokens are stored hashed rather than in readable form.',
            'Attendance QR codes are signed and short-lived, so a captured code stops working quickly.',
            'Access to administrative functions is restricted by role.',
            'Sensitive endpoints are rate-limited to resist automated abuse.'
          ]}
        />
        <p>
          Administrative access is held by as few maintainers as possible, and the credentials the service uses to reach its own infrastructure are stored as
          encrypted secrets rather than in the codebase.
        </p>
        <p>
          We are students maintaining this in our spare time, not a security team, and no system is perfectly secure. Please do not store anything here you
          would not be willing to lose or have exposed. If you believe your account has been accessed by someone else, revoke your sessions and contact us
          immediately.
        </p>
        <p>
          If you think you have found a security flaw, please report it privately — see{' '}
          <Link href="/terms" className="text-foreground underline underline-offset-4">
            section 7 of our Terms
          </Link>
          . We will not treat good-faith research as a breach of the terms.
        </p>
      </Section>

      <Section heading="11. If there is a data breach">
        <p>
          If personal data held here is exposed, altered, or accessed without authorization in a way that is likely to put you at risk, we will notify the
          National Privacy Commission and everyone affected within{' '}
          <span className="text-foreground font-medium">72 hours</span> of becoming aware of it, as the Data Privacy Act requires.
        </p>
        <p>
          Our notice will tell you what data was involved, what we know about how it happened, what we have done in response, and what you can do to protect
          yourself. We will tell you even where doing so is embarrassing for us.
        </p>
      </Section>

      <Section heading="12. Children">
        <p>UMAttend is intended for students, faculty, and staff at the campus it serves, and accounts can only be created with a campus email address.</p>
      </Section>

      <Section heading="13. Changes to this policy">
        <p>We will update this page when our practices change, and the “last updated” date will change with it.</p>
      </Section>

      <Section heading="14. Contact us">
        <p>
          To exercise any of the rights above, or to ask how your data is handled, use the{' '}
          <Link href="/contact" className="text-foreground underline underline-offset-4">
            contact form
          </Link>{' '}
          or email <span className="text-foreground font-medium">{OPERATOR.email}</span>.
        </p>
        <p>
          If you believe your rights have been violated, you may complain to the National Privacy Commission of the Philippines at{' '}
          <span className="text-foreground font-medium">privacy.gov.ph</span>. Complaints about this service should be directed to {OPERATOR.name}, not to the
          university.
        </p>
      </Section>
    </LegalPage>
  );
}
