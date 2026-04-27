'use client';

import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CheckOutConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  studentId: string;
  isLoading: boolean;
  isEventEnded?: boolean;
  onConfirm: () => void;
}

export function CheckOutConfirmDialog({ open, onOpenChange, studentName, studentId, isLoading, isEventEnded, onConfirm }: CheckOutConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/10">
              <LogOut className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle>Check Out Student</DialogTitle>
          </div>
          <DialogDescription className="pt-3">
            {isEventEnded && (
              <div className="mb-3 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive dark:text-red-300">
                The event has already ended. Are you sure you want to check out this student?
              </div>
            )}
            Are you sure you want to manually check out <span className="text-foreground font-semibold">{studentName}</span>{' '}
            <span className="text-muted-foreground text-xs">(ID: {studentId})</span>?
            <br />
            <br />
            This will record their check-out time as now and send them a confirmation email.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="gap-2 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
          >
            <LogOut className="size-4" />
            {isLoading ? 'Checking out…' : 'Confirm Check Out'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
