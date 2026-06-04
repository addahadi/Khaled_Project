import { useState, useRef, useCallback, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Curated symptom list for autocomplete ─────────────────────────────────────
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
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export function TagInput({ value, onChange, placeholder = 'Type a symptom…', className }: TagInputProps) {
  const [input, setInput]             = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx]       = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filtered suggestions based on current input
  const suggestions = input.length >= 1
    ? COMMON_SYMPTOMS.filter(
        s => s.toLowerCase().includes(input.toLowerCase()) &&
             !value.some(v => v.toLowerCase() === s.toLowerCase())
      ).slice(0, 8)
    : [];

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addTag = useCallback((raw: string) => {
    const tag = normalizeTag(raw);
    if (!tag) return;
    if (value.some(v => v.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
    setInput('');
    setHighlightIdx(-1);
    setShowSuggestions(false);
  }, [value, onChange]);

  const removeTag = useCallback((idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  }, [value, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < suggestions.length) {
        addTag(suggestions[highlightIdx]);
      } else if (input.trim()) {
        addTag(input);
      }
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      removeTag(value.length - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          'flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          className,
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag, idx) => (
          <Badge
            key={`${tag}-${idx}`}
            variant="secondary"
            className="gap-1 pr-1 text-xs"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(idx); }}
              className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
            setHighlightIdx(-1);
          }}
          onFocus={() => { if (input.length >= 1) setShowSuggestions(true); }}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground"
          aria-label="Add symptom"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-auto">
          {suggestions.map((s, idx) => (
            <button
              key={s}
              type="button"
              className={cn(
                'w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors',
                idx === highlightIdx && 'bg-accent text-accent-foreground',
              )}
              onMouseDown={(e) => { e.preventDefault(); addTag(s); }}
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
