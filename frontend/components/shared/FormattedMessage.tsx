"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";

interface FormattedMessageProps {
  content: string;
  className?: string;
}

function getTextFromChildren(node: React.ReactNode): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    return node.map(getTextFromChildren).join("");
  }
  if (React.isValidElement(node)) {
    return getTextFromChildren(node.props.children);
  }
  return "";
}

/**
 * FormattedMessage Component
 *
 * Safely renders AI-generated text with markdown styling (bold, italic, lists, headings, tables)
 * into React elements using react-markdown for reliable structured rendering.
 * Supports GFM (GitHub Flavored Markdown) for tables.
 */
export function FormattedMessage({
  content,
  className,
}: FormattedMessageProps) {
  if (!content) return null;

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none text-inherit prose-ul:my-0 prose-ol:my-0 prose-li:my-0 prose-ul:pl-0 prose-ol:pl-0",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Ensure paragraph spacing and font-size match the design
          p: ({ children }) => (
            <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
          ),

          // Custom list styling
          ul: ({ children }) => (
            <ul className="list-none space-y-1.5 mb-3 ml-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1.5 mb-3 ml-5 marker:text-purple-500 dark:marker:text-purple-400 marker:font-bold [&_ol]:list-[lower-alpha]">
              {children}
            </ol>
          ),

          li: ({ children, ...props }) => {
            // react-markdown passes 'ordered' prop to 'li'
            const { ordered, ...rest } = props as any;

            if (ordered) {
              return (
                <li className="text-sm leading-relaxed pl-1 [&>p]:inline [&>p]:m-0 [&>p]:leading-relaxed">{children}</li>
              );
            }

            // Detect if the content has a manual letter/number marker (e.g. "a. ", "1. ", "a) ")
            // to avoid rendering a duplicate purple dot.
            const plainText = getTextFromChildren(children).trim();
            const hasManualMarker = /^[a-zA-Z0-9]\s*[\.\)]\s+/.test(plainText) || /^[a-zA-Z]\s+-\s+/.test(plainText);

            if (hasManualMarker) {
              return (
                <li className="list-none text-sm leading-relaxed pl-0 [&>p]:inline [&>p]:m-0 [&>p]:leading-relaxed">
                  <div className="leading-relaxed flex-1">{children}</div>
                </li>
              );
            }

            return (
              <li className="flex gap-2 items-start text-sm">
                <span className="text-purple-500 dark:text-purple-400 mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-current" />
                <div className="leading-relaxed flex-1 [&>p]:inline [&>p]:m-0 [&>p]:leading-relaxed">{children}</div>
              </li>
            );
          },

          h1: ({ children }) => (
            <h1 className="text-base font-bold text-gray-900 dark:text-zinc-100 mb-2 mt-4 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold text-gray-900 dark:text-zinc-100 mb-2 mt-4 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100 mb-2 mt-4 first:mt-0">
              {children}
            </h3>
          ),

          strong: ({ children }) => (
            <strong className="font-bold text-gray-900 dark:text-zinc-100">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-800 dark:text-zinc-200">
              {children}
            </em>
          ),

          // Table rendering with GFM support
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 border border-gray-100 dark:border-zinc-800 rounded-lg shadow-sm">
              <table className="w-full text-xs text-left border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50 dark:bg-zinc-900/50">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 font-bold border-b border-gray-100 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-gray-700 dark:text-zinc-300 border-b border-gray-50 dark:border-zinc-800/50">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
