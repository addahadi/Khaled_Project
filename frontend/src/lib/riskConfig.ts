import {
  AlertTriangle, TrendingUp, CheckCircle2, ShieldAlert,
} from 'lucide-react';
import type { ElementType } from 'react';

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

interface RiskConfigEntry {
  icon:       ElementType;
  color:      string;       // text-color for the icon
  badgeClass: string;       // Badge background/text/border
  barClass:   string;       // Progress bar override
  label:      string;       // Human-readable label
}

export const RISK_CONFIG: Record<RiskLevel, RiskConfigEntry> = {
  LOW: {
    icon:       CheckCircle2,
    color:      'text-green-600',
    badgeClass: 'bg-green-100 text-green-800 border-green-200',
    barClass:   '[&>div]:bg-green-500',
    label:      'Low',
  },
  MODERATE: {
    icon:       TrendingUp,
    color:      'text-yellow-600',
    badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    barClass:   '[&>div]:bg-yellow-500',
    label:      'Moderate',
  },
  HIGH: {
    icon:       ShieldAlert,
    color:      'text-orange-600',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
    barClass:   '[&>div]:bg-orange-500',
    label:      'High',
  },
  CRITICAL: {
    icon:       AlertTriangle,
    color:      'text-red-600',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
    barClass:   '[&>div]:bg-red-500',
    label:      'Critical',
  },
};

/** Safe lookup with fallback — avoids crashes on unknown risk values */
export function getRiskConfig(level: string | null | undefined): RiskConfigEntry | null {
  if (!level) return null;
  return RISK_CONFIG[level as RiskLevel] ?? null;
}
