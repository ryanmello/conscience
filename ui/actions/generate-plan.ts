"use server";

import { createClient } from "@/lib/supabase/server";

export interface GeneratePlanResult {
  plan_id: string;
  title: string;
  document_url: string;
  content: string;
}

export async function generatePlan(prompt: string): Promise<{
  success: boolean;
  data?: GeneratePlanResult;
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
    const response = await fetch(`${apiUrl}/api/plan/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ prompt }),
    });

    if (response.status === 401) {
      return { success: false, error: "Session expired. Please sign in again." };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data: GeneratePlanResult = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error("Error generating plan:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
