"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
import { C } from "@/lib/tokens";

/**
 * Reveals `text` in chunks using a fixed-rate interval so it reads like
 * a token-streamed LLM response. Used for the consult SOAP output today;
 * when Phase 5-real lands, it can switch to reading a real stream from
 * the Z.AI SSE response without changing the caller.
 *
 * `chunkSize` ≈ words per frame (default 2 — reads like fast typing).
 * `intervalMs` = frame period (default 40 ms).
 * `startDelayMs` = wait before the first frame (lets card mount animation finish).
 */
export function StreamedText({
  text,
  chunkSize = 2,
  intervalMs = 40,
  startDelayMs = 0,
  caret = true,
  style,
}: {
  text: string;
  chunkSize?: number;
  intervalMs?: number;
  startDelayMs?: number;
  caret?: boolean;
  style?: CSSProperties;
}) {
  const words = useMemo(() => text.split(/(\s+)/), [text]); // keep whitespace
  const [cursor, setCursor] = useState(0);
  const done = cursor >= words.length;

  useEffect(() => {
    setCursor(0);
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => {
      timer = setInterval(() => {
        setCursor((c) => {
          if (c >= words.length) {
            if (timer) clearInterval(timer);
            return c;
          }
          return c + chunkSize;
        });
      }, intervalMs);
    }, startDelayMs);
    return () => {
      clearTimeout(start);
      if (timer) clearInterval(timer);
    };
  }, [words, chunkSize, intervalMs, startDelayMs]);

  return (
    <span style={style}>
      {words.slice(0, cursor).join("")}
      {caret && !done && (
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 2,
            height: "0.9em",
            background: C.muted,
            marginLeft: 2,
            verticalAlign: "-2px",
            animation: "caretBlink 900ms steps(1) infinite",
          }}
        />
      )}
    </span>
  );
}
