"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface FormattedMessageProps {
  content: string;
  className?: string;
}

/**
 * FormattedMessage Component
 * 
 * Safely renders AI-generated text with markdown-like styling (bold, italic, lists, headings)
 * into React elements without raw markdown artifacts.
 */
export function FormattedMessage({ content, className }: FormattedMessageProps) {
  if (!content) return null;

  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  
  let currentListItems: string[] = [];
  let currentParagraphLines: string[] = [];

  const flushParagraph = (idx: number) => {
    if (currentParagraphLines.length > 0) {
      blocks.push(
        <p key={`p-${idx}`} className="leading-relaxed text-inherit mb-3 last:mb-0">
          {parseInlineStyling(currentParagraphLines.join(" "))}
        </p>
      );
      currentParagraphLines = [];
    }
  };

  const flushList = (idx: number) => {
    if (currentListItems.length > 0) {
      blocks.push(
        <ul key={`ul-${idx}`} className="space-y-1.5 ml-1 mb-3 last:mb-0">
          {currentListItems.map((item, lIdx) => (
            <li key={lIdx} className="flex gap-2 text-inherit">
              <span className="text-gray-400 dark:text-zinc-500 mt-1 flex-shrink-0">•</span>
              <span>{parseInlineStyling(item)}</span>
            </li>
          ))}
        </ul>
      );
      currentListItems = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    
    // Check for list item markers: •, -, *, +, or "1. "
    const listMatch = line.match(/^\s*([•\-\*\+]|\d+\.)\s+(.*)/);
    
    // Check for heading markers: #, ##, ###
    const headingMatch = line.match(/^(#+)\s+(.*)/);

    if (listMatch) {
      flushParagraph(idx);
      currentListItems.push(listMatch[2]);
    } else if (headingMatch) {
      flushParagraph(idx);
      flushList(idx);
      const level = headingMatch[1].length;
      blocks.push(
        <p key={`h-${idx}`} className={cn(
          "font-bold text-gray-900 dark:text-zinc-100 mb-2 mt-4 first:mt-0",
          level === 1 ? "text-base" : "text-sm"
        )}>
          {parseInlineStyling(headingMatch[2])}
        </p>
      );
    } else if (trimmed === "") {
      flushParagraph(idx);
      flushList(idx);
    } else {
      flushList(idx);
      currentParagraphLines.push(trimmed);
    }
  });

  // Final flush
  flushParagraph(999);
  flushList(999);

  return (
    <div className={cn("text-inherit", className)}>
      {blocks}
    </div>
  );
}

/**
 * Helper to parse bold (**text**) and italics (*text*) within a string
 */
function parseInlineStyling(text: string) {
  // Regex to find **bold** or *italic*
  // We process bold first, then italic
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|_.*?_)/g);

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-bold text-gray-900 dark:text-zinc-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return (
        <em key={i} className="italic italic text-gray-800 dark:text-zinc-200">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}
