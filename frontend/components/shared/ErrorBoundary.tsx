/**
 * ErrorBoundary Component
 * 
 * A robust class-based component that catches JavaScript errors anywhere in its
 * child component tree, logs those errors, and displays a fallback UI instead 
 * of crashing the entire application.
 * 
 * Following React best practices, this boundary provides users with a path to
 * recovery (Try Again/Home) and displays technical debug information only 
 * during local development.
 */

"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Props for the ErrorBoundary component
 */
interface Props {
  /** The component tree to be protected by this boundary */
  children?: ReactNode;
  /** Optional custom message to override the default error text */
  fallbackMessage?: string;
}

/**
 * Internal state for tracking error status
 */
interface State {
  /** True if an uncaught error has been detected in the children */
  hasError: boolean;
  /** The actual error object for debugging purposes */
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  /**
   * Static method to update state when an error is caught.
   * This triggers the rendering of the fallback UI.
   */
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /**
   * Lifecycle method for side-effects related to errors.
   * Used here to log the error to the console (or an external monitoring service).
   */
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  /**
   * Resets the error state and attempts to reload the application.
   */
  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] w-full flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500">
          {/* Error Icon Container */}
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 dark:bg-red-900/10 text-red-500 shadow-inner">
            <AlertTriangle size={40} />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-2">
            Something went wrong
          </h2>
          
          <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-md mb-8 leading-relaxed">
            {this.props.fallbackMessage || 
              "An unexpected error occurred while rendering this component. Our team has been notified."}
          </p>

          {/* Recovery Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button
              onClick={this.handleReset}
              variant="outline"
              className="rounded-full gap-2 px-6"
            >
              <RefreshCcw size={15} />
              Try Again
            </Button>
            
            <Button
              onClick={() => window.location.href = "/"}
              className="rounded-full gap-2 px-6 bg-black dark:bg-zinc-100 text-white dark:text-zinc-900"
            >
              <Home size={15} />
              Back to Home
            </Button>
          </div>

          {/* Technical Debug Info (Visible only in Development) */}
          {process.env.NODE_ENV === "development" && this.state.error && (
            <div className="mt-12 w-full max-w-2xl overflow-hidden rounded-xl border border-red-100 dark:border-red-900/30 bg-red-50/30 dark:bg-red-900/5 p-4 text-left">
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">Debug Info</p>
              <pre className="text-xs text-red-600 dark:text-red-400 font-mono overflow-x-auto whitespace-pre-wrap">
                {this.state.error.toString()}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
