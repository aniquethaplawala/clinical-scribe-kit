"use client";

import { Info, LoaderCircle, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { asAppError, ClientError, postJson } from "@/lib/client";
import type { AppError } from "@/lib/types";

export type StreamSummary = { startedAt: string; durationMs: number; finalSegments: number; closeCode: number | null };
type Phase = "idle" | "connecting" | "listening" | "finishing";

type ServerMessage =
  | { type: "status"; status: string }
  | { type: "transcript"; text: string; is_final?: boolean; isFinal?: boolean }
  | { type: "error"; code?: string; error?: string; retryable?: boolean };

const CLOSE_REASONS: Record<number, string> = {
  4000: "The transcription service failed. Try again in a moment.",
  4001: "The streaming token or query parameters were rejected. Check your Sully keys.",
  4002: "Your Sully account is out of credits.",
  1013: "Sully is temporarily unavailable. Try again shortly.",
};

/** base64 for a chunk of PCM bytes (btoa needs a binary string). */
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * Live conversation with Sully streaming transcription:
 *   1. Our server creates a short-lived token (POST /v1/audio/transcriptions/stream/token).
 *   2. The browser opens wss://.../v1/audio/transcriptions/stream?account_id&api_token&sample_rate=16000&encoding=linear16.
 *   3. Wait for {"type":"status","status":"connected"} before sending audio.
 *   4. Send {"audio": "<base64 linear16>"} every 100 ms from an AudioWorklet.
 *   5. On stop: stop the mic, let final results drain, then close with code 1000.
 */
export function LiveCapture({
  demo,
  onTranscript,
  onCall,
}: {
  demo: boolean;
  onTranscript: (transcript: string, summary: StreamSummary) => void;
  onCall: (callId: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [finals, setFinals] = useState<string[]>([]);
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<AppError | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; stream: MediaStream; node: AudioWorkletNode } | null>(null);
  const finalsRef = useRef<string[]>([]);
  const startedRef = useRef<{ at: string; ms: number } | null>(null);
  const drainTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stoppingRef = useRef(false);

  useEffect(() => {
    if (phase !== "listening") return;
    const t = setInterval(() => setElapsed(Date.now() - (startedRef.current?.ms ?? Date.now())), 500);
    return () => clearInterval(t);
  }, [phase]);

  // Release the mic and socket if the user navigates away mid-recording.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- teardown only touches refs
  useEffect(() => () => teardown(), []);

  function stopAudio() {
    const audio = audioRef.current;
    audioRef.current = null;
    if (!audio) return;
    audio.node.port.onmessage = null;
    audio.node.disconnect();
    audio.stream.getTracks().forEach((t) => t.stop());
    void audio.ctx.close();
  }

  function teardown() {
    clearTimeout(drainTimer.current);
    stopAudio();
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket && socket.readyState <= WebSocket.OPEN) socket.close(1000, "Recording stopped");
  }

  async function startMic(socket: WebSocket) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const ctx = new AudioContext();
    await ctx.audioWorklet.addModule("/pcm-worklet.js");
    const source = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, "pcm-worklet");
    node.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ audio: toBase64(event.data) }));
    };
    source.connect(node);
    audioRef.current = { ctx, stream, node };
  }

  async function start() {
    setError(null);
    setFinals([]);
    setPartial("");
    finalsRef.current = [];
    stoppingRef.current = false;
    setPhase("connecting");

    let url: string;
    try {
      const token = await postJson<{ url: string; callId: string }>("/api/stream-token", {});
      onCall(token.callId);
      url = token.url;
    } catch (err) {
      if (err instanceof ClientError && typeof err.body.callId === "string") onCall(err.body.callId);
      setError(asAppError(err));
      setPhase("idle");
      return;
    }

    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onmessage = async (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (stoppingRef.current) scheduleClose(); // keep draining while results arrive

      if (message.type === "status" && message.status === "connected") {
        // Audio sent before this message is dropped by the server, so start the mic now.
        try {
          await startMic(socket);
          startedRef.current = { at: new Date().toISOString(), ms: Date.now() };
          setElapsed(0);
          setPhase("listening");
        } catch {
          setError({ title: "Microphone unavailable", message: "Allow microphone access in your browser, then try again." });
          teardown();
          setPhase("idle");
        }
      } else if (message.type === "transcript") {
        const isFinal = message.is_final ?? message.isFinal ?? false; // is_final is canonical
        if (isFinal) {
          if (message.text.trim()) {
            finalsRef.current = [...finalsRef.current, message.text.trim()];
            setFinals(finalsRef.current);
          }
          setPartial("");
        } else {
          setPartial(message.text);
        }
      } else if (message.type === "error") {
        setError({ title: "Streaming error", message: message.error ?? "Sully reported an error.", code: message.code });
      }
    };

    socket.onerror = () => {
      setError({ title: "Connection problem", message: "The streaming connection failed. Check your network and try again." });
    };

    socket.onclose = (event) => {
      stopAudio();
      clearTimeout(drainTimer.current);
      if (CLOSE_REASONS[event.code]) {
        setError({ title: "Streaming stopped", message: CLOSE_REASONS[event.code], code: String(event.code) });
      }
      const started = startedRef.current;
      if (started && finalsRef.current.length) {
        onTranscript(finalsRef.current.join(" "), {
          startedAt: started.at,
          durationMs: Date.now() - started.ms,
          finalSegments: finalsRef.current.length,
          closeCode: event.code,
        });
      }
      startedRef.current = null;
      socketRef.current = null;
      setPartial("");
      setPhase("idle");
    };
  }

  /** Close two seconds after the last server message, so final results can drain. */
  function scheduleClose() {
    clearTimeout(drainTimer.current);
    drainTimer.current = setTimeout(() => {
      socketRef.current?.close(1000, "Recording stopped");
    }, 2000);
  }

  function stop() {
    stoppingRef.current = true;
    setPhase("finishing");
    const audio = audioRef.current;
    if (audio) audio.node.port.postMessage("flush");
    setTimeout(stopAudio, 150); // let the last chunk go out
    scheduleClose();
  }

  if (demo) {
    return (
      <div role="note" className="flex items-start gap-3 rounded-[16px] bg-cream p-5">
        <Info aria-hidden className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.5} />
        <div className="flex flex-col gap-1">
          <p className="font-medium">Live transcription needs your Sully keys</p>
          <p className="text-[14px] text-graphite">
            Demo mode cannot stream audio. Add SULLY_ACCOUNT_ID and SULLY_API_KEY to .env.local and restart the dev server. Until then, try Upload audio
            or Paste transcript with a sample encounter.
          </p>
        </div>
      </div>
    );
  }

  const seconds = Math.floor(elapsed / 1000);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        {phase === "idle" ? (
          <Button onClick={start}>
            <Mic aria-hidden className="h-4 w-4" strokeWidth={1.5} />
            Start recording
          </Button>
        ) : (
          <Button onClick={stop} disabled={phase !== "listening"} variant="secondary">
            {phase === "listening" ? (
              <Square aria-hidden className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            )}
            {phase === "connecting" ? "Connecting..." : phase === "finishing" ? "Finishing up..." : "Stop recording"}
          </Button>
        )}
        {phase === "listening" ? (
          <span role="status" className="flex items-center gap-2 text-[14px] text-graphite">
            <span aria-hidden className="h-2.5 w-2.5 animate-pulse rounded-full bg-sky" />
            Listening {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </span>
        ) : null}
      </div>
      <div
        aria-live="polite"
        aria-label="Live transcript"
        className="min-h-[120px] rounded-[16px] bg-cream p-5 text-[16px] leading-relaxed"
      >
        {finals.length === 0 && !partial ? (
          <span className="text-graphite">
            {phase === "idle" ? "The live transcript appears here." : "Waiting for speech..."}
          </span>
        ) : (
          <>
            <span>{finals.join(" ")}</span> {partial ? <span className="text-graphite italic">{partial}</span> : null}
          </>
        )}
      </div>
      {error ? <ErrorNotice error={error} /> : null}
    </div>
  );
}
