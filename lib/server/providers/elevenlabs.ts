import { elevenLabsSttLive, providerEnv } from "./env";

export async function transcribeWithElevenLabs(audio: Blob): Promise<{ ok: boolean; text?: string; error?: string }> {
  if (!elevenLabsSttLive()) return { ok: false, error: "ElevenLabs speech-to-text is not configured" };
  const env = providerEnv().elevenlabs;
  const form = new FormData();
  // Preserve the browser's actual recording container. Safari commonly sends
  // mp4/m4a while Chromium commonly sends webm; labelling both as webm makes
  // ElevenLabs reject otherwise valid recordings.
  const mimeType = audio.type.toLowerCase();
  const extension = mimeType.includes("mp4") ? "mp4"
    : mimeType.includes("m4a") ? "m4a"
      : mimeType.includes("ogg") ? "ogg"
        : mimeType.includes("wav") ? "wav"
          : "webm";
  form.append("file", audio, `answer.${extension}`);
  form.append("model_id", "scribe_v2");
  try {
    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": env.key! },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`[voice] ElevenLabs speech-to-text returned ${response.status}: ${detail.slice(0, 300)}`);
      return { ok: false, error: `ElevenLabs speech-to-text failed (${response.status})` };
    }
    const body = await response.json() as { text?: string };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text || /^\[(background noise|silence|music)\]$/i.test(text)) {
      return { ok: false, error: "No clear speech was detected. Please answer after Oriant finishes the question." };
    }
    return { ok: true, text };
  } catch (error) {
    console.error("[voice] ElevenLabs speech-to-text failed", error);
    return { ok: false, error: "ElevenLabs speech-to-text unreachable" };
  }
}
