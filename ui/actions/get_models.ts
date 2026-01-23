"use server"

import { createClient } from "@/lib/supabase/server";

export async function getModels() {
    const apiUrl = process.env.BACKEND_API_URL;

    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
        return { success: false, error: "Not authenticated" };
    }

    try {
        const response = await fetch(`${apiUrl}/api/models`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.access_token}`,
            },
        });

        if (response.status === 401) {
            return { success: false, error: "Session expired. Please sign in again." };
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error("Error calling API:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}
