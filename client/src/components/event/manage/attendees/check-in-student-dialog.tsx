'use client';

import { useState } from 'react';
import { UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CheckInStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (studentId: string) => Promise<void>;
  isLoading: boolean;
}

export function CheckInStudentDialog({ open, onOpenChange, onConfirm, isLoading }: CheckInStudentDialogProps) {
  const [studentId, setStudentId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (studentId.length === 6) {
      await onConfirm(studentId);
      setStudentId('');
      onOpenChange(false);
    }
  };

  // Reset state when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setStudentId('');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 flex size-10 items-center justify-center rounded-full">
                <UserPlus className="text-primary size-5" />
              </div>
              <DialogTitle>Check in Student</DialogTitle>
            </div>
            <DialogDescription className="pt-3">Enter the 6-digit student ID to manually check them into the event.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-6">
            <div className="grid gap-2">
              <Label htmlFor="studentId">Student ID</Label>
              <Input
                id="studentId"
                placeholder="e.g. 123456"
                value={studentId}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val.length <= 6) setStudentId(val);
                }}
                disabled={isLoading}
                maxLength={6}
                required
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={studentId.length !== 6 || isLoading} className="gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Checking in...
                </>
              ) : (
                <>
                  <UserPlus className="size-4" />
                  Confirm Check In
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
