import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface SelectOption {
  value: any;
  label: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: any;
  onChange: (value: any) => void;
  className?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export default function CustomSelect({
  options,
  value,
  onChange,
  className = '',
  placeholder = 'Pilih salah satu...',
  icon,
  size = 'md',
  disabled = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Tutup dropdown jika klik di luar komponen
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (val: any) => {
    onChange(val);
    setIsOpen(false);
  };

  const isSmall = size === 'sm';

  return (
    <div ref={containerRef} className={`relative w-full text-left ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between text-black font-black transition-all select-none
          ${disabled 
            ? 'bg-slate-100 border-black opacity-60 cursor-not-allowed shadow-none translate-x-0 translate-y-0' 
            : 'bg-white cursor-pointer hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]'
          }
          ${isSmall
            ? `border-2 rounded-full px-4 py-1.5 text-xs ${disabled ? '' : 'shadow-neo-sm active:translate-x-[1px] active:translate-y-[1px]'}`
            : `border-3 rounded-xl px-4 py-3 text-sm ${disabled ? '' : 'shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px]'}`
          }`}
      >
        <div className="flex items-center gap-2 truncate">
          {icon && <span className="shrink-0">{icon}</span>}
          {selectedOption ? (
            <>
              {selectedOption.icon && <span className="shrink-0">{selectedOption.icon}</span>}
              <span className="truncate">{selectedOption.label}</span>
            </>
          ) : (
            <span className="text-slate-400 font-semibold">{placeholder}</span>
          )}
        </div>
        <span className="shrink-0 ml-2 text-black font-black">
          {isOpen ? (
            <ChevronUp size={isSmall ? 13 : 16} strokeWidth={2.5} />
          ) : (
            <ChevronDown size={isSmall ? 13 : 16} strokeWidth={2.5} />
          )}
        </span>
      </button>

      {/* Options Dropdown Menu */}
      {isOpen && (
        <div className={`absolute left-0 w-full mt-2 bg-white border-black shadow-neo z-50 overflow-hidden divide-y border-t-0 origin-top animate-in fade-in-0 zoom-in-95 duration-150
          ${isSmall ? 'border-2 rounded-xl' : 'border-3 rounded-2xl'}`}
          style={{ transitionTimingFunction: 'var(--ease-out)' }}
        >
          <div className="max-h-60 overflow-y-auto divide-y divide-black/10">
            {options.length === 0 ? (
              <div className={`font-bold text-slate-400 text-center ${isSmall ? 'px-3 py-2 text-xxs' : 'px-4 py-3.5 text-xs'}`}>
                Tidak ada opsi tersedia
              </div>
            ) : (
              options.map((option, idx) => {
                const isSelected = option.value === value;
                return (
                  <div
                    key={idx}
                    onClick={() => handleSelect(option.value)}
                    className={`font-black text-black hover:bg-neoCream transition-colors cursor-pointer flex items-center gap-2 select-none
                      ${isSmall ? 'px-4 py-2 text-xs' : 'px-4 py-3 text-sm'}
                      ${isSelected ? 'bg-neoCream/60 border-l-4 border-neoYellow' : ''}`}
                  >
                    {option.icon && <span className="shrink-0">{option.icon}</span>}
                    <span className="truncate">{option.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
