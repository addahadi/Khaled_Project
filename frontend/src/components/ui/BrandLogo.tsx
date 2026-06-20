import { cn } from '@/lib/utils';
import logoUrl from '@/assets/logo.png';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * DiagInfect brand mark — magnifying-glass-with-checkmark logo image
 */
export function BrandLogo({ className, size = 'md' }: BrandLogoProps) {
  const dims  = { sm: 28, md: 36, lg: 44 };
  const radii = { sm: 7,  md: 9,  lg: 11 };
  const d = dims[size];
  const r = radii[size];

  return (
    <img
      src={logoUrl}
      alt="DiagInfect"
      width={d}
      height={d}
      className={cn("object-contain shrink-0", className)}
      style={{ width: d, height: d, borderRadius: r }}
    />
  );
}
