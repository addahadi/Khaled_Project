import { Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface LanguageToggleProps {
  /** Visual variant for different backgrounds */
  variant?: 'default' | 'transparent';
}

export function LanguageToggle({ variant = 'default' }: LanguageToggleProps) {
  const { lang, toggleLanguage } = useLanguage();

  const label = lang === 'en' ? 'عر' : 'EN';

  return (
    <button
      onClick={toggleLanguage}
      className={[
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150',
        variant === 'transparent'
          ? 'text-white/80 hover:text-white hover:bg-white/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
      ].join(' ')}
      aria-label={`Switch to ${lang === 'en' ? 'Arabic' : 'English'}`}
      title={lang === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
    >
      <Globe className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}
