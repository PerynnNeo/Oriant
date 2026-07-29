/**
 * lib/server/b/openai.ts — OpenAI structured-output adapter for the Planner
 * and Executor Agents. Mirrors the existing aiand/doubleword provider
 * pattern (lib/server/providers/aiand.ts): the caller always gets usable
 * data plus an honest "live" | "fixture" mode flag, so a demo never hard
 * -fails just because OPENAI_API_KEY is unset.
 */

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface OpenAiJsonResult<T> {
  mode: "live" | "fixture";
  data: T;
  error?: string;
  /** Real usage from the API response. null in fixture mode — no call was made. */
  usage: TokenUsage | null;
}

export function openaiLive(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/** Ask OpenAI for a schema-constrained JSON object via structured outputs. */
export async function openaiJson<T>(opts: {
  operation: string;
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  fixture: T;
  model?: string;
}): Promise<OpenAiJsonResult<T>> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { mode: "fixture", data: opts.fixture, usage: null };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: opts.model || process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: opts.schemaName, strict: true, schema: opts.schema },
        },
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty completion");
    const usage: TokenUsage | null = body.usage
      ? {
          promptTokens: body.usage.prompt_tokens ?? 0,
          completionTokens: body.usage.completion_tokens ?? 0,
          totalTokens: body.usage.total_tokens ?? 0,
        }
      : null;
    return { mode: "live", data: JSON.parse(content) as T, usage };
  } catch (err) {
    return { mode: "fixture", data: opts.fixture, error: String(err), usage: null };
  }
}
