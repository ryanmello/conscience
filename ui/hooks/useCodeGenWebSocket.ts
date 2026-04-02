"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface ManifestFile {
  path: string;
  description: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
}

export interface ValidationIssue {
  file: string;
  line_hint: string;
  issue: string;
}

export interface LogEntry {
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
}

export type CodeGenStatus =
  | "idle"
  | "connecting"
  | "parsing_plan"
  | "generating_manifest"
  | "generating_skeletons"
  | "generating_file"
  | "validating"
  | "fixing"
  | "complete"
  | "error";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

interface CodeGenProgress {
  currentFileIndex: number;
  totalFiles: number;
  currentFilePath: string | null;
}

export function useCodeGenWebSocket() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [codeGenStatus, setCodeGenStatus] = useState<CodeGenStatus>("idle");
  const [manifest, setManifest] = useState<ManifestFile[]>([]);
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [progress, setProgress] = useState<CodeGenProgress>({
    currentFileIndex: 0,
    totalFiles: 0,
    currentFilePath: null,
  });
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const wsRef = useRef<WebSocket | null>(null);

  const addLog = useCallback((level: LogEntry["level"], message: string) => {
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs((prev) => [...prev, { timestamp, level, message }]);
  }, []);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const startCodeGen = useCallback(async (agentId: string) => {
    setCodeGenStatus("connecting");
    setManifest([]);
    setFiles([]);
    setProgress({ currentFileIndex: 0, totalFiles: 0, currentFilePath: null });
    setValidationIssues([]);
    setError(null);
    setLogs([]);
    setConnectionState("connecting");
    addLog("info", "Connecting to code generation service...");

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      setError("Not authenticated");
      setConnectionState("error");
      setCodeGenStatus("error");
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL || "ws://localhost:8000";
    const fullUrl = `${wsUrl}/api/agent/ws/codegen?token=${session.access_token}`;

    try {
      const ws = new WebSocket(fullUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState("connected");
        setCodeGenStatus("parsing_plan");
        addLog("success", "Connected to backend");
        addLog("info", "Starting code generation...");
        ws.send(JSON.stringify({
          type: "start_codegen",
          agent_id: agentId,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleMessage(data);
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      ws.onerror = () => {
        setError("Connection error");
        setConnectionState("error");
        setCodeGenStatus("error");
      };

      ws.onclose = () => {
        setConnectionState("disconnected");
        wsRef.current = null;
      };
    } catch (e) {
      console.error("Failed to connect:", e);
      setError("Failed to connect");
      setConnectionState("error");
      setCodeGenStatus("error");
    }
  }, []);

  const handleMessage = useCallback((data: Record<string, unknown>) => {
    const type = data.type as string;

    const statusLabels: Record<string, string> = {
      parsing_plan: "Parsing plan document...",
      generating_manifest: "Generating file manifest...",
      generating_skeletons: "Generating skeleton contract...",
      generating_files: "Generating files...",
      validating: "Validating generated code...",
    };

    switch (type) {
      case "codegen.status": {
        const status = data.status as string;
        if (statusLabels[status]) {
          addLog("info", statusLabels[status]);
        }
        if (status === "parsing_plan" || status === "generating_manifest" ||
            status === "generating_skeletons" || status === "validating") {
          setCodeGenStatus(status as CodeGenStatus);
        }
        break;
      }

      case "codegen.manifest": {
        const manifestFiles = data.files as ManifestFile[];
        setManifest(manifestFiles);
        setProgress((prev) => ({ ...prev, totalFiles: manifestFiles.length }));
        addLog("success", `File manifest ready: ${manifestFiles.length} files planned`);
        for (const f of manifestFiles) {
          addLog("info", `  ${f.path} — ${f.description}`);
        }
        break;
      }

      case "codegen.skeletons": {
        const content = data.content as string;
        addLog("success", `Skeleton contract generated (${content.length.toLocaleString()} chars)`);
        break;
      }

      case "codegen.file_start": {
        const path = data.path as string;
        const index = data.index as number;
        const total = data.total as number;
        setCodeGenStatus("generating_file");
        setProgress({ currentFileIndex: index, totalFiles: total, currentFilePath: path });
        addLog("info", `Generating ${path} (${index + 1}/${total})...`);
        break;
      }

      case "codegen.file_complete": {
        const filePath = data.path as string;
        const content = data.content as string;
        const file: GeneratedFile = {
          path: filePath,
          content,
          language: data.language as string,
        };
        setFiles((prev) => [...prev, file]);
        setProgress((prev) => ({
          ...prev,
          currentFileIndex: (data.index as number ?? prev.currentFileIndex) + 1,
          currentFilePath: null,
        }));
        addLog("success", `${filePath} generated (${content.length.toLocaleString()} chars)`);
        break;
      }

      case "codegen.validation_result": {
        const iteration = data.iteration as number;
        const valid = data.valid as boolean;
        const issues = data.issues as ValidationIssue[] | undefined;
        if (valid || !issues || issues.length === 0) {
          addLog("success", `Validation passed${iteration > 0 ? ` (after ${iteration} fix iteration${iteration > 1 ? "s" : ""})` : ""}`);
        } else {
          setValidationIssues(issues);
          addLog("warning", `Validation found ${issues.length} issue(s)${iteration > 0 ? ` (iteration ${iteration})` : ""}`);
          for (const issue of issues) {
            addLog("warning", `  ${issue.file}: ${issue.issue}`);
          }
        }
        break;
      }

      case "codegen.fix_start": {
        const iteration = data.iteration as number;
        const filesToFix = data.filesToFix as string[];
        setCodeGenStatus("fixing");
        addLog("info", `Fix iteration ${iteration}: fixing ${filesToFix.length} file(s)...`);
        break;
      }

      case "codegen.fix_file_start": {
        const path = data.path as string;
        const iteration = data.iteration as number;
        addLog("info", `Fixing ${path} (iteration ${iteration})...`);
        break;
      }

      case "codegen.fix_file_complete": {
        const filePath = data.path as string;
        const content = data.content as string;
        setFiles((prev) => {
          const existing = prev.findIndex((f) => f.path === filePath);
          if (existing !== -1) {
            const updated = [...prev];
            updated[existing] = { ...updated[existing], content };
            return updated;
          }
          return prev;
        });
        addLog("success", `${filePath} fixed (${content.length.toLocaleString()} chars)`);
        break;
      }

      case "codegen.complete": {
        const totalFiles = data.totalFiles as number;
        const issues = data.issues as ValidationIssue[] | undefined;
        const fixIterations = data.fixIterations as number | undefined;
        setCodeGenStatus("complete");
        if (issues && issues.length > 0) {
          setValidationIssues(issues);
          addLog("warning", `${issues.length} issue(s) remaining after ${fixIterations ?? 0} fix iteration(s)`);
        }
        const iterMsg = fixIterations ? ` (${fixIterations} fix iteration${fixIterations > 1 ? "s" : ""})` : "";
        addLog("success", `Code generation complete: ${totalFiles} files${iterMsg}`);
        break;
      }

      case "codegen.error": {
        const msg = data.message as string;
        setError(msg);
        setCodeGenStatus("error");
        addLog("error", msg);
        break;
      }

      case "task.error": {
        const errMsg = data.error as string;
        setError(errMsg);
        setCodeGenStatus("error");
        addLog("error", errMsg);
        break;
      }
    }
  }, [addLog]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionState("disconnected");
  }, []);

  const reset = useCallback(() => {
    disconnect();
    setCodeGenStatus("idle");
    setManifest([]);
    setFiles([]);
    setProgress({ currentFileIndex: 0, totalFiles: 0, currentFilePath: null });
    setValidationIssues([]);
    setError(null);
    setLogs([]);
  }, [disconnect]);

  return {
    connectionState,
    codeGenStatus,
    manifest,
    files,
    progress,
    validationIssues,
    error,
    logs,
    startCodeGen,
    disconnect,
    reset,
  };
}
