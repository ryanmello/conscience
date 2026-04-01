"use server";

import { createClient } from "@/lib/supabase/server";

interface FileInfo {
  id: string;
  path: string;
  content: string;
  language: string;
  version: number;
  status: string;
  created_at: string;
  updated_at: string;
}

async function getAuthHeaders() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

function getApiUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  return apiUrl;
}

export async function getAgentFiles(agentId: string): Promise<{
  success: boolean;
  files?: FileInfo[];
  error?: string;
}> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${getApiUrl()}/api/agent/${agentId}/files`, {
      method: "GET",
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return { success: true, files: data.files };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function saveAgentFile(
  agentId: string,
  filePath: string,
  content: string,
): Promise<{ success: boolean; file?: FileInfo; error?: string }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(
      `${getApiUrl()}/api/agent/${agentId}/files/${encodeURIComponent(filePath)}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({ content }),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    const file = await res.json();
    return { success: true, file };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
