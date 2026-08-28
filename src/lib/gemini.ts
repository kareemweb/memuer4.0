export async function askAI(prompt: string, history?: string): Promise<string> {
  // First, attempt to contact our server proxy to keep API keys hidden (if server-side environment is active)
  try {
    const rawResponse = await fetch("/api/ask-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt, history })
    });

    if (rawResponse.ok) {
      const data = await rawResponse.json();
      if (data && data.response) {
        return data.response;
      }
    }

    // Capture non-200 responses to fall back (e.g., 404 when hosted as static SPA site)
    console.warn(`Server proxy returned non-OK status: ${rawResponse.status}. Attempting client-side neural fallback...`);
  } catch (err) {
    console.warn("Server proxy endpoint not reachable. Attempting client-side neural fallback...", err);
  }

  // Dual-mode Fallback: Browser-direct execution
  // This ensures the AI continues to function flawlessly even if the application is compiled/deployed
  // as a static SPA or static web app without an active Node.js server container.
  try {
    const env = (import.meta as any).env || {};
    // Extract VITE_ prefixed variables first to support static bundles
    let apiKey = env.VITE_GROQ_API_KEY || env.GROQ_API_KEY || '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';

    if (!apiKey) {
      // Direct LocalStorage Override for static hosting installations without server companion
      try {
         apiKey = localStorage.getItem('VITE_GROQ_API_KEY') || localStorage.getItem('GROQ_API_KEY') || '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';
      } catch (_) {}
    }

    if (apiKey) {
      apiKey = apiKey.replace(/^["']|["']$/g, '');
    }

    if (!apiKey) {
      return `⚠️ [Neural Key Link Missing]
Memuer AI is running as a client-side static application because the backend server proxy is unreachable (404).

To resolve this and activate your private AI:
1. Set the environment variable 'VITE_GROQ_API_KEY' in your web hosting dashboard and trigger a rebuild.
2. Or, for a quick secure local session, run this command in your browser's Developer Console and reload:
   localStorage.setItem('VITE_GROQ_API_KEY', 'YOUR_GROQ_API_KEY_HERE')`;
    }

    const systemInstruction = `You are Memuer AI, a secure and private AI companion embedded within Memuer (an E2EE end-to-end encrypted messaging application) powered by Groq. Maintain high confidentiality. Since you are talking in a secure, encrypted chat room, respect the privacy and do not leak user keys. Be helpful, concise, and professional.`;

    const messages = [
      { role: "system", content: systemInstruction }
    ];

    if (history) {
      messages.push({ role: "user", content: `Chat History:\n${history}\n\nUser: ${prompt}` });
    } else {
      messages.push({ role: "user", content: prompt });
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        temperature: 0.7
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq API returned status ${res.status}: ${errText}`);
    }

    const data = await res.json() as any;
    const content = data?.choices?.[0]?.message?.content;
    return content || "No response received from Groq API.";
  } catch (fallbackError: any) {
    console.error("Browser-side direct Groq call failed:", fallbackError);
    return `Error: Could not secure responses from Groq server proxy or client fallback. (${fallbackError?.message || fallbackError})`;
  }
}
