/**
 * ErrorBoundary Component
 */

"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

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
              onClick={() => (window.location.href = "/")}
              className="rounded-full gap-2 px-6 bg-black dark:bg-zinc-100 text-white dark:text-zinc-900"
            >
              <Home size={15} />
              Back to Home
            </Button>
          </div>

          {/* Technical Debug Info (Visible only in Development) */}
          {process.env.NODE_ENV === "development" && this.state.error && (
            <div className="mt-12 w-full max-w-2xl overflow-hidden rounded-xl border border-red-100 dark:border-red-900/30 bg-red-50/30 dark:bg-red-900/5 p-4 text-left">
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">
                Debug Info
              </p>
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
