import React from 'react';

export default function EventNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-backgroun">
      <div className="text-center">
        <h2 className="text-foreground mb-2 text-2xl font-bold">Event Not Found</h2>
        <p className="text-muted-foreground">The event you&apos;re looking for doesn&apos;t exist or has been removed.</p>
      </div>
    </div>
  );
}
