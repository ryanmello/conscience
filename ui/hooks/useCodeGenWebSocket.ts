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

export type CodeGenStatus =
  | "idle"
  | "connecting"
  | "parsing_plan"
  | "generating_manifest"
  | "generating_skeletons"
  | "generating_file"
  | "validating"
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

  const wsRef = useRef<WebSocket | null>(null);

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
    setConnectionState("connecting");

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

    switch (type) {
      case "codegen.status": {
        const status = data.status as string;
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
        break;
      }

      case "codegen.skeletons":
        break;

      case "codegen.file_start": {
        const path = data.path as string;
        const index = data.index as number;
        const total = data.total as number;
        setCodeGenStatus("generating_file");
        setProgress({
          currentFileIndex: index,
          totalFiles: total,
          currentFilePath: path,
        });
        break;
      }

      case "codegen.file_complete": {
        const file: GeneratedFile = {
          path: data.path as string,
          content: data.content as string,
          language: data.language as string,
        };
        setFiles((prev) => [...prev, file]);
        setProgress((prev) => ({
          ...prev,
          currentFileIndex: (data.index as number ?? prev.currentFileIndex) + 1,
          currentFilePath: null,
        }));
        break;
      }

      case "codegen.complete": {
        setCodeGenStatus("complete");
        const issues = data.issues as ValidationIssue[] | undefined;
        if (issues && issues.length > 0) {
          setValidationIssues(issues);
        }
        break;
      }

      case "codegen.error": {
        setError(data.message as string);
        setCodeGenStatus("error");
        break;
      }

      case "task.error": {
        setError(data.error as string);
        setCodeGenStatus("error");
        break;
      }
    }
  }, []);

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
  }, [disconnect]);

  return {
    connectionState,
    codeGenStatus,
    manifest,
    files,
    progress,
    validationIssues,
    error,
    startCodeGen,
    disconnect,
    reset,
  };
}
