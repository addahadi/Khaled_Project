import { useState, useRef, useCallback, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const COMMON_SYMPTOMS = [
  'Fever', 'Cough', 'Fatigue', 'Headache', 'Nausea', 'Vomiting',
  'Diarrhea', 'Shortness of breath', 'Chest pain', 'Sore throat',
  'Runny nose', 'Nasal congestion', 'Sneezing', 'Body aches', 'Muscle pain',
  'Joint pain', 'Chills', 'Sweating', 'Night sweats', 'Dizziness',
  'Loss of appetite', 'Weight loss', 'Abdominal pain', 'Bloating',
  'Constipation', 'Skin rash', 'Itching', 'Swelling', 'Redness',
  'Wound discharge', 'Pus drainage', 'Burning urination', 'Frequent urination',
  'Blood in urine', 'Dark urine', 'Confusion', 'Drowsiness', 'Seizures',
  'Stiff neck', 'Sensitivity to light', 'Blurred vision', 'Ear pain',
  'Hearing loss', 'Eye redness', 'Eye discharge', 'Swollen lymph nodes',
  'Difficulty swallowing', 'Wheezing', 'Coughing blood', 'Yellowish skin',
  'Pale skin', 'Bruising easily', 'Bleeding gums', 'Rapid heartbeat',
  'Low blood pressure', 'Dehydration', 'Dry mouth', 'Excessive thirst',
  'Back pain', 'Pelvic pain', 'Rectal bleeding', 'Loss of smell',
  'Loss of taste', 'Tingling sensation', 'Numbness', 'Weakness',
  'Tremors', 'Irritability', 'Anxiety', 'Insomnia',
];

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

function normalizeTag(raw: string): string {
  const t = raw.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : '';
}

export function TagInput({ value, onChange, placeholder = 'Type a symptom…', className }: TagInputProps) {
  const [input, setInput]               = useState('');
  const [showSuggestions, setShow]      = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef    = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = input.length >= 1
    ? COMMON_SYMPTOMS.filter(
        s => s.toLowerCase().includes(input.toLowerCase()) &&
             !value.some(v => v.toLowerCase() === s.toLowerCase())
      ).slice(0, 8)
    : [];

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setShow(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const addTag = useCallback((raw: string) => {
    const tag = normalizeTag(raw);
    if (!tag || value.some(v => v.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
    setInput(''); setHighlightIdx(-1); setShow(false);
  }, [value, onChange]);

  const removeTag = useCallback((idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  }, [value, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      highlightIdx >= 0 && highlightIdx < suggestions.length
        ? addTag(suggestions[highlightIdx])
        : input.trim() && addTag(input);
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      removeTag(value.length - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault(); setHighlightIdx(p => Math.min(p + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setHighlightIdx(p => Math.max(p - 1, -1));
    } else if (e.key === 'Escape') {
      setShow(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Input container */}
      <div
        className={cn(
          'flex flex-wrap items-center gap-1.5 min-h-12',
          'rounded-lg border border-input bg-muted px-3 py-2 text-sm',
          'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0',
          'cursor-text transition-shadow',
          className
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag, idx) => (
          <Badge key={`${tag}-${idx}`} variant="secondary" className="gap-1 pr-1 text-xs rounded-md">
            {tag}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); removeTag(idx); }}
              className="ml-0.5 rounded p-0.5 hover:bg-muted-foreground/20 transition-colors"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={e => { setInput(e.target.value); setShow(true); setHighlightIdx(-1); }}
          onFocus={() => { if (input.length >= 1) setShow(true); }}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground tracking-[0.16px]"
          aria-label="Add symptom"
        />
      </div>

      {/* Suggestions popover */}
      {showSuggestions && suggestions.length > 0 && (
        <div className={cn(
          "absolute z-50 mt-1.5 w-full overflow-auto max-h-52",
          "rounded-lg border border-border bg-popover",
          "shadow-[0_8px_32px_-4px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.08)]",
        )}>
          {suggestions.map((s, idx) => (
            <button
              key={s}
              type="button"
              className={cn(
                'w-full text-left px-3 py-2 text-sm tracking-[0.16px] transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                idx === highlightIdx && 'bg-accent text-accent-foreground',
                idx !== suggestions.length - 1 && 'border-b border-border/50'
              )}
              onMouseDown={e => { e.preventDefault(); addTag(s); }}
              onMouseEnter={() => setHighlightIdx(idx)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
