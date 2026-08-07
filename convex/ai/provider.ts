/**
 * LLM provider helpers for "use node" AI actions.
 * Mock-first: without OPENAI_API_KEY or AI_GATEWAY_API_KEY, callers use deterministic mocks.
 */

export type LlmProvider = "mock" | "openai" | "gateway";

export function resolveLlmProvider(): {
  provider: LlmProvider;
  apiKey: string | null;
  baseUrl: string | null;
  model: string;
} {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_AI_GATEWAY_API_KEY;
  if (gatewayKey) {
    return {
      provider: "gateway",
      apiKey: gatewayKey,
      baseUrl:
        process.env.AI_GATEWAY_BASE_URL ??
        "https://ai-gateway.vercel.sh/v1",
      model: process.env.AI_MODEL ?? "openai/gpt-4o-mini",
    };
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      baseUrl: "https://api.openai.com/v1",
      model: process.env.AI_MODEL ?? "gpt-4o-mini",
    };
  }

  return {
    provider: "mock",
    apiKey: null,
    baseUrl: null,
    model: "mock",
  };
}

export async function chatCompletion(args: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<{ content: string; provider: LlmProvider } | null> {
  const resolved = resolveLlmProvider();
  if (!resolved.apiKey || !resolved.baseUrl) {
    return null;
  }

  try {
    const res = await fetch(`${resolved.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resolved.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: resolved.model,
        temperature: args.temperature ?? 0.4,
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.user },
        ],
      }),
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    return { content, provider: resolved.provider };
  } catch {
    return null;
  }
}

/** Shared keyword guard used by guardrails + course assist. */
export function keywordFilter(
  studentPrompt: string,
  parentGuardrailContext: string,
): { filteredTopics: string[]; blocked: boolean } {
  const prompt = studentPrompt.toLowerCase();
  const blockedKeywords = [
    "weapon",
    "violence",
    "gambling",
    "dating",
    "bypass",
    "cheat on test",
  ];

  const blockMatch = /block:\s*([^\n]+)/i.exec(parentGuardrailContext);
  const parentBlocks =
    blockMatch?.[1]
      ?.split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean) ?? [];

  const allBlocked = [...blockedKeywords, ...parentBlocks];
  const filteredTopics = allBlocked.filter((term) => prompt.includes(term));
  return { filteredTopics, blocked: filteredTopics.length > 0 };
}
