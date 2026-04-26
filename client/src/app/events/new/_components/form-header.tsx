'use client';

import { ChevronLeft, FileEdit, Zap } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface FormHeaderProps {
  onSaveDraft: () => void;
  onPublish: () => void;
  isSavingDraft: boolean;
  isPublishing: boolean;
}

export function FormHeader({ onSaveDraft, onPublish, isSavingDraft, isPublishing }: FormHeaderProps) {
  const isLoading = isSavingDraft || isPublishing;

  return (
    <header className="bg-background/80 border-border/50 sticky top-0 z-20 border-b backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <Link href="/events">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1 px-2">
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Events</span>
            </Button>
          </Link>
          <div className="bg-border h-4 w-px" />
          <h1 className="text-foreground text-sm font-semibold">New Event</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onSaveDraft} disabled={isLoading} className="gap-1.5">
            <FileEdit className="h-3.5 w-3.5" />
            <span>{isSavingDraft ? 'Saving…' : 'Save Draft'}</span>
          </Button>
          <Button type="button" size="sm" onClick={onPublish} disabled={isLoading} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            <span>{isPublishing ? 'Publishing…' : 'Publish'}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
