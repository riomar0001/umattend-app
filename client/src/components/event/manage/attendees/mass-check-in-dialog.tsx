'use client';

import { useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { massCheckIn, type MassCheckInResult } from '@/api/mass-check-in';
import { parseMassCheckIn } from '@/lib/mass-check-in';

interface Props {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  isEventStarted: boolean;
  isEventEnded: boolean;
}

export function MassCheckInDialog({ eventId, open, onOpenChange, onComplete, isEventStarted, isEventEnded }: Props) {
  const [text, setText] = useState('');
  const [csv, setCsv] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState<MassCheckInResult[]>([]);
  const [running, setRunning] = useState(false);
  const [reading, setReading] = useState(false);
  const inFlight = useRef(false);
  const parsed = useMemo(() => {
    try {
      return { ...parseMassCheckIn(text, csv), error: '' };
    } catch (err) {
      return { ids: [], invalid: [], duplicates: 0, error: err instanceof Error ? err.message : 'Invalid input' };
    }
  }, [text, csv]);
  const locked = running || reading;
  const checkedIn = results.filter((result) => result.status === 'checked_in').length;
  const skipped = results.filter((result) => result.status === 'skipped').length;

  const submit = async () => {
    if (inFlight.current || locked || !parsed.ids.length || parsed.invalid.length || parsed.error || results.length) return;
    inFlight.current = true;
    setRunning(true);
    setError('');
    let completed: MassCheckInResult[] = [];
    try {
      // Bounded batches keep each request small, while supporting large CSV files.
      for (let offset = 0; offset < parsed.ids.length; offset += 25) {
        const batch = await massCheckIn(eventId, parsed.ids.slice(offset, offset + 25));
        completed = [...completed, ...batch];
        setResults(completed);
      }
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(
        `${message || 'The request could not be completed.'} ${completed.length} IDs have confirmed results. Remaining IDs may have been processed; refresh attendance before retrying.`
      );
    } finally {
      setRunning(false);
      inFlight.current = false;
      onComplete();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!locked) onOpenChange(value);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl" showCloseButton={!locked}>
        <DialogHeader>
          <DialogTitle>Mass Check In</DialogTitle>
          <DialogDescription>Upload a CSV or enter 6-digit student IDs. Review the IDs, then check in up to 1,000 students at a time.</DialogDescription>
        </DialogHeader>
        {isEventEnded ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">This event has ended. Check-ins will be recorded at the current time.</p>
        ) : !isEventStarted ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">This event has not started. These will be early check-ins.</p>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="mass-check-in-csv">Import CSV</Label>
          <Input
            id="mass-check-in-csv"
            type="file"
            accept=".csv,text/csv"
            disabled={locked || results.length > 0}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setError('');
              setText('');
              setFileName('');
              setCsv(true);
              if (file.size > 2 * 1024 * 1024) {
                setError('Choose a CSV file smaller than 2 MB.');
                return;
              }
              setReading(true);
              try {
                setText(await file.text());
                setCsv(true);
                setFileName(file.name);
              } catch {
                setError('Unable to read the CSV file.');
              } finally {
                setReading(false);
              }
            }}
          />
          <p className="text-muted-foreground text-xs">
            Use a student_id column, or one ID per row without a header. Other columns are ignored when a student_id header is present.
          </p>
          {fileName && <p className="text-sm">Loaded: {fileName}</p>}
          {csv && (
            <Button
              type="button"
              variant="outline"
              disabled={locked || results.length > 0}
              onClick={() => {
                setText('');
                setCsv(false);
                setFileName('');
                setError('');
              }}
            >
              Enter IDs instead
            </Button>
          )}
        </div>
        {!csv && (
          <div className="grid gap-2">
            <Label htmlFor="mass-check-in-ids">Student ID numbers</Label>
            <textarea
              id="mass-check-in-ids"
              className="border-input bg-background focus-visible:ring-ring min-h-28 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
              placeholder={'123456\n234567\n345678'}
              value={text}
              disabled={locked || results.length > 0}
              onChange={(e) => {
                setText(e.target.value);
                setError('');
              }}
            />
            <p className="text-muted-foreground text-xs">Separate IDs with new lines, spaces, commas, or semicolons.</p>
          </div>
        )}
        <div aria-live="polite" className="space-y-2 text-sm">
          <p>
            {parsed.ids.length} unique IDs ready{parsed.duplicates > 0 ? ` · ${parsed.duplicates} duplicates removed` : ''}
          </p>
          {parsed.invalid.length > 0 && (
            <p role="alert" className="text-destructive">
              Fix {parsed.invalid.length} invalid IDs before continuing:{' '}
              {parsed.invalid
                .slice(0, 10)
                .map((id) => id || '(empty)')
                .join(', ')}
              {parsed.invalid.length > 10 ? '…' : ''}. IDs must contain exactly 6 digits.
            </p>
          )}
          {(parsed.error || error) && (
            <p role="alert" className="text-destructive">
              {parsed.error || error}
            </p>
          )}
          {parsed.ids.length > 0 && !results.length && (
            <p className="text-muted-foreground break-words">
              {parsed.ids.slice(0, 20).join(', ')}
              {parsed.ids.length > 20 ? '…' : ''}
            </p>
          )}
          {(running || results.length > 0) && (
            <p>
              {results.length} / {parsed.ids.length} processed · {checkedIn} checked in · {skipped} already checked in · {results.length - checkedIn - skipped}{' '}
              failed
            </p>
          )}
        </div>
        {results.length > 0 && (
          <ul aria-label="Check-in results" className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3 text-sm">
            {results.map((result) => (
              <li key={result.student_id}>
                <span className="font-medium">{result.student_id}</span> — {result.message}
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={locked} onClick={() => onOpenChange(false)}>
            {results.length ? 'Done' : 'Cancel'}
          </Button>
          {!results.length && (
            <Button type="button" disabled={locked || !parsed.ids.length || !!parsed.invalid.length || !!parsed.error} onClick={submit}>
              {locked && <Loader2 className="mr-2 size-4 animate-spin" />}
              {running ? 'Checking in…' : reading ? 'Reading CSV…' : `Check in ${parsed.ids.length} students`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
