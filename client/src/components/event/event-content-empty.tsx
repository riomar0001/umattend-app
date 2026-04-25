import React from 'react';
import { useAuthStore } from '@/store/authStore';

const EventContentEmpty = () => {
  const user = useAuthStore((state) => state.user);
  const isOrganizer = user?.role && ['admin', 'organizer', 'csg'].includes(user.role);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="text-foreground/[0.04] text-[8rem] leading-none font-black tracking-tighter select-none sm:text-[10rem]">—</p>
      <div className="-mt-6 space-y-2">
        <h3 className="text-foreground text-lg font-semibold tracking-tight">No upcoming events</h3>
        <p className="text-muted-foreground mx-auto max-w-xs text-sm leading-relaxed">
          {isOrganizer ? 'Nothing scheduled. Create an event to get started.' : 'Nothing coming up. Check back soon.'}
        </p>
      </div>
    </div>
  );
};

export default EventContentEmpty;
