"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Calendar, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  themeColor?: "purple" | "emerald";
}

export function CustomDatePicker({
  value,
  onChange,
  placeholder = "Select date",
  className,
  themeColor = "purple",
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Constants
  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // Smart Positioning Logic
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // If less than 350px below, open upward
      setOpenUpward(spaceBelow < 350);
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Format display date
  const displayDate = useMemo(() => {
    if (!value) return null;
    return new Date(value).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [value]);

  // Calendar Logic
  const calendarGrid = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const prevMonthDays = new Date(year, month, 0).getDate();
    
    const grid = [];
    
    // Previous month overlap
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      grid.push({
        day: prevMonthDays - i,
        month: month - 1,
        year: month === 0 ? year - 1 : year,
        current: false
      });
    }
    
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      grid.push({
        day: i,
        month: month,
        year,
        current: true
      });
    }
    
    // Next month overlap
    const remaining = 42 - grid.length;
    for (let i = 1; i <= remaining; i++) {
      grid.push({
        day: i,
        month: month + 1,
        year: month === 11 ? year + 1 : year,
        current: false
      });
    }
    
    return grid;
  }, [viewDate]);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleSelectDate = (d: number, m: number, y: number) => {
    const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const colorStyles = {
    purple: {
      text: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-900/20",
      border: "border-purple-500 ring-purple-500/20",
      active: "bg-purple-600 text-white shadow-lg shadow-purple-500/30",
      hover: "hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-600 dark:hover:text-purple-300",
    },
    emerald: {
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      border: "border-emerald-500 ring-emerald-500/20",
      active: "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30",
      hover: "hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-300",
    },
  };

  const style = colorStyles[themeColor];

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full h-11 flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-xl border transition-all duration-200",
          "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800",
          "text-zinc-900 dark:text-zinc-100",
          isOpen ? cn(style.border, "ring-2") : "hover:border-zinc-300 dark:hover:border-zinc-700",
          value && cn(style.bg, style.text, "font-bold border-transparent")
        )}
      >
        <Calendar size={16} className={value ? style.text : "text-zinc-400"} />
        <span className={cn("flex-1 text-left truncate", !value && "text-zinc-400 dark:text-zinc-600")}>
          {displayDate || placeholder}
        </span>
        {value && (
          <X 
            size={14} 
            className="text-zinc-400 hover:text-red-500 transition-colors" 
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
          />
        )}
      </button>

      {/* Modern Calendar Popover */}
      {isOpen && (
        <div 
          ref={calendarRef}
          className={cn(
            "absolute left-0 right-0 md:left-auto md:w-64 z-[70] bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in duration-200",
            openUpward 
              ? "bottom-full mb-2 slide-in-from-bottom-2" 
              : "top-full mt-2 slide-in-from-top-2"
          )}
        >
          {/* Calendar Header - More Compact */}
          <div className="p-3 flex items-center justify-between border-b border-zinc-50 dark:border-zinc-800">
            <button 
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </p>
            <button 
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Days Header - Compact */}
          <div className="grid grid-cols-7 gap-px p-1.5 bg-zinc-50/50 dark:bg-zinc-800/30">
            {DAYS.map(d => (
              <span key={d} className="text-[9px] font-bold text-zinc-400 uppercase text-center py-0.5">
                {d}
              </span>
            ))}
          </div>

          {/* Calendar Grid - Compact Cells */}
          <div className="grid grid-cols-7 gap-px p-1.5">
            {calendarGrid.map((item, idx) => {
              const dateStr = `${item.year}-${String(item.month + 1).padStart(2, "0")}-${String(item.day).padStart(2, "0")}`;
              const isSelected = dateStr === value;
              const isToday = new Date().toISOString().split('T')[0] === dateStr;

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectDate(item.day, item.month, item.year)}
                  className={cn(
                    "h-8 rounded-lg text-[11px] transition-all flex items-center justify-center relative",
                    !item.current && "text-zinc-300 dark:text-zinc-700",
                    item.current && !isSelected && "text-zinc-600 dark:text-zinc-300",
                    item.current && !isSelected && style.hover,
                    isSelected ? style.active : "",
                  )}
                >
                  {item.day}
                  {isToday && !isSelected && (
                    <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-purple-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer - More Compact */}
          <div className="p-2 border-t border-zinc-50 dark:border-zinc-800 flex justify-center">
            <button
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                onChange(today);
                setIsOpen(false);
              }}
              className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-1", style.text)}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
