"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
  icon?: React.ElementType;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ElementType;
  className?: string;
  themeColor?: "purple" | "emerald";
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Select option",
  icon: Icon,
  className,
  themeColor = "purple",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const colorStyles = {
    purple: {
      text: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-900/20",
      border: "border-purple-500 ring-purple-500/20",
      focus: "focus:border-purple-500 focus:ring-purple-500/20",
      check: "text-purple-600",
    },
    emerald: {
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      border: "border-emerald-500 ring-emerald-500/20",
      focus: "focus:border-emerald-500 focus:ring-emerald-500/20",
      check: "text-emerald-600",
    },
  };

  const style = colorStyles[themeColor];

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-xl border transition-all duration-200",
          "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800",
          "text-zinc-900 dark:text-zinc-100",
          style.focus,
          isOpen ? cn(style.border, "ring-2") : "hover:border-zinc-300 dark:hover:border-zinc-700"
        )}
      >
        {Icon && <Icon size={16} className="text-zinc-400 shrink-0" />}
        <span className="flex-1 text-left truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={cn("text-zinc-400 transition-transform duration-200", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-[60] bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-1 max-h-60 overflow-y-auto">
            {options.map((option) => {
              const active = option.value === value;
              const OptionIcon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                    active 
                      ? cn(style.bg, style.text, "font-bold") 
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
                  )}
                >
                  {OptionIcon && <OptionIcon size={14} className="shrink-0" />}
                  <span className="flex-1 text-left truncate">{option.label}</span>
                  {active && <Check size={14} className={style.check} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
