"use server";

import { createClient } from "@/lib/supabase/server";

export interface PlanInfo {
  id: string;
  title: string;
  content: string;
  document_url: string;
}

export interface AgentWithPlan {
  id: string;
  user_id: string;
  plan_id: string;
  name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  plan: PlanInfo;
}

export type AgentErrorCode = "NOT_FOUND" | "UNAUTHORIZED" | "UNKNOWN";

export async function getAgent(agentId: string): Promise<{
  success: boolean;
  data?: AgentWithPlan;
  error?: string;
  errorCode?: AgentErrorCode;
}> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    return { success: false, error: "NEXT_PUBLIC_API_URL is not configured", errorCode: "UNKNOWN" };
  }

  const supabase = await createClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return { success: false, error: "Not authenticated", errorCode: "UNAUTHORIZED" };
  }

  try {
    const response = await fetch(`${apiUrl}/api/agent/${agentId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (response.status === 401) {
      return { success: false, error: "Session expired. Please sign in again.", errorCode: "UNAUTHORIZED" };
    }

    if (response.status === 404) {
      return { success: false, error: "Agent not found", errorCode: "NOT_FOUND" };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data: AgentWithPlan = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error("Error fetching agent:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      errorCode: "UNKNOWN",
    };
  }
}
