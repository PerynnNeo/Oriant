"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SpeechError =
  | "not_supported"
  | "not_allowed"
  | "network"
  | "no_speech"
  | "aborted"
  | "audio_capture"
  | "unknown";

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
}

interface BrowserSpeechRecognitionResult {
  isFinal: boolean;
  0: BrowserSpeechRecognitionAlternative;
  length: number;
}

interface BrowserSpeechRecognitionResultList {
  [index: number]: BrowserSpeechRecognitionResult;
  length: number;
}

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: BrowserSpeechRecognitionResultList;
}

interface BrowserSpeechRecognitionErrorEvent {
  error: string;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onstart: (() => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface BrowserSpeechRecognitionConstructor {
  new (): BrowserSpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitAudioContext?: typeof AudioContext;
  }
}

function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const sampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  text(0, "RIFF"); view.setUint32(4, 36 + sampleCount * 2, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, sampleCount * 2, true);
  let offset = 44;
  for (const chunk of chunks) {
    for (const sample of chunk) {
      const value = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function errorMessage(error: SpeechError): string {
  switch (error) {
    case "not_supported":
      return "Voice capture is not supported in this browser.";
    case "not_allowed":
      return "Microphone access was blocked. Please allow it and try again.";
    case "network":
      return "Speech recognition hit a network issue. Please try again.";
    case "no_speech":
      return "No speech was detected. Please try again.";
    case "audio_capture":
      return "We couldn't access your microphone audio.";
    case "aborted":
      return "Voice capture was stopped before a transcript was ready.";
    default:
      return "Voice capture failed. Please try again.";
  }
}

function normaliseError(error?: string): SpeechError {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "not_allowed";
    case "network":
      return "network";
    case "no-speech":
      return "no_speech";
    case "audio-capture":
      return "audio_capture";
    case "aborted":
      return "aborted";
    default:
      return "unknown";
  }
}

function normaliseWords(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function isLikelyPromptEcho(transcript: string, prompt: string): boolean {
  const words = normaliseWords(transcript);
  const promptWords = normaliseWords(prompt);
  if (!words.length || !promptWords.length) return false;
  const promptSet = new Set(promptWords);
  const overlap = words.filter((word) => promptSet.has(word)).length / words.length;
  return words.length <= promptWords.length + 8 && overlap >= 0.72;
}

export function useBrowserSpeechCapture({
  lang = "en-US",
  onFinalTranscript,
  promptText = "",
}: {
  lang?: string;
  onFinalTranscript?: (transcript: string) => void | Promise<void>;
  promptText?: string;
}) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const pcmSampleRateRef = useRef(48_000);
  const stopPcmRef = useRef<(() => void) | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const deliveredRef = useRef<string | null>(null);
  const manualStopRef = useRef(false);
  const restartingRef = useRef(false);
  const captureActiveRef = useRef(false);
  const speechSeenRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const RecognitionCtor = useMemo<BrowserSpeechRecognitionConstructor | null>(() => {
    if (typeof window === "undefined") return null;
    return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
  }, []);

  const recordingSupported =
    typeof window !== "undefined"
    && typeof navigator !== "undefined"
    && !!navigator.mediaDevices?.getUserMedia
    && (typeof MediaRecorder !== "undefined" || !!(window.AudioContext || window.webkitAudioContext));

  const supported = RecognitionCtor !== null || recordingSupported;

  const stop = useCallback(() => {
    manualStopRef.current = true;
    restartingRef.current = false;
    captureActiveRef.current = false;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (noSpeechTimerRef.current) clearTimeout(noSpeechTimerRef.current);
    silenceTimerRef.current = null;
    noSpeechTimerRef.current = null;
    recognitionRef.current?.stop();
    stopPcmRef.current?.();
    stopPcmRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);
  stopRef.current = stop;

  const reset = useCallback(() => {
    setTranscript("");
    setFinalTranscript("");
    setInterimTranscript("");
    setError(null);
    deliveredRef.current = null;
    captureActiveRef.current = false;
    speechSeenRef.current = false;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (noSpeechTimerRef.current) clearTimeout(noSpeechTimerRef.current);
  }, []);

  const transcribeRecording = useCallback(async () => {
    // When the browser recognizer already produced usable words, do not send
    // a second copy of the recording. This is especially important on Safari,
    // where the native recognizer can succeed while MediaRecorder produces a
    // container the configured speech provider cannot decode.
    if (transcript.trim() && !/^\[(background noise|silence|music)\]$/i.test(transcript.trim())) {
      setProcessing(false);
      setListening(false);
      setError(null);
      return;
    }
    // The free browser recognizer is the primary STT path. Do not silently
    // send an empty recording to an unavailable server workload when it has
    // already failed to produce a result.
    if (RecognitionCtor) {
      setProcessing(false);
      setListening(false);
      if (!transcript.trim()) setError(errorMessage("no_speech"));
      return;
    }
    const mimeType = recorderRef.current?.mimeType || "audio/wav";
    const blob = pcmChunksRef.current.length > 0
      ? encodeWav(pcmChunksRef.current, pcmSampleRateRef.current)
      : new Blob(chunksRef.current, { type: mimeType });
    if (!blob.size) {
      setProcessing(false);
      setListening(false);
      if (!transcript.trim()) setError(errorMessage("no_speech"));
      return;
    }

    setProcessing(true);
    try {
      const form = new FormData();
      const extension = blob.type.includes("wav") ? "wav"
        : mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a"
          : mimeType.includes("ogg") ? "ogg"
            : "webm";
      form.append("audio", blob, `answer.${extension}`);
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const responseText = await res.text();
      let body: { ok: boolean; text?: string; error?: string };
      try {
        body = JSON.parse(responseText) as { ok: boolean; text?: string; error?: string };
      } catch {
        throw new Error(`Transcription service returned an invalid response (${res.status})`);
      }
      if (body.ok && typeof body.text === "string" && body.text.trim()) {
        setTranscript(body.text.trim());
        setError(null);
      } else if (!transcript.trim()) {
        setError(body.error || `Voice transcription unavailable (${res.status}). Please try again or type instead.`);
      }
    } catch (cause) {
      if (!transcript.trim()) {
        setError(cause instanceof Error && cause.message
          ? cause.message
          : "Couldn’t transcribe that recording. Please try again or type instead.");
      }
    } finally {
      setProcessing(false);
      setListening(false);
    }
  }, [RecognitionCtor, transcript]);

  const start = useCallback(() => {
    if (!RecognitionCtor && !recordingSupported) {
      setError(errorMessage("not_supported"));
      return false;
    }

    // Flip into a live state immediately so the UI can render the transcript
    // box before the browser finishes mic permission and recorder startup.
    setListening(true);
    setProcessing(false);
    setTranscript("");
    setError(null);
    deliveredRef.current = null;
    captureActiveRef.current = true;
    speechSeenRef.current = false;
    noSpeechTimerRef.current = setTimeout(() => {
      if (!speechSeenRef.current && captureActiveRef.current) {
        setError(errorMessage("no_speech"));
        stop();
      }
    }, 10_000);

    const begin = async () => {
      try {
        recognitionRef.current?.abort();
        streamRef.current?.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        streamRef.current = null;
        chunksRef.current = [];
        pcmChunksRef.current = [];
        stopPcmRef.current = null;
        manualStopRef.current = false;
        setProcessing(false);

        let recognition: BrowserSpeechRecognition | null = null;
        if (RecognitionCtor) {
          recognition = new RecognitionCtor();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = lang;
          recognition.maxAlternatives = 1;
          recognition.onstart = () => {
            setListening(true);
            setError(null);
          };

          recognition.onresult = (event) => {
            let finalText = "";
            let interimText = "";
            for (let i = 0; i < event.results.length; i += 1) {
              const text = event.results[i][0]?.transcript ?? "";
              if (event.results[i].isFinal) finalText += text;
              else interimText += text;
            }
            const cleanFinal = finalText.trim();
            const cleanInterim = interimText.trim();
            if (isLikelyPromptEcho([cleanFinal, cleanInterim].filter(Boolean).join(" "), promptText)) {
              setFinalTranscript("");
              setInterimTranscript("");
              setTranscript("");
              return;
            }
            setFinalTranscript(cleanFinal);
            setInterimTranscript(cleanInterim);
            setTranscript([cleanFinal, cleanInterim].filter(Boolean).join(" "));
            if (cleanFinal || cleanInterim) {
              setError(null);
              speechSeenRef.current = true;
              if (noSpeechTimerRef.current) clearTimeout(noSpeechTimerRef.current);
              if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = setTimeout(() => {
                if (captureActiveRef.current) stop();
              }, 10_000);
            }
          };

          recognition.onerror = (event) => {
            const normalised = normaliseError(event.error);
            if (manualStopRef.current && normalised === "aborted") {
              setError(null);
              return;
            }
            if (!recorderRef.current || recorderRef.current.state === "inactive") {
              setListening(false);
            }
            setError(errorMessage(normalised));
          };

          recognition.onend = () => {
            const recorderActive = recorderRef.current && recorderRef.current.state !== "inactive";
            if (!manualStopRef.current && captureActiveRef.current && !restartingRef.current) {
              restartingRef.current = true;
              window.setTimeout(() => {
                restartingRef.current = false;
                if (!manualStopRef.current && recognition && recognitionRef.current === recognition) {
                  try {
                    recognition.start();
                  } catch {
                    // The browser may already be restarting recognition.
                  }
                }
              }, 120);
              return;
            }
            if (!processing && !captureActiveRef.current && !recorderActive) {
              manualStopRef.current = false;
              setListening(false);
            }
          };
        }

        // Start speech recognition directly from the button event. Waiting for
        // getUserMedia() first can lose the browser's user-gesture permission
        // and result in a recorder that captures audio without live words.
        recognitionRef.current = recognition;
        recognition?.start();

        if (recordingSupported) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          streamRef.current = stream;
          const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
          if (AudioContextCtor) {
            // Capture raw PCM and send a finalized WAV. This avoids Safari's
            // fragmented mp4 recordings, which ElevenLabs cannot decode.
            const context = new AudioContextCtor();
            await context.resume();
            const source = context.createMediaStreamSource(stream);
            const processor = context.createScriptProcessor(4096, 1, 1);
            const silentOutput = context.createGain();
            silentOutput.gain.value = 0;
            pcmSampleRateRef.current = context.sampleRate;
            processor.onaudioprocess = (event) => {
              if (captureActiveRef.current) {
                const samples = new Float32Array(event.inputBuffer.getChannelData(0));
                pcmChunksRef.current.push(samples);
              }
            };
            source.connect(processor);
            processor.connect(silentOutput);
            silentOutput.connect(context.destination);
            audioContextRef.current = context;
            audioProcessorRef.current = processor;
            stopPcmRef.current = () => {
              audioProcessorRef.current?.disconnect();
              audioProcessorRef.current = null;
              void audioContextRef.current?.close();
              audioContextRef.current = null;
              stream.getTracks().forEach((track) => track.stop());
              streamRef.current = null;
              void transcribeRecording();
            };
          } else if (typeof MediaRecorder !== "undefined") {
            const recorder = new MediaRecorder(stream);
            recorderRef.current = recorder;
            recorder.ondataavailable = (event) => {
              if (event.data.size > 0) chunksRef.current.push(event.data);
            };
            recorder.onerror = () => {
              captureActiveRef.current = false;
              setListening(false);
              setError(errorMessage("audio_capture"));
            };
            recorder.onstop = () => {
              stream.getTracks().forEach((track) => track.stop());
              streamRef.current = null;
              void transcribeRecording();
            };
            recorder.start(250);
          } else {
            throw new Error("No supported audio recorder is available");
          }
        }

        return true;
      } catch (cause) {
        captureActiveRef.current = false;
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (noSpeechTimerRef.current) clearTimeout(noSpeechTimerRef.current);
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        audioProcessorRef.current?.disconnect();
        audioProcessorRef.current = null;
        void audioContextRef.current?.close();
        audioContextRef.current = null;
        stopPcmRef.current = null;
        recorderRef.current = null;
        setListening(false);
        setProcessing(false);
        const name = cause instanceof DOMException ? cause.name : "";
        setError(errorMessage(name === "NotAllowedError" ? "not_allowed" : name === "NotFoundError" ? "audio_capture" : "unknown"));
        return false;
      }
    };

    void begin();
    return true;
  }, [RecognitionCtor, lang, promptText, recordingSupported, processing, transcribeRecording]);

  useEffect(() => {
    const clean = transcript.trim();
    if (!listening && !processing && clean && deliveredRef.current !== clean) {
      deliveredRef.current = clean;
      void onFinalTranscript?.(clean);
    }
  }, [listening, onFinalTranscript, processing, transcript]);

  useEffect(
    () => () => {
      manualStopRef.current = false;
      captureActiveRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (noSpeechTimerRef.current) clearTimeout(noSpeechTimerRef.current);
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore teardown stop errors
        }
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      audioProcessorRef.current?.disconnect();
      audioProcessorRef.current = null;
      void audioContextRef.current?.close();
      audioContextRef.current = null;
      stopPcmRef.current = null;
      recorderRef.current = null;
      streamRef.current = null;
    },
    [],
  );

  return {
    supported,
    liveTranscriptSupported: RecognitionCtor !== null,
    listening,
    processing,
    transcript,
    finalTranscript,
    interimTranscript,
    error,
    clearError: () => setError(null),
    start,
    stop,
    reset,
  };
}
