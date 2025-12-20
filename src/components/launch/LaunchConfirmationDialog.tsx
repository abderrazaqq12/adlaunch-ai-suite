import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, DollarSign, Rocket } from 'lucide-react';

interface LaunchConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  campaignCount: number;
  platforms: string[];
  isLaunching: boolean;
}

export function LaunchConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  campaignCount,
  platforms,
  isLaunching,
}: LaunchConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/20">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
            <AlertDialogTitle className="text-xl">Final Confirmation</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base space-y-4">
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">This action will create REAL ad campaigns and spend REAL money.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Once launched, campaigns will go live on the ad platforms and start spending your advertising budget.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Campaigns to create:</span>
                <span className="font-medium text-foreground">{campaignCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platforms:</span>
                <span className="font-medium text-foreground capitalize">{platforms.join(', ')}</span>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel disabled={isLaunching}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            disabled={isLaunching}
            className="bg-warning text-warning-foreground hover:bg-warning/90"
          >
            {isLaunching ? (
              <>
                <Rocket className="mr-2 h-4 w-4 animate-pulse" />
                Launching...
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-4 w-4" />
                Yes, Launch Campaigns
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
