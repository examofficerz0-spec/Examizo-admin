'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  badge?: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  className = '',
  triggerClassName = '',
  icon,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between gap-3 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl text-xs font-extrabold text-slate-900 dark:text-white shadow-xs hover:shadow-md transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          isOpen ? 'ring-2 ring-blue-500/30 border-blue-500 dark:border-blue-400 shadow-md' : ''
        } ${triggerClassName}`}
      >
        <div className="flex items-center gap-2 truncate">
          {icon && <span className="text-slate-500 dark:text-slate-400">{icon}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 transition-transform duration-250 ease-out ${
            isOpen ? 'rotate-180 text-blue-500 dark:text-blue-400' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 min-w-[210px] z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl py-1.5 max-h-64 overflow-y-auto animate-dropdown">
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3.5 py-2.5 text-xs font-bold flex items-center justify-between transition-all duration-150 text-left cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/90 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-extrabold pl-4 border-l-2 border-blue-600 dark:border-blue-400'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/90 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white hover:pl-4'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {opt.icon && <span className="text-slate-400">{opt.icon}</span>}
                  <span className="truncate">{opt.label}</span>
                  {opt.badge && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                      {opt.badge}
                    </span>
                  )}
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
