'use client';

import { Settings as SettingsIcon } from 'lucide-react';
import { AcademicInfoForm, LoginHistoryTable } from '@/components/profile/settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SettingsPage() {
  return (
    <div className="bg-background relative">
      {/* Background decorative elements */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Top gradient wash */}
        <div className="from-primary/[0.15] via-primary/[0.06] dark:from-primary/[0.22] dark:via-primary/[0.09] absolute inset-x-0 top-0 h-72 bg-gradient-to-b to-transparent" />

        <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg" fill="none">
          {/* Top-left: structured arcs — settings/gear aesthetic */}
          <circle cx="0" cy="0" r="480" stroke="oklch(0.85 0.18 95 / 0.35)" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="340" stroke="oklch(0.85 0.18 95 / 0.28)" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="200" stroke="oklch(0.85 0.18 95 / 0.20)" strokeWidth="1.5" />

          {/* Dot grid cluster — top right area */}
          {[...Array(5)].map((_, row) =>
            [...Array(6)].map((_, col) => (
              <circle
                key={`${row}-${col}`}
                cx={`${68 + col * 4}%`}
                cy={`${6 + row * 5}%`}
                r="1.5"
                fill={`oklch(0.85 0.18 95 / ${0.55 - row * 0.06 - col * 0.02})`}
              />
            ))
          )}

          {/* Horizontal ruled lines — right half */}
          <line x1="50%" y1="35%" x2="105%" y2="35%" stroke="oklch(0.85 0.18 95 / 0.28)" strokeWidth="1" strokeDasharray="4 12" />
          <line x1="55%" y1="40%" x2="105%" y2="40%" stroke="oklch(0.85 0.18 95 / 0.20)" strokeWidth="1" strokeDasharray="4 12" />
          <line x1="60%" y1="45%" x2="105%" y2="45%" stroke="oklch(0.85 0.18 95 / 0.15)" strokeWidth="1" strokeDasharray="4 12" />

          {/* Bottom-right: neutral arc */}
          <circle cx="100%" cy="100%" r="320" style={{ stroke: 'var(--dec-n1)' }} strokeWidth="1.5" />
          <circle cx="100%" cy="100%" r="180" style={{ stroke: 'var(--dec-n2)' }} strokeWidth="1.5" />

          {/* Cross marks */}
          <line x1="82%" y1="22%" x2="86%" y2="22%" stroke="oklch(0.85 0.18 95 / 0.70)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="84%" y1="20%" x2="84%" y2="24%" stroke="oklch(0.85 0.18 95 / 0.70)" strokeWidth="1.5" strokeLinecap="round" />

          <line x1="5%" y1="70%" x2="9%" y2="70%" style={{ stroke: 'var(--dec-n4)' }} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="7%" y1="68%" x2="7%" y2="72%" style={{ stroke: 'var(--dec-n4)' }} strokeWidth="1.5" strokeLinecap="round" />

          <line x1="45%" y1="88%" x2="49%" y2="88%" style={{ stroke: 'var(--dec-n5)' }} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="47%" y1="86%" x2="47%" y2="90%" style={{ stroke: 'var(--dec-n5)' }} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <main className="relative container mx-auto max-w-4xl px-6 py-12">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
              <SettingsIcon className="text-primary h-6 w-6" />
            </div>
            <div>
              <h1 className="text-foreground text-2xl font-semibold sm:text-3xl">Account Settings</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Manage your profile information and security</p>
            </div>
          </div>
        </div>

        {/* Settings Content */}
        <Tabs defaultValue="academic" className="space-y-6">
          <TabsList className="bg-muted grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="academic" className="data-[state=active]:bg-background">
              Academic Info
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-background">
              Login History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="academic" className="space-y-4">
            <AcademicInfoForm />
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <LoginHistoryTable />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
