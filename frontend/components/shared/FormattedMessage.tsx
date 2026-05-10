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
  
  let currentListItems: { marker: string; text: string }[] = [];
  let currentParagraphLines: string[] = [];
  let currentTableRows: string[][] = [];

  const flushParagraph = (idx: number) => {
    if (currentParagraphLines.length > 0) {
      blocks.push(
        <p key={`p-${idx}`} className="leading-relaxed text-inherit mb-3 last:mb-0 text-sm">
          {parseInlineStyling(currentParagraphLines.join(" "))}
        </p>
      );
      currentParagraphLines = [];
    }
  };

  const flushList = (idx: number) => {
    if (currentListItems.length > 0) {
      const isNumbered = /^\d+/.test(currentListItems[0].marker);
      blocks.push(
        <ul key={`ul-${idx}`} className={cn("space-y-2 mb-3 last:mb-0 ml-1", isNumbered ? "list-decimal pl-4" : "list-none")}>
          {currentListItems.map((item, lIdx) => (
            <li key={lIdx} className={cn("text-sm leading-relaxed text-inherit", !isNumbered && "flex gap-2")}>
              {!isNumbered && (
                <span className="text-purple-500 dark:text-purple-400 mt-1 flex-shrink-0">•</span>
              )}
              <span>{parseInlineStyling(item.text)}</span>
            </li>
          ))}
        </ul>
      );
      currentListItems = [];
    }
  };

  const flushTable = (idx: number) => {
    if (currentTableRows.length < 2) {
      currentTableRows = [];
      return;
    }

    const headers = currentTableRows[0];
    const dataRows = currentTableRows.slice(1);

    // Fallback: If table is too wide (e.g. > 4 columns), render as list
    if (headers.length > 4) {
      blocks.push(
        <div key={`table-fallback-${idx}`} className="space-y-4 mb-4 border-l-2 border-purple-100 dark:border-purple-900/30 pl-4 py-1">
          {dataRows.map((row, rIdx) => (
            <div key={rIdx} className="space-y-1">
              {headers.map((h, cIdx) => (
                <div key={cIdx} className="text-xs flex gap-2">
                  <span className="font-bold text-gray-900 dark:text-zinc-100 whitespace-nowrap">{h}:</span>
                  <span className="text-gray-600 dark:text-zinc-400">{parseInlineStyling(row[cIdx] || "-")}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    } else {
      blocks.push(
        <div key={`table-${idx}`} className="overflow-x-auto mb-4 border border-gray-100 dark:border-zinc-800 rounded-lg shadow-sm">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-zinc-900/50">
                {headers.map((h, hIdx) => (
                  <th key={hIdx} className="px-3 py-2 font-bold border-b border-gray-100 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 uppercase tracking-wider">
                    {parseInlineStyling(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800/50">
              {dataRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-gray-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                  {headers.map((_, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-gray-700 dark:text-zinc-300">
                      {parseInlineStyling(row[cIdx] || "-")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    currentTableRows = [];
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    
    // Table handling
    const isTableRow = trimmed.startsWith("|") && trimmed.endsWith("|");
    if (isTableRow) {
      flushParagraph(idx);
      flushList(idx);
      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      
      // Skip separator row |---|
      if (cells.every((c) => /^-+$/.test(c))) return;
      
      currentTableRows.push(cells);
      return;
    } else if (currentTableRows.length > 0) {
      flushTable(idx);
    }

    // List handling
    const listMatch = line.match(/^\s*([•\-\*\+]|\d+\.)\s+(.*)/);
    if (listMatch) {
      flushParagraph(idx);
      currentListItems.push({ marker: listMatch[1], text: listMatch[2] });
      return;
    } else {
      flushList(idx);
    }
    
    // Heading handling
    const headingMatch = line.match(/^(#+)\s+(.*)/);
    if (headingMatch) {
      flushParagraph(idx);
      const level = headingMatch[1].length;
      blocks.push(
        <p key={`h-${idx}`} className={cn(
          "font-bold text-gray-900 dark:text-zinc-100 mb-2 mt-4 first:mt-0",
          level === 1 ? "text-base" : "text-sm"
        )}>
          {parseInlineStyling(headingMatch[2])}
        </p>
      );
      return;
    }

    if (trimmed === "") {
      flushParagraph(idx);
    } else {
      currentParagraphLines.push(trimmed);
    }
  });

  // Final flush
  flushParagraph(999);
  flushList(999);
  flushTable(999);

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
