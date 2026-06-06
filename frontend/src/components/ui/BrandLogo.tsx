import { cn } from '@/lib/utils';

interface BrandLogoProps {
 className?: string;
 size?: 'sm' | 'md' | 'lg';
}

/**
 * IBM Carbon brand mark — square, IBM Blue, cross/plus mark
 * Carbon uses geometric, square marks. No rounded corners.
 */
export function BrandLogo({ className, size = 'md' }: BrandLogoProps) {
 const dims = { sm: 28, md: 36, lg: 44 };
 const d = dims[size];

 return (
 <div
 className={cn(
 "bg-primary text-primary-foreground flex items-center justify-center shrink-0",
 className
 )}
 style={{ width: d, height: d }}
 >
 <svg
 width={d * 0.55}
 height={d * 0.55}
 viewBox="0 0 20 20"
 fill="none"
 xmlns="http://www.w3.org/2000/svg"
 aria-hidden="true"
 >
 {/* Carbon-inspired cross / diagnostic mark */}
 <rect x="8.5" y="1" width="3" height="18" fill="white" />
 <rect x="1" y="8.5" width="18" height="3" fill="white" />
 <rect x="5" y="5" width="3" height="3" fill="white" opacity="0.5" />
 <rect x="12" y="12" width="3" height="3" fill="white" opacity="0.5" />
 </svg>
 </div>
 );
}
