import { Terminal } from "lucide-react";

export const mockLogs = [
  {
    timestamp: "10:30:15",
    level: "info",
    message: "Agent sandbox initialized",
  },
  { timestamp: "10:30:16", level: "info", message: "Loading agent code..." },
  {
    timestamp: "10:30:17",
    level: "success",
    message: "Agent code loaded successfully",
  },
  { timestamp: "10:30:18", level: "info", message: "Waiting for execution..." },
];

export default function ExecutionLogs() {
  const levelColors = {
    info: "text-blue-400",
    success: "text-green-400",
    warning: "text-yellow-400",
    error: "text-red-400",
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted">
        <Terminal size={14} className="text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">
          Console Output
        </span>
      </div>
      <div className="flex-1 overflow-auto p-4 font-mono text-xs scrollbar-textarea">
        {mockLogs.map((log, i) => (
          <div key={i} className="flex gap-3 py-0.5">
            <span className="text-muted-foreground/60">{log.timestamp}</span>
            <span
              className={levelColors[log.level as keyof typeof levelColors]}
            >
              [{log.level.toUpperCase()}]
            </span>
            <span className="text-foreground">{log.message}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 mt-2 text-muted-foreground/40">
          <span className="animate-pulse">▋</span>
        </div>
      </div>
    </div>
  );
}
