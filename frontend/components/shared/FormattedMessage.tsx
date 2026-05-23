"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface FormattedMessageProps {
  content: string;
  className?: string;
}

/**
 * FormattedMessage Component
 * 
 * Safely renders AI-generated text with markdown styling (bold, italic, lists, headings)
 * into React elements using react-markdown for reliable structured rendering.
 */
export function FormattedMessage({ content, className }: FormattedMessageProps) {
  if (!content) return null;

  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none text-inherit", className)}>
      <ReactMarkdown
        components={{
          // Ensure paragraph spacing and font-size match the design
          p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
          // Custom list styling to match FinWatch brand
          ul: ({ children }) => <ul className="list-none space-y-2 mb-3 ml-1">{children}</ul>,
          li: ({ children, ...props }) => {
             // For unordered lists, we add a purple bullet
             return (
               <li className="flex gap-2 items-start text-sm">
                 <span className="text-purple-500 dark:text-purple-400 mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-current" />
                 <span>{children}</span>
               </li>
             );
          },
          ol: ({ children }) => <ol className="list-decimal space-y-2 mb-3 ml-5">{children}</ol>,
          h1: ({ children }) => <h1 className="text-base font-bold text-gray-900 dark:text-zinc-100 mb-2 mt-4 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold text-gray-900 dark:text-zinc-100 mb-2 mt-4 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100 mb-2 mt-4 first:mt-0">{children}</h3>,
          strong: ({ children }) => <strong className="font-bold text-gray-900 dark:text-zinc-100">{children}</strong>,
          em: ({ children }) => <em className="italic text-gray-800 dark:text-zinc-200">{children}</em>,
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4 border border-gray-100 dark:border-zinc-800 rounded-lg shadow-sm">
              <table className="w-full text-xs text-left border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-50 dark:bg-zinc-900/50">{children}</thead>,
          th: ({ children }) => <th className="px-3 py-2 font-bold border-b border-gray-100 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 uppercase tracking-wider">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 text-gray-700 dark:text-zinc-300 border-b border-gray-50 dark:border-zinc-800/50">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
