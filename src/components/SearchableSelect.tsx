import { useMemo, useRef, useState, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { cn } from '../lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}

// Remove acentos pra busca funcionar digitando "ale" e achar "Alê" também.
function normalize(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Select com busca embutida — pensado pra listas grandes (ex: clientes de um
// studio com centenas de cadastros) onde rolar um <select> nativo item por
// item é uma experiência ruim. Mantém o mesmo visual dos selects do sistema.
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecionar...',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'Nenhum resultado encontrado.',
  disabled = false,
  className
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);

  const filteredOptions = useMemo(() => {
    const term = normalize(search.trim());
    if (!term) return options;
    return options.filter(o => normalize(o.label).includes(term) || normalize(o.sublabel || '').includes(term));
  }, [options, search]);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      // Pequeno delay pra garantir que o input já está montado antes do foco.
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          "select-premium w-full text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed",
        )}
        style={{ backgroundImage: 'none' }}
      >
        <span className={cn("truncate", !selected && "text-slate-300 font-normal")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && !disabled && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-card border border-slate-100 z-40 overflow-hidden animate-fade-up">
            <div className="p-2 border-b border-slate-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false); }}
                  placeholder={searchPlaceholder}
                  className="w-full bg-slate-50 rounded-lg pl-8 pr-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-pink-100 transition-all"
                />
              </div>
            </div>
            <div role="listbox" className="max-h-56 overflow-y-auto py-1">
              {filteredOptions.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs font-medium text-slate-300">{emptyMessage}</p>
              ) : (
                filteredOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-left transition-colors",
                      option.value === value ? "bg-pink-50 text-primary-dark font-semibold" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <span className="truncate">
                      {option.label}
                      {option.sublabel && <span className="text-slate-300 font-normal"> · {option.sublabel}</span>}
                    </span>
                    {option.value === value && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
