import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section, List, DataRow } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy — UMAttend',
  description: 'What personal data UMAttend collects, why, and what rights you have over it.'
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="17 September 2026">
      <Section heading="1. Who handles your data">
        <p>
          UMAttend is operated by the UMAttend Engineering Team under the College of Computing Education, University of Mindanao, Matina Campus, Matina
          Crossing, Davao City, Davao del Sur 8000, Philippines. We are the personal information controller for the data described below, and we handle it
          under the Data Privacy Act of 2012 (Republic Act No. 10173).
        </p>
      </Section>

      <Section heading="2. What we collect">
        <p>We collect only what the service needs to record attendance. We do not buy data, and we do not run advertising or third-party analytics.</p>

        <div className="mt-4">
          <h4 className="text-foreground mb-1 text-sm font-semibold">From your Google sign-in</h4>
          <DataRow what="Email address" why="Identifies your account. Sign-in is restricted to umindanao.edu.ph accounts." />
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
            why="Attendance is recorded against it. Taken from your university email where it contains one; otherwise you enter it during onboarding."
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
        <p>Under the Data Privacy Act, we rely on:</p>
        <List
          items={[
            'Your consent, given when you sign in and complete onboarding.',
            'The legitimate interests of the university in recording attendance at its events and keeping the service secure.',
            'Compliance with the university’s own record-keeping requirements.'
          ]}
        />
      </Section>

      <Section heading="4. Who can see your data">
        <List
          items={[
            <>
              <span className="text-foreground font-medium">Event organizers.</span> For events you attend, organizers can see your name, student number,
              department, program, and your check-in and check-out times, and can export those to a spreadsheet.
            </>,
            <>
              <span className="text-foreground font-medium">Administrators.</span> UMAttend administrators can view accounts, events, and attendance in order to
              operate and support the service.
            </>,
            <>
              <span className="text-foreground font-medium">You.</span> Your own profile, attendance history, and login history are visible to you.
            </>
          ]}
        />
        <p>We do not sell personal data, and we do not share it with anyone for marketing.</p>
      </Section>

      <Section heading="5. Service providers we rely on">
        <p>Running the service means some data passes through third parties:</p>
        <List
          items={[
            <>
              <span className="text-foreground font-medium">Google</span> — authenticates your sign-in and delivers our notification emails.
            </>,
            <>
              <span className="text-foreground font-medium">Cloudflare</span> — hosts the application and database, and provides network protection. Data is
              stored on Cloudflare infrastructure and may be processed outside the Philippines.
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
            'Attendance records are kept as university event records, and are retained even if your account is closed — they document events that took place.',
            'Session records expire automatically, and expired sessions are cleared on a regular schedule.',
            'When an account is deleted it is marked as deleted and stops being usable; it is excluded from the service rather than immediately erased, so that historical attendance stays intelligible.'
          ]}
        />
      </Section>

      <Section heading="9. Your rights">
        <p>Under the Data Privacy Act of 2012 you have the right to:</p>
        <List
          items={[
            'Be informed about how your data is collected and used.',
            'Access the personal data we hold about you.',
            'Correct data that is inaccurate or out of date.',
            'Object to processing, or withdraw consent — noting that without the data above the service cannot record your attendance.',
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
        <p>No system is perfectly secure. If you believe your account has been accessed by someone else, revoke your sessions and contact us immediately.</p>
      </Section>

      <Section heading="11. Children">
        <p>UMAttend is intended for university students, faculty, and staff, and accounts can only be created with a university email address.</p>
      </Section>

      <Section heading="12. Changes to this policy">
        <p>We will update this page when our practices change, and the “last updated” date will change with it.</p>
      </Section>

      <Section heading="13. Contact us">
        <p>
          To exercise any of the rights above, or to ask how your data is handled, use the{' '}
          <Link href="/contact" className="text-foreground underline underline-offset-4">
            contact form
          </Link>{' '}
          or email <span className="text-foreground font-medium">cce_csg@umindanao.edu.ph</span>.
        </p>
        <p>
          If you believe your rights have been violated, you may also complain to the National Privacy Commission of the Philippines at{' '}
          <span className="text-foreground font-medium">privacy.gov.ph</span>.
        </p>
      </Section>
    </LegalPage>
  );
}
