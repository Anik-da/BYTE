export type GroqModel = 'groq/compound' | 'groq/compound-mini' | 'minimaxai/minimax-m2.7';

export async function askGroq(prompt: string, model: GroqModel): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Groq API key not configured. Please ensure VITE_GROQ_API_KEY is defined in your .env file.");
  }

  // Model mapping to native Groq/OpenRouter target
  let targetModel = model as string;
  let endpoint = "https://api.groq.com/openai/v1/chat/completions";

  if (apiKey.startsWith("sk-or-")) {
    endpoint = "https://openrouter.ai/api/v1/chat/completions";
  } else {
    // Map custom router model strings to native Groq endpoints if using Groq API key directly
    if (model === 'groq/compound') targetModel = 'llama-3.3-70b-versatile';
    else if (model === 'groq/compound-mini') targetModel = 'llama3-8b-8192';
    else if (model === 'minimaxai/minimax-m2.7') targetModel = 'llama-3.3-70b-versatile';
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: targetModel,
      messages: [
        {
          role: "system",
          content: "You are BYTE (Beyond Your Tactical Envelope), an advanced natural-language tactical intelligence system designed to assist the user. Keep your responses concise, helpful, and matching a futuristic, supportive tactical AI persona."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 512
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "No response received.";
}
