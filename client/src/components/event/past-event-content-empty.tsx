import React from 'react';
import { useAuthStore } from '@/store/authStore';

const PastEventContentEmpty = () => {
  const user = useAuthStore((state) => state.user);
  const isOrganizer = user?.role && ['admin', 'organizer', 'csg'].includes(user.role);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="text-foreground/[0.04] select-none text-[8rem] font-black leading-none tracking-tighter sm:text-[10rem]">—</p>
      <div className="-mt-6 space-y-2">
        <h3 className="text-foreground text-lg font-semibold tracking-tight">No past events</h3>
        <p className="text-muted-foreground mx-auto max-w-xs text-sm leading-relaxed">
          {isOrganizer ? 'No history yet. Start organizing events.' : 'No past events to display.'}
        </p>
      </div>
    </div>
  );
};

export default PastEventContentEmpty;
