import { NextResponse } from "next/server";

/** ElevenLabs remains the TTS provider; STT is handled by Nosana Whisper. */
export async function POST() {
  return NextResponse.json(
    { ok: false, error: "Realtime STT is configured through Nosana Whisper." },
    { status: 410 },
  );
}
