"use server";

import { createClient } from "@/lib/supabase/server";

export interface PlanInfo {
  id: string;
  title: string;
  content: string;
  document_url: string;
}

export interface AgentSummary {
  id: string;
  user_id: string;
  plan_id: string;
  name: string | null;
  status: string;
  plan: PlanInfo;
  created_at: string;
  updated_at: string;
}

export interface AgentListResponse {
  agents: AgentSummary[];
  count: number;
}

export async function getAgents(): Promise<{
  success: boolean;
  data?: AgentListResponse;
  error?: string;
}> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    return { success: false, error: "NEXT_PUBLIC_API_URL is not configured" };
  }

  const supabase = await createClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const response = await fetch(`${apiUrl}/api/agent`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (response.status === 401) {
      return { success: false, error: "Session expired. Please sign in again." };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data: AgentListResponse = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error("Error fetching agents:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
