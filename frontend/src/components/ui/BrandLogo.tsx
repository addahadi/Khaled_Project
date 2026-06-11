import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * DiagInfect brand mark — rounded-lg, brand blue, cross/plus mark
 * Matches the new modern SaaS design system (10px radius)
 */
export function BrandLogo({ className, size = 'md' }: BrandLogoProps) {
  const dims   = { sm: 28, md: 36, lg: 44 };
  const radii  = { sm: 7,  md: 9,  lg: 11 };
  const d      = dims[size];
  const r      = radii[size];

  return (
    <div
      className={cn(
        "bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm shadow-primary/30",
        className
      )}
      style={{ width: d, height: d, borderRadius: r }}
    >
      <svg
        width={d * 0.52}
        height={d * 0.52}
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="8.5" y="1"   width="3" height="18" fill="white" />
        <rect x="1"   y="8.5" width="18" height="3"  fill="white" />
      </svg>
    </div>
  );
}
