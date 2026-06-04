import { Microscope, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function BrandLogo({ className, size = 'md' }: BrandLogoProps) {
  const containerClasses = {
    sm: 'h-8 w-8 rounded-lg',
    md: 'h-10 w-10 rounded-xl',
    lg: 'h-12 w-12 rounded-2xl',
  };

  const iconClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <div className={cn("flex items-center justify-center bg-primary text-primary-foreground overflow-hidden relative", containerClasses[size], className)}>
      <Microscope className={cn("absolute left-1/2 -translate-x-3", iconClasses[size])} />
      <Brain className={cn("absolute right-1/2 translate-x-3 opacity-80", iconClasses[size])} />
    </div>
  );
}
