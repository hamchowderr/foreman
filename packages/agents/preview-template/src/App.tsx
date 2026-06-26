import { Component, type ErrorInfo, type ReactNode } from "react";

import Generated from "./generated";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

/**
 * Catches render-time errors thrown by the agent-generated component so a broken
 * `generated.tsx` shows a readable message instead of a blank white screen.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the real stack in the dev console too.
    console.error("Generated component crashed:", error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <div className="mx-auto max-w-2xl rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">
          <h2 className="text-base font-semibold">Generated component failed to render</h2>
          <p className="mt-2 text-sm opacity-80">{error.message}</p>
          {error.stack ? (
            <pre className="mt-4 overflow-x-auto rounded-lg bg-background/60 p-3 text-xs whitespace-pre-wrap">
              {error.stack}
            </pre>
          ) : null}
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <main className="min-h-screen w-full bg-background p-6 md:p-8">
      <ErrorBoundary>
        <Generated />
      </ErrorBoundary>
    </main>
  );
}
