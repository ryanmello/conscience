"use server";

import { createClient } from "@/lib/supabase/server";

export interface ApproveDocumentRequest {
  plan_id: string;
  title: string;
  content: string;
  version: number;
}

export interface ApprovePlanResult {
  success: boolean;
  message: string;
  document_url?: string;
}

export async function approvePlan(
  document: ApproveDocumentRequest
): Promise<{
  success: boolean;
  data?: ApprovePlanResult;
  error?: string;
}> {
  const apiUrl = process.env.BACKEND_API_URL;

  if (!apiUrl) {
    return { success: false, error: "BACKEND_API_URL is not configured" };
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
    const response = await fetch(`${apiUrl}/api/plans/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(document),
    });

    if (response.status === 401) {
      return { success: false, error: "Session expired. Please sign in again." };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data: ApprovePlanResult = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error("Error approving plan:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
