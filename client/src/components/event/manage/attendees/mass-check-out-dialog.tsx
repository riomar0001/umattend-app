'use client';

import { useEffect, useState } from 'react';
import { Loader2, LogOut, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface MassCheckOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Number of attendees still checked in */
  pendingCount: number;
  /** Email the organizer has to retype to confirm — their own account email */
  confirmEmail: string;
  /** Human-readable time that will be recorded as the check-out time */
  checkOutTimeLabel: string;
  isLoading: boolean;
  onConfirm: () => void;
}

export function MassCheckOutDialog({ open, onOpenChange, pendingCount, confirmEmail, checkOutTimeLabel, isLoading, onConfirm }: MassCheckOutDialogProps) {
  const [email, setEmail] = useState('');

  // Clear the typed email whenever the dialog opens, so a previous confirmation
  // can never carry over and pre-authorise the next one.
  useEffect(() => {
    if (open) setEmail('');
  }, [open]);

  const emailMatches = email.trim().toLowerCase() === confirmEmail.trim().toLowerCase() && confirmEmail.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailMatches || isLoading) return;
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isLoading && onOpenChange(next)}>
      <DialogContent className="sm:max-w-120">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/10">
                <LogOut className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
              <DialogTitle>Mass Check Out</DialogTitle>
            </div>
            <DialogDescription className="pt-3" asChild>
              <div>
                <div className="mb-3 flex gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <span>
                    This will check out <span className="font-semibold">{pendingCount}</span> {pendingCount === 1 ? 'attendee who is' : 'attendees who are'}{' '}
                    still checked in. Each one is emailed a check-out confirmation and this cannot be undone in bulk.
                  </span>
                </div>
                <p>
                  Their check-out time will be recorded as <span className="text-foreground font-medium">{checkOutTimeLabel}</span>. Attendees who already
                  checked out are left untouched.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-6">
            <Label htmlFor="massCheckOutEmail">
              {confirmEmail ? (
                <>
                  Type <span className="text-foreground font-semibold">{confirmEmail}</span> to confirm
                </>
              ) : (
                'Type your email address to confirm'
              )}
            </Label>
            <Input
              id="massCheckOutEmail"
              type="email"
              autoComplete="off"
              placeholder={confirmEmail || 'you@umindanao.edu.ph'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading || !confirmEmail}
              autoFocus
            />
            {!confirmEmail && <p className="text-destructive text-xs">Your account email could not be read. Reload the page and try again.</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!emailMatches || isLoading}
              className="gap-2 bg-amber-600 text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-600"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Checking out…
                </>
              ) : (
                <>
                  <LogOut className="size-4" />
                  Check Out {pendingCount} {pendingCount === 1 ? 'Attendee' : 'Attendees'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
