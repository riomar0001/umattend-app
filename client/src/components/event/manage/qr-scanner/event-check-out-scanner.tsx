'use client';

import { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';
import { Scan, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { postEventCheckOutByEventIdByQrCodeMutation } from '@/api/client/@tanstack/react-query.gen';

interface EventCheckOutScannerProps {
  eventId: string;
  isEventDone: boolean;
  isEventStarted: boolean;
}

export function EventCheckOutScanner({ eventId, isEventDone, isEventStarted }: EventCheckOutScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedValue, setScannedValue] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanningRef = useRef(false);
  const lastScannedRef = useRef<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  const resetScanner = () => {
    isProcessingRef.current = false;
    lastScannedRef.current = '';
  };

  // Check-out mutation
  const checkOutMutation = useMutation({
    ...postEventCheckOutByEventIdByQrCodeMutation(),
    onSuccess: () => {
      toast.success('Check-out successful!');
      setShowDialog(false);
      setIsProcessing(false);
      setScannedValue(null);
      resetScanner();
    },
    onError: (error) => {
      setIsProcessing(false);
      setShowDialog(false);
      const status = error?.response?.status;
      const message = error?.response?.data?.message;
      if (status === 409) {
        toast.warning(message || 'Student has already checked out');
      } else {
        toast.error(message || 'Failed to check out student');
      }
      console.error('[Check-Out Scanner] Error:', error);
      setScannedValue(null);
      resetScanner();
    }
  });

  const handleQRCodeDetected = (detectedCode: string) => {
    if (isProcessingRef.current || detectedCode === lastScannedRef.current) {
      return;
    }

    lastScannedRef.current = detectedCode;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      isProcessingRef.current = true;
      setScannedValue(detectedCode);
      setShowDialog(true);
      setIsProcessing(true);

      checkOutMutation.mutate({
        path: {
          event_id: eventId,
          qr_code: detectedCode
        }
      });
    }, 300);
  };

  const startAutoScan = () => {
    scanningRef.current = true;
    const scanFrame = () => {
      if (!scanningRef.current || !videoRef.current || !canvasRef.current) return;

      const context = canvasRef.current.getContext('2d');
      if (context && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        const imageData = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);

        const detectedCode = detectQRCode(imageData);
        if (detectedCode) {
          handleQRCodeDetected(detectedCode);
        }
      }

      requestAnimationFrame(scanFrame);
    };
    scanFrame();
  };

  const detectQRCode = (imageData: ImageData): string | null => {
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    return code ? code.data : null;
  };

  const startCamera = async () => {
    try {
      setIsScanning(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          startAutoScan();
        };
      }
    } catch (error) {
      console.error('[Check-Out Scanner] Camera access error:', error);
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    scanningRef.current = false;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
    }
    setIsScanning(false);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Stop camera and scanning on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Show message if event hasn't started or is done
  if (!isEventStarted) {
    return (
      <Card className="border-border bg-card p-4 sm:p-5 md:p-6">
        <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10">
            <AlertCircle className="h-6 w-6 text-yellow-600" />
          </div>
          <div>
            <h3 className="text-foreground mb-2 text-base font-semibold sm:text-lg">Event Not Started</h3>
            <p className="text-muted-foreground text-xs sm:text-sm">Check-out will be available once the event starts.</p>
          </div>
        </div>
      </Card>
    );
  }

  if (isEventDone) {
    return (
      <Card className="border-border bg-card p-4 sm:p-5 md:p-6">
        <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-foreground mb-2 text-base font-semibold sm:text-lg">Event Completed</h3>
            <p className="text-muted-foreground text-xs sm:text-sm">Check-out is no longer available for this event.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-3 sm:space-y-4 md:space-y-6">
      {/* Scanner Section */}
      <Card className="border-border bg-card p-4 sm:p-5 md:p-6">
        <h3 className="text-foreground mb-3 text-sm font-semibold sm:mb-4 sm:text-base md:text-lg">Check-Out QR Scanner</h3>
        <p className="text-muted-foreground mb-4 text-xs sm:text-sm">Scan student QR codes to check them out of the event.</p>

        {!isScanning ? (
          <div className="flex flex-col gap-3 sm:gap-4">
            <Button onClick={startCamera} className="w-full gap-2 text-sm md:text-base">
              <Scan className="h-4 w-4" />
              Start Camera
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="relative mx-auto aspect-[3/4] w-full max-w-lg overflow-hidden rounded-lg bg-black">
              <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
              <canvas ref={canvasRef} className="hidden" width={640} height={480} />

              <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4 md:p-0">
                <div className="border-primary xs:h-48 xs:w-48 relative h-40 w-40 rounded-lg border-2 sm:h-56 sm:w-56 md:h-64 md:w-64">
                  <div className="border-primary absolute top-0 left-0 h-3 w-3 border-t-2 border-l-2 sm:h-4 sm:w-4" />
                  <div className="border-primary absolute top-0 right-0 h-3 w-3 border-t-2 border-r-2 sm:h-4 sm:w-4" />
                  <div className="border-primary absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 sm:h-4 sm:w-4" />
                  <div className="border-primary absolute right-0 bottom-0 h-3 w-3 border-r-2 border-b-2 sm:h-4 sm:w-4" />
                </div>
              </div>
            </div>

            <Button onClick={stopCamera} variant="destructive" className="w-full text-sm md:text-base">
              Stop Scanning
            </Button>
          </div>
        )}
      </Card>

      <Dialog
        open={showDialog && isProcessing}
        onOpenChange={(open) => {
          if (!open) {
            setShowDialog(false);
            setIsProcessing(false);
          }
        }}
      >
        <DialogContent className="w-[90vw] max-w-sm sm:w-full md:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg md:text-xl">QR Code Scanned</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm md:text-base">Processing check-out...</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center gap-3 py-4 sm:gap-4 sm:py-6">
            <Spinner className="h-6 w-6 sm:h-8 sm:w-8" />
            <div className="bg-muted w-full rounded-lg p-2.5 sm:p-3 md:p-4">
              <p className="text-foreground text-center font-mono text-sm font-semibold break-all sm:text-base md:text-lg">{scannedValue}</p>
            </div>
            <p className="text-muted-foreground text-center text-xs sm:text-sm">Checking out attendee...</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
