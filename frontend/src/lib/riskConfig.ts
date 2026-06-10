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
 * DiagInfect logo palette semantic colors
 * LOW      → teal    #00a89c
 * MODERATE → amber   #faaf3a
 * HIGH     → orange  (between amber and red)
 * CRITICAL → red     #c0272d
 */
export const RISK_CONFIG: Record<RiskLevel, RiskConfigEntry> = {
  LOW: {
    icon:       CheckCircle2,
    color:      'text-[#00a89c]',
    badgeClass: 'bg-[#00a89c]/10 text-[#007a71] border border-[#00a89c]/25 rounded-full',
    barClass:   '[&>div]:bg-[#00a89c]',
    label:      'Low',
  },
  MODERATE: {
    icon:       TrendingUp,
    color:      'text-[#a2680a]',
    badgeClass: 'bg-[#faaf3a]/15 text-[#a2680a] border border-[#faaf3a]/30 rounded-full',
    barClass:   '[&>div]:bg-[#faaf3a]',
    label:      'Moderate',
  },
  HIGH: {
    icon:       ShieldAlert,
    color:      'text-[#e07020]',
    badgeClass: 'bg-[#e07020]/10 text-[#a04c10] border border-[#e07020]/25 rounded-full',
    barClass:   '[&>div]:bg-[#e07020]',
    label:      'High',
  },
  CRITICAL: {
    icon:       AlertTriangle,
    color:      'text-[#c0272d]',
    badgeClass: 'bg-[#c0272d]/10 text-[#c0272d] border border-[#c0272d]/20 rounded-full',
    barClass:   '[&>div]:bg-[#c0272d]',
    label:      'Critical',
  },
};

export function getRiskConfig(level: string | null | undefined): RiskConfigEntry | null {
  if (!level) return null;
  return RISK_CONFIG[level as RiskLevel] ?? null;
}
