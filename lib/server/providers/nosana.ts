/**
 * Nosana Whisper adapter for recorded voice answers.
 *
 * The workload must expose an OpenAI-compatible
 * `/v1/audio/transcriptions` endpoint. Nosana is the only server-side STT
 * provider used here; typed input remains available when the workload is down.
 */
import { nosanaLive, providerEnv } from "./env";

export interface TranscribeResult {
  ok: boolean;
  mode: "live" | "fixture";
  text?: string;
  error?: string;
}

export async function transcribe(audio: Blob): Promise<TranscribeResult> {
  if (!nosanaLive()) {
    return { ok: false, mode: "fixture", error: "Nosana Whisper is not configured" };
  }

  const env = providerEnv().nosana;
  const base = env.whisperUrl!.replace(/\/$/, "");
  const endpoints = [`${base}/v1/audio/transcriptions`, base];
  let lastError = "Nosana Whisper workload is unavailable";

  for (const url of endpoints) {
    try {
      const form = new FormData();
      form.append("file", audio, "answer.wav");
      form.append("model", "whisper-1");
      const response = await fetch(url, {
        method: "POST",
        headers: env.key ? { Authorization: `Bearer ${env.key}` } : undefined,
        body: form,
        signal: AbortSignal.timeout(120_000),
      });
      const contentType = response.headers.get("content-type") ?? "";
      const server = response.headers.get("server") ?? "";
      const detail = await response.text();

      if (!response.ok) {
        console.error(`[voice] Nosana Whisper returned ${response.status}`, { url, server, contentType, detail: detail.slice(0, 300) });
        lastError = response.status === 503
          ? "Nosana Whisper workload is starting or unavailable. Please try again shortly."
          : `Nosana Whisper returned ${response.status}`;
        continue;
      }
      if (contentType.includes("text/html") || /tornado|jupyter/i.test(server)) {
        lastError = "The Nosana URL serves a web UI, not a Whisper transcription API.";
        continue;
      }

      const body = JSON.parse(detail) as { text?: string; transcription?: string };
      const text = (body.text ?? body.transcription ?? "").trim();
      if (text && !/^\[(background noise|silence|music)\]$/i.test(text)) {
        return { ok: true, mode: "live", text };
      }
      lastError = "Nosana Whisper returned no speech in the recording.";
    } catch (error) {
      console.error("[voice] Nosana Whisper request failed", error);
      lastError = "Nosana Whisper workload is unreachable.";
    }
  }

  return { ok: false, mode: "live", error: lastError };
}
