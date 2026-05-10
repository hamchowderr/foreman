"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type LogLevel = "info" | "warn" | "error" | "debug";

export type DevLogEntry = {
  id: string;
  timestamp: number;
  level: LogLevel;
  category: "stream" | "transport" | "error" | "lifecycle" | "approval";
  message: string;
  data?: unknown;
};

type DevConsoleContextValue = {
  logs: DevLogEntry[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  log: (
    level: LogLevel,
    category: DevLogEntry["category"],
    message: string,
    data?: unknown,
  ) => void;
  clear: () => void;
};

const DevConsoleContext = createContext<DevConsoleContextValue | null>(null);

let logCounter = 0;

export function DevConsoleProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<DevLogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const logsRef = useRef(logs);
  logsRef.current = logs;

  const log = useCallback(
    (level: LogLevel, category: DevLogEntry["category"], message: string, data?: unknown) => {
      const entry: DevLogEntry = {
        id: `log-${++logCounter}`,
        timestamp: Date.now(),
        level,
        category,
        message,
        data,
      };
      setLogs((prev) => {
        const next = [...prev, entry];
        // Keep max 500 entries
        return next.length > 500 ? next.slice(-500) : next;
      });
    },
    [],
  );

  const clear = useCallback(() => setLogs([]), []);

  // Keyboard shortcut: Ctrl+Shift+D
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <DevConsoleContext.Provider value={{ logs, isOpen, setIsOpen, log, clear }}>
      {children}
    </DevConsoleContext.Provider>
  );
}

export function useDevConsole() {
  const context = useContext(DevConsoleContext);
  if (!context) {
    throw new Error("useDevConsole must be used within DevConsoleProvider");
  }
  return context;
}
