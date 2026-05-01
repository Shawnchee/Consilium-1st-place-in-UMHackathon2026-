"use client";

/**
 * useCaptureStream — POSTs to /api/consult/capture/stream and parses the
 * SSE event stream into reactive state. Used by both the showcase
 * dashboard and the live /consult page.
 *
 * Returns the lane state (per-agent timing + meta), the orchestrator
 * range, the Tavily query feed, the terminal SessionCaptureResult, and
 * convenience flags. The caller drives a run by calling start(input) and
 * can cancel via abort().
 */

import { useCallback, useMemo, useRef, useState } from "react";
import type { SessionCaptureResult, SubAgentMeta } from "@/lib/agents/sub-agents/types";
import {
  initialLanes,
  type AgentLanes,
  type OrchestratorRange,
  type PipelineEvent,
} from "./types";

export interface CaptureStreamInput {
  patientId: string;
  notes: string;
  transcript?: string;
  imageUrls?: string[];
  diagnosisHint?: string;
}

export interface CaptureStreamState {
  /** True between start() and the terminal session_completed/error event. */
  running: boolean;
  /** Per-sub-agent lane timing + meta, keyed by agent name. */
  lanes: AgentLanes;
  /** Orchestrator start/end timestamps for the timeline bar. */
  orchestratorRange: OrchestratorRange;
  /** Orchestrator (Sonnet) meta after it completes — usage, latency. */
  orchestratorMeta: SubAgentMeta | null;
  /** Tavily call events for the live feed. */
  tavilyEvents: Extract<PipelineEvent, { type: "tavily_called" }>[];
  /** Terminal SessionCaptureResult — null until session_completed. */
  result: SessionCaptureResult | null;
  /** First wall-clock timestamp seen (session_started.ts). */
  t0: number | null;
  /** Wall-clock timestamp of session_completed.ts. */
  tEnd: number | null;
  /** Error message if the stream failed or emitted an error event. */
  error: string | null;
}

export interface CaptureStreamControls {
  /**
   * Start a streaming capture. Resolves with the terminal SessionCaptureResult
   * when the orchestrator emits session_completed; resolves with null when
   * the stream errored, was aborted, or finished without a session_completed
   * event. Callers should prefer this return value over reading
   * `stream.result` immediately after the await — the React state update
   * from `setResult` may not have flushed yet.
   */
  start: (input: CaptureStreamInput) => Promise<SessionCaptureResult | null>;
  abort: () => void;
  reset: () => void;
}

export function useCaptureStream(): CaptureStreamState & CaptureStreamControls {
  const [running, setRunning] = useState(false);
  const [lanes, setLanes] = useState<AgentLanes>(() => initialLanes());
  const [orchestratorRange, setOrchestratorRange] = useState<OrchestratorRange>({});
  const [orchestratorMeta, setOrchestratorMeta] = useState<SubAgentMeta | null>(null);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [result, setResult] = useState<SessionCaptureResult | null>(null);
  const [t0, setT0] = useState<number | null>(null);
  const [tEnd, setTEnd] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setRunning(false);
    setLanes(initialLanes());
    setOrchestratorRange({});
    setOrchestratorMeta(null);
    setEvents([]);
    setResult(null);
    setT0(null);
    setTEnd(null);
    setError(null);
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  }, []);

  const applyEvent = useCallback((evt: PipelineEvent) => {
    setEvents((prev) => [...prev, evt]);
    switch (evt.type) {
      case "session_started":
        setT0(evt.ts);
        break;
      case "agent_started":
        setLanes((prev) => ({
          ...prev,
          [evt.agent]: { ...prev[evt.agent], startedAt: evt.ts },
        }));
        break;
      case "agent_completed":
        setLanes((prev) => ({
          ...prev,
          [evt.agent]: {
            ...prev[evt.agent],
            completedAt: evt.ts,
            meta: evt.meta,
          },
        }));
        break;
      case "agent_failed":
        setLanes((prev) => ({
          ...prev,
          [evt.agent]: {
            ...prev[evt.agent],
            completedAt: evt.ts,
            failed: evt.error,
          },
        }));
        break;
      case "orchestrator_started":
        setOrchestratorRange((p) => ({ ...p, s: evt.ts }));
        break;
      case "orchestrator_completed":
        setOrchestratorRange((p) => ({ ...p, e: evt.ts }));
        setOrchestratorMeta(evt.meta);
        break;
      case "session_completed":
        setResult(evt.result);
        setTEnd(evt.ts);
        break;
      case "error":
        setError(evt.message);
        break;
    }
  }, []);

  const start = useCallback(
    async (input: CaptureStreamInput): Promise<SessionCaptureResult | null> => {
      if (running) return null;
      reset();
      setRunning(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      // Capture the terminal result locally as well as in state. Caller
      // gets it via the return value (synchronous), state lags by one
      // React commit. Both paths see the same payload.
      let terminalResult: SessionCaptureResult | null = null;

      try {
        const res = await fetch("/api/consult/capture/stream", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const txt = await res.text().catch(() => "");
          throw new Error(`stream error ${res.status}: ${txt.slice(0, 160)}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const json = line.slice(5).trim();
              if (!json) continue;
              try {
                const evt = JSON.parse(json) as PipelineEvent;
                if (evt.type === "session_completed") {
                  terminalResult = evt.result;
                }
                applyEvent(evt);
              } catch {
                // ignore unparseable
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return null;
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setRunning(false);
        abortRef.current = null;
      }
      return terminalResult;
    },
    [running, reset, applyEvent],
  );

  const tavilyEvents = useMemo(
    () =>
      events.filter(
        (e): e is Extract<PipelineEvent, { type: "tavily_called" }> =>
          e.type === "tavily_called",
      ),
    [events],
  );

  return {
    running,
    lanes,
    orchestratorRange,
    orchestratorMeta,
    tavilyEvents,
    result,
    t0,
    tEnd,
    error,
    start,
    abort,
    reset,
  };
}
