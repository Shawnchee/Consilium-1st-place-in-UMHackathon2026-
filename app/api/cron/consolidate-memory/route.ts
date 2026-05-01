import { NextResponse } from "next/server";
import { ENV } from "@/lib/env";

/**
 * Nightly cron job to consolidate raw medical data into Clinic Brain SOPs.
 * Triggered via Vercel Cron or manual HIT.
 *
 * Usage (vercel.json):
 * { "crons": [{ "path": "/api/cron/consolidate-memory", "schedule": "0 2 * * *" }] }
 */
export async function GET(request: Request) {
  // 1. Verify Vercel Cron secret if in production
  const authHeader = request.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sidecarUrl = ENV.langgraph.serviceUrl;
  if (!sidecarUrl) {
    return NextResponse.json(
      { error: "LANGGRAPH_SERVICE_URL not set" },
      { status: 500 },
    );
  }

  try {
    const resp = await fetch(`${sidecarUrl.replace(/\/$/, "")}/consolidate_memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinic_id: ENV.clinic.id }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      throw new Error(`Sidecar failed (${resp.status}): ${detail}`);
    }

    const result = await resp.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron/consolidate-memory] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
