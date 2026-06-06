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

/**
 * IBM Carbon semantic colors
 * LOW      → success-green  (#24a148)
 * MODERATE → warning-yellow (#f1c21b / amber)
 * HIGH     → alert-orange   (#ff832b)
 * CRITICAL → error-red      (#da1e28)
 */
export const RISK_CONFIG: Record<RiskLevel, RiskConfigEntry> = {
  LOW: {
    icon:       CheckCircle2,
    color:      'text-[#24a148]',
    badgeClass: 'bg-[#defbe6] text-[#0e6027] border border-[#a7f0ba]',
    barClass:   '[&>div]:bg-[#24a148]',
    label:      'Low',
  },
  MODERATE: {
    icon:       TrendingUp,
    color:      'text-[#a2680a]',
    badgeClass: 'bg-[#fdf1da] text-[#a2680a] border border-[#fdd13a]',
    barClass:   '[&>div]:bg-[#f1c21b]',
    label:      'Moderate',
  },
  HIGH: {
    icon:       ShieldAlert,
    color:      'text-[#ff832b]',
    badgeClass: 'bg-[#fff2e8] text-[#8a3800] border border-[#ffb784]',
    barClass:   '[&>div]:bg-[#ff832b]',
    label:      'High',
  },
  CRITICAL: {
    icon:       AlertTriangle,
    color:      'text-[#da1e28]',
    badgeClass: 'bg-[#fff1f1] text-[#a2191f] border border-[#ffa4a9]',
    barClass:   '[&>div]:bg-[#da1e28]',
    label:      'Critical',
  },
};

export function getRiskConfig(level: string | null | undefined): RiskConfigEntry | null {
  if (!level) return null;
  return RISK_CONFIG[level as RiskLevel] ?? null;
}
