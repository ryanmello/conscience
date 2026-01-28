import {
  ArrowLeft,
  Bot,
  Loader2,
  Play,
  Settings,
  Square,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

type AgentStatus = "building" | "ready" | "running" | "error";

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  createdAt: string;
}

export const mockAgent: Agent = {
  id: "agent-123",
  name: "Research Assistant",
  status: "building",
  createdAt: "2025-01-27T10:30:00Z",
};

export default function SandboxHeader({
  agent,
  isRunning,
  onStart,
  onStop,
}: {
  agent: Agent;
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const statusColors = {
    building: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    ready: "bg-green-500/10 text-green-500 border-green-500/20",
    running: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    error: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-5 py-4">
      <div className="flex items-center gap-4">
        <Link
          href="/build"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="text-sm">Back</span>
        </Link>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
            <Bot size={18} className="text-blue-500" />
          </div>
          <div>
            <h1 className="font-medium">{agent.name}</h1>
            <p className="text-xs text-muted-foreground">ID: {agent.id}</p>
          </div>
        </div>
        <Badge className={cn("border", statusColors[agent.status])}>
          {agent.status === "running" && (
            <Loader2 size={10} className="animate-spin" />
          )}
          {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        {isRunning ? (
          <button
            onClick={onStop}
            className="cursor-pointer flex h-9 items-center gap-2 rounded-full bg-red-500 px-5 text-sm font-medium text-white transition-all hover:shadow-md"
          >
            <Square size={14} />
            Stop
          </button>
        ) : (
          <button
            onClick={onStart}
            className="cursor-pointer flex h-9 items-center gap-2 rounded-full bg-blue-500 px-5 text-sm font-medium text-white transition-all hover:shadow-md"
          >
            <Play size={14} />
            Start Building
          </button>
        )}
        <Button variant="ghost" size="icon-sm">
          <Settings size={16} />
        </Button>
      </div>
    </header>
  );
}
