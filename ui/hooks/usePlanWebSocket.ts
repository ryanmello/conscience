"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Document state from server
export interface PlanDocument {
  title: string;
  content: string;
  url?: string;
  version: number;
}

// Question from server
export interface Question {
  id: string;
  text: string;
}

// Chat message types - only user messages and grouped questions
export type ChatMessage =
  | { type: "user_prompt"; content: string }
  | { type: "user_answer"; content: string }
  | { type: "questions"; questions: Question[] };

// Thinking status (shown temporarily, not persisted in messages)
export interface ThinkingStatus {
  status: string;
  message: string;
}

// Connection state
export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

// WebSocket message types from server
interface DocumentUpdateMessage {
  type: "document.update";
  document: PlanDocument;
}

interface QuestionMessage {
  type: "question";
  question: Question;
}

interface StatusMessage {
  type: "status";
  status: string;
  message: string;
}

interface ReadyForApprovalMessage {
  type: "ready_for_approval";
  message: string;
}

interface ErrorMessage {
  type: "task.error";
  error: string;
  context?: string;
}

type ServerMessage =
  | DocumentUpdateMessage
  | QuestionMessage
  | StatusMessage
  | ReadyForApprovalMessage
  | ErrorMessage;

export function usePlanWebSocket() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [document, setDocument] = useState<PlanDocument | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
  const [thinkingStatus, setThinkingStatus] = useState<ThinkingStatus | null>(null);
  const [isReadyForApproval, setIsReadyForApproval] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingQuestionsRef = useRef<Question[]>([]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Connect to WebSocket and start plan generation
  const startPlan = useCallback(async (prompt: string) => {
    // Reset state
    setSessionId(null);
    setDocument(null);
    setMessages([{ type: "user_prompt", content: prompt }]);
    setCurrentQuestions([]);
    setThinkingStatus(null);
    setIsReadyForApproval(false);
    setError(null);
    setConnectionState("connecting");
    pendingQuestionsRef.current = [];

    // Get auth token
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      setError("Not authenticated");
      setConnectionState("error");
      return;
    }

    // Get WebSocket URL from environment
    const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL || "ws://localhost:8000";
    const fullUrl = `${wsUrl}/api/plan/ws/generate?token=${session.access_token}`;

    try {
      const ws = new WebSocket(fullUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState("connected");
        // Send the initial prompt
        ws.send(JSON.stringify({
          type: "start_plan",
          prompt: prompt
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data: ServerMessage = JSON.parse(event.data);
          handleMessage(data);
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      ws.onerror = (event) => {
        console.error("WebSocket error:", event);
        setError("Connection error");
        setConnectionState("error");
      };

      ws.onclose = () => {
        setConnectionState("disconnected");
        wsRef.current = null;
      };
    } catch (e) {
      console.error("Failed to connect:", e);
      setError("Failed to connect");
      setConnectionState("error");
    }
  }, []);

  // Handle incoming messages
  const handleMessage = useCallback((data: ServerMessage & { session_id?: string }) => {
    // Extract session_id from any message (server adds it to all messages)
    if (data.session_id) {
      setSessionId(data.session_id);
    }

    switch (data.type) {
      case "document.update":
        setDocument(data.document);
        break;

      case "question": {
        // Clear thinking status when questions arrive
        setThinkingStatus(null);
        
        // Accumulate questions (avoid duplicates)
        const exists = pendingQuestionsRef.current.some(
          q => q.id === data.question.id || q.text === data.question.text
        );
        if (!exists) {
          pendingQuestionsRef.current.push(data.question);
        }
        
        // Update current questions
        setCurrentQuestions([...pendingQuestionsRef.current]);
        break;
      }

      case "status":
        // Update thinking status (temporary, not added to messages)
        setThinkingStatus({ status: data.status, message: data.message });
        break;

      case "ready_for_approval":
        setThinkingStatus(null);
        setIsReadyForApproval(true);
        setCurrentQuestions([]);
        break;

      case "task.error":
        setThinkingStatus(null);
        setError(data.error);
        break;
    }
  }, []);

  // Send user response to questions
  const sendResponse = useCallback((response: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("Not connected");
      return;
    }

    if (currentQuestions.length === 0) {
      return;
    }

    // Add the questions and answer to messages as a group
    setMessages(prev => [
      ...prev,
      { type: "questions", questions: [...currentQuestions] },
      { type: "user_answer", content: response }
    ]);

    // Clear current questions while waiting for next batch
    setCurrentQuestions([]);
    pendingQuestionsRef.current = [];

    // Send to server
    wsRef.current.send(JSON.stringify({
      type: "user_response",
      response: response
    }));
  }, [currentQuestions]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionState("disconnected");
  }, []);

  // Reset everything
  const reset = useCallback(() => {
    disconnect();
    setSessionId(null);
    setDocument(null);
    setMessages([]);
    setCurrentQuestions([]);
    setThinkingStatus(null);
    setIsReadyForApproval(false);
    setError(null);
    pendingQuestionsRef.current = [];
  }, [disconnect]);

  return {
    // State
    connectionState,
    sessionId,
    document,
    messages,
    currentQuestions,
    thinkingStatus,
    isReadyForApproval,
    error,
    // Actions
    startPlan,
    sendResponse,
    disconnect,
    reset,
  };
}
