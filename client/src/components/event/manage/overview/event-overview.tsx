import React from 'react';
import { BarChart3, Calendar, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Event } from '@/types/events';

export default function EventOverview({ event }: { event: Event }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Attendees Stats */}
      <Card className="border-border bg-card p-6">
        <h3 className="text-foreground mb-4 text-lg font-semibold">Attendees Stats</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Total Registered</span>
            <span className="text-foreground text-2xl font-bold">{event.attendees}</span>
          </div>
          {event.capacity !== 'unlimited' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Available Spots</span>
                <span className="text-foreground text-2xl font-bold">{event.capacity - event.checkInCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Capacity</span>
                <span className="text-foreground text-2xl font-bold">{event.capacity}</span>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      <Card className="border-border bg-card p-6">
        <h3 className="text-foreground mb-4 text-lg font-semibold">Quick Actions</h3>
        <div className="space-y-3">
          <Button variant="outline" className="h-11 w-full justify-start bg-transparent font-medium">
            <UserCheck className="mr-2 h-4 w-4" />
            View Attendee List
          </Button>
          <Button variant="outline" className="h-11 w-full justify-start bg-transparent font-medium">
            <BarChart3 className="mr-2 h-4 w-4" />
            Download Report
          </Button>
          <Button variant="outline" className="h-11 w-full justify-start bg-transparent font-medium">
            <Calendar className="mr-2 h-4 w-4" />
            Export to Calendar
          </Button>
        </div>
      </Card>
    </div>
  );
}
