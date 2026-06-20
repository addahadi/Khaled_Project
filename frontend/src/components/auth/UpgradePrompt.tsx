import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, ArrowRight, Lock, X } from 'lucide-react';

interface UpgradePromptProps {
  open:        boolean;
  onClose:     () => void;
  /** 'prediction' | 'user' — determines message copy */
  limitType:   'prediction' | 'user';
}

const COPY = {
  prediction: {
    title:       'Prediction Limit Reached',
    description: 'Your trial plan has reached its monthly prediction limit. Upgrade to a paid plan to continue running AI diagnoses without interruption.',
    badge:       'Trial Limit',
    bullet1:     'Unlimited predictions on the Grand Hospital plan',
    bullet2:     '500 predictions / month on the Private Clinic plan',
    bullet3:     'XAI feature explanations on all paid plans',
  },
  user: {
    title:       'User Limit Reached',
    description: 'Your trial plan has reached its maximum number of staff members. Upgrade to invite more doctors and lab technicians.',
    badge:       'Trial Limit',
    bullet1:     'Unlimited staff on the Grand Hospital plan',
    bullet2:     'Up to 20 staff on the Private Clinic plan',
    bullet3:     'Role-based access for all members',
  },
};

export default function UpgradePrompt({ open, onClose, limitType }: UpgradePromptProps) {
  const navigate = useNavigate();
  const copy = COPY[limitType];
  const [suppressed, setSuppressed] = useState(false);

  useEffect(() => {
    if (open) {
      const lastSeen = localStorage.getItem('upgradePromptSuppressedAt');
      if (lastSeen && Date.now() - parseInt(lastSeen, 10) < 24 * 60 * 60 * 1000) {
        setSuppressed(true);
      } else {
        setSuppressed(false);
      }
    }
  }, [open]);

  const handleSuppress = () => {
    localStorage.setItem('upgradePromptSuppressedAt', Date.now().toString());
    setSuppressed(true);
    onClose();
  };

  if (open && suppressed) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5">
        <div className="bg-background border border-border shadow-lg rounded-lg p-4 flex items-center justify-between gap-4 max-w-sm">
          <div className="text-sm font-medium">
            Your trial limit has been reached.{' '}
            <button
              onClick={() => { setSuppressed(false); }}
              className="text-primary hover:underline"
            >
              Upgrade
            </button>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
              <Lock className="h-5 w-5 text-yellow-600" />
            </div>
            <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-200">
              {copy.badge}
            </Badge>
          </div>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription className="leading-relaxed">
            {copy.description}
          </DialogDescription>
        </DialogHeader>

        {/* Feature bullets */}
        <div className="bg-primary/5 rounded-lg p-4 space-y-2">
          {[copy.bullet1, copy.bullet2, copy.bullet3].map(b => (
            <div key={b} className="flex items-start gap-2 text-sm">
              <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>{b}</span>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleSuppress}>Remind me tomorrow</Button>
          <Button
            className="gap-2"
            onClick={() => {
              onClose();
              navigate('/manager/subscription');
            }}
          >
            Upgrade Now <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
