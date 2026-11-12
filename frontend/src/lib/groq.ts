export type GroqModel =
  | 'openai/gpt-oss-120b'
  | 'openai/gpt-oss-20b'
  | 'qwen/qwen3.8-27b'
  | 'allam-2-7b'
  | (string & {});

export const DEFAULT_GROQ_MODEL: GroqModel = 'openai/gpt-oss-120b';

export const ACTIVE_GROQ_MODELS: Array<{ id: GroqModel; label: string }> = [
  { id: 'openai/gpt-oss-120b', label: 'OpenAI GPT-OSS 120B (131k Context)' },
  { id: 'openai/gpt-oss-20b', label: 'OpenAI GPT-OSS 20B (Fast - 131k Context)' },
  { id: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B (131k Context)' },
  { id: 'allam-2-7b', label: 'ALLaM 2 7B (Lightweight - 4k Context)' },
];

export const LEGACY_GROQ_ALIASES: Record<string, GroqModel> = {
  'groq/compound': 'openai/gpt-oss-120b',
  'groq/compound-mini': 'openai/gpt-oss-20b',
  'llama-3.3-70b-versatile': 'openai/gpt-oss-120b',
  'llama-3.1-8b-instant': 'openai/gpt-oss-20b',
};

export function normalizeGroqModel(model?: string): GroqModel {
  if (!model) return DEFAULT_GROQ_MODEL;
  return LEGACY_GROQ_ALIASES[model] || model;
}

export async function askGroq(prompt: string, model: GroqModel): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Groq API key not configured. Please ensure VITE_GROQ_API_KEY is defined in your .env file.");
  }

  const targetModel = normalizeGroqModel(model as string);
  let endpoint = "https://api.groq.com/openai/v1/chat/completions";

  if (apiKey.startsWith("sk-or-")) {
    endpoint = "https://openrouter.ai/api/v1/chat/completions";
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
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "No response received.";
}
