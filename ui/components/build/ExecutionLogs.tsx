'use client';

import { useEffect, useRef } from "react";
import { Terminal } from "lucide-react";
import type { LogEntry } from "@/hooks/useCodeGenWebSocket";

interface ExecutionLogsProps {
  logs: LogEntry[];
  isActive?: boolean;
}

const levelColors = {
  info: "text-blue-400",
  success: "text-green-400",
  warning: "text-yellow-400",
  error: "text-red-400",
};

export default function ExecutionLogs({ logs, isActive = false }: ExecutionLogsProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted">
        <Terminal size={14} className="text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">
          Console Output
        </span>
        {logs.length > 0 && (
          <span className="text-xs text-muted-foreground/50 ml-auto">
            {logs.length} entries
          </span>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4 font-mono text-xs scrollbar-textarea">
        {logs.length === 0 ? (
          <span className="text-muted-foreground/40">Waiting for activity...</span>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-3 py-0.5">
              <span className="text-muted-foreground/60 shrink-0">{log.timestamp}</span>
              <span className={`shrink-0 ${levelColors[log.level]}`}>
                [{log.level.toUpperCase().padEnd(7)}]
              </span>
              <span className="text-foreground break-all">{log.message}</span>
            </div>
          ))
        )}
        {isActive && (
          <div className="flex items-center gap-2 mt-1 text-muted-foreground/40">
            <span className="animate-pulse">▋</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
