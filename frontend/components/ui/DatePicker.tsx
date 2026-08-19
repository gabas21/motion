'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';

interface DatePickerProps {
  value: string; // Format: YYYY-MM-DD
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function DatePicker({
  value,
  onChange,
  disabled = false,
  placeholder = 'dd/mm/yyyy'
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  });

  const containerRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update currentMonth if value changes from outside
  useEffect(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        setCurrentMonth(parsed);
      }
    }
  }, [value]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const monthsEng = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysInWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay(); // Sunday = 0

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const handleSelectCell = (cell: { day: number; dateString: string }) => {
    onChange(cell.dateString);
    setIsOpen(false);
  };

  const handleToday = () => {
    const today = new Date();
    const formatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    onChange(formatted);
    setCurrentMonth(today);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  // Format value to DD/MM/YYYY for display
  const getDisplayValue = () => {
    if (!value) return placeholder;
    const parts = value.split('-'); // YYYY-MM-DD
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return value;
  };

  // Generate 42 cells (6 rows x 7 days) to fill the grid completely
  const getCalendarCells = () => {
    const prevMonthYear = month === 0 ? year - 1 : year;
    const prevMonthVal = month === 0 ? 11 : month - 1;
    const daysInPrevMonth = getDaysInMonth(prevMonthYear, prevMonthVal);

    const firstDayIndex = getFirstDayOfMonth(year, month);
    const totalDays = getDaysInMonth(year, month);

    const cells: { day: number; isCurrentMonth: boolean; dateString: string }[] = [];

    // Previous month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      cells.push({
        day: d,
        isCurrentMonth: false,
        dateString: `${prevMonthYear}-${String(prevMonthVal + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      cells.push({
        day: d,
        isCurrentMonth: true,
        dateString: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      });
    }

    // Next month leading days
    const nextMonthYear = month === 11 ? year + 1 : year;
    const nextMonthVal = month === 11 ? 0 : month + 1;
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push({
        day: d,
        isCurrentMonth: false,
        dateString: `${nextMonthYear}-${String(nextMonthVal + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      });
    }

    return cells;
  };

  // Check if cell matches currently selected value
  const isSelected = (dateString: string) => {
    return value === dateString;
  };

  return (
    <div ref={containerRef} className="relative w-full text-left">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full neo-input rounded-xl pl-10 pr-4 py-3 text-sm bg-white text-black font-black flex items-center justify-start cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed relative"
      >
        <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-black shrink-0 pointer-events-none" />
        <span className={`truncate text-left ${value ? 'text-black font-black' : 'text-gray-400 font-bold'}`}>
          {getDisplayValue()}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 w-[280px] text-left select-none animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-1 text-xs font-bold text-slate-800">
              <span>{monthsEng[month]} {year}</span>
              <ChevronDown className="w-3 h-3 text-slate-500 mt-0.5" />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="text-sm font-black text-slate-500 hover:text-slate-800 px-1 rounded hover:bg-slate-50 transition-all cursor-pointer"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="text-sm font-black text-slate-500 hover:text-slate-800 px-1 rounded hover:bg-slate-50 transition-all cursor-pointer"
              >
                ↓
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-[10px] text-center font-bold text-slate-400 mb-2">
            {daysInWeek.map((day, idx) => (
              <span key={idx}>
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {getCalendarCells().map((cell, idx) => {
              const selected = isSelected(cell.dateString);

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectCell(cell)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                    selected
                      ? 'bg-slate-900 border-2 border-slate-900 text-white shadow-md'
                      : !cell.isCurrentMonth
                      ? 'text-slate-300 hover:bg-slate-50 font-normal'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Actions Footer */}
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs font-bold text-blue-500 hover:text-blue-600 transition-colors cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="text-xs font-bold text-blue-500 hover:text-blue-600 transition-colors cursor-pointer"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

