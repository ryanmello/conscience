"use server";

export async function processInput(input: string) {
  const apiUrl = process.env.BACKEND_API_URL;
  
  if (!apiUrl) {
    return { success: false, error: "BACKEND_API_URL is not configured" };
  }

  try {
    const response = await fetch(`${apiUrl}/api/process_input`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input }),
    });

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
