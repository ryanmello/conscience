import {
  ArrowLeft,
  Bot,
  Code,
  Loader2,
  Play,
  Settings,
  Square,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import type { CodeGenStatus } from "@/hooks/useCodeGenWebSocket";

export type AgentStatus =
  | "initialized"
  | "generating"
  | "generated"
  | "running"
  | "stopped"
  | "error";

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  createdAt: string;
}

interface SandboxHeaderProps {
  agent: Agent;
  isRunning: boolean;
  codeGenStatus: CodeGenStatus;
  codeGenProgress?: { currentFileIndex: number; totalFiles: number; currentFilePath: string | null };
  onGenerateCode: () => void;
  onStart: () => void;
  onStop: () => void;
}

const statusConfig: Record<AgentStatus, { label: string; className: string }> = {
  initialized: { label: "Initialized", className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
  generating: { label: "Generating", className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  generated: { label: "Ready", className: "bg-green-500/10 text-green-500 border-green-500/20" },
  running: { label: "Running", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  stopped: { label: "Stopped", className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
  error: { label: "Error", className: "bg-red-500/10 text-red-500 border-red-500/20" },
};

function CodeGenProgress({ codeGenStatus, progress }: {
  codeGenStatus: CodeGenStatus;
  progress?: SandboxHeaderProps["codeGenProgress"];
}) {
  if (codeGenStatus === "idle" || codeGenStatus === "complete") return null;

  const labels: Partial<Record<CodeGenStatus, string>> = {
    connecting: "Connecting...",
    parsing_plan: "Parsing plan...",
    generating_manifest: "Planning file structure...",
    generating_skeletons: "Generating skeletons...",
    validating: "Validating...",
    error: "Generation failed",
  };

  if (codeGenStatus === "generating_file" && progress) {
    return (
      <span className="text-xs text-muted-foreground">
        Generating file {progress.currentFileIndex + 1}/{progress.totalFiles}
        {progress.currentFilePath && (
          <span className="ml-1 text-foreground/60">{progress.currentFilePath}</span>
        )}
      </span>
    );
  }

  return (
    <span className="text-xs text-muted-foreground">{labels[codeGenStatus] ?? ""}</span>
  );
}

export default function SandboxHeader({
  agent,
  isRunning,
  codeGenStatus,
  codeGenProgress,
  onGenerateCode,
  onStart,
  onStop,
}: SandboxHeaderProps) {
  const status = statusConfig[agent.status] ?? statusConfig.initialized;
  const isGenerating = codeGenStatus !== "idle" && codeGenStatus !== "complete" && codeGenStatus !== "error";
  const hasCode = agent.status === "generated" || agent.status === "stopped" || agent.status === "error";
  const canRun = hasCode && !isGenerating;

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
        <Badge className={cn("border", status.className)}>
          {(agent.status === "running" || agent.status === "generating") && (
            <Loader2 size={10} className="animate-spin" />
          )}
          {status.label}
        </Badge>
        <CodeGenProgress codeGenStatus={codeGenStatus} progress={codeGenProgress} />
      </div>

      <div className="flex items-center gap-2">
        {/* Generate Code button */}
        {(agent.status === "initialized" || hasCode) && (
          <button
            onClick={onGenerateCode}
            disabled={isGenerating}
            className={cn(
              "cursor-pointer flex h-9 items-center gap-2 rounded-full px-5 text-sm font-medium transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed",
              isGenerating
                ? "bg-yellow-500/80 text-white"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Code size={14} />
                {hasCode ? "Regenerate" : "Generate Code"}
              </>
            )}
          </button>
        )}

        {/* Run / Stop button */}
        {canRun && (
          isRunning ? (
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
              Run
            </button>
          )
        )}

        <Button variant="ghost" size="icon-sm">
          <Settings size={16} />
        </Button>
      </div>
    </header>
  );
}
