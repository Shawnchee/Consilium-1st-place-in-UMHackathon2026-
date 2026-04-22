"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { api } from "@/lib/api";
import { hasSupabase } from "@/lib/env";
import { getSupabaseBrowser } from "@/lib/supabase";
import type { FollowUp, MetricCardData, Patient } from "@/lib/types";

interface StoreCtx {
  // data
  followups: FollowUp[];
  patients: Patient[];
  metrics: MetricCardData[];
  resolvedCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;

  // UI state
  toast: string | null;
  escalation: FollowUp | null;
  openEscalation: (f: FollowUp) => void;
  closeEscalation: () => void;
  approveEscalation: () => void;
  setToast: (msg: string | null) => void;
  flashToast: (msg: string) => void;
  expandedPatient: string | null;
  setExpandedPatient: (id: string | null) => void;
}

/** Minimum shape we read off a Realtime `followups` row payload. */
type FollowupRowPayload = {
  id: string;
  status?: string;
  owner_message?: string | null;
};

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [metrics, setMetrics] = useState<MetricCardData[]>([]);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [escalation, setEscalation] = useState<FollowUp | null>(null);
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);

  // `silent` skips the loading skeleton flash — used for Realtime-triggered
  // refreshes where a full skeleton wipe would be jarring.
  const loadFollowups = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [fu, pa, me] = await Promise.all([
          api.getFollowups(),
          api.getPatients(),
          api.getMetrics(),
        ]);
        setFollowups(fu.followups);
        setResolvedCount(fu.resolvedCount);
        setPatients(pa.patients);
        setMetrics(me.metrics);
      } catch (err) {
        setError(err instanceof Error ? err.message : "failed to load");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [],
  );

  const refresh = useCallback(() => loadFollowups(false), [loadFollowups]);

  useEffect(() => {
    void loadFollowups(false);
  }, [loadFollowups]);

  /* ─── Supabase Realtime on `followups` ────────────────────────────────
     One subscription per mount. INSERTs = new followup seeded (bot
     started a case). UPDATEs = owner replied, triage decided. When the
     decision flips to `escalate`, flash a toast and refresh silently.
  ─────────────────────────────────────────────────────────────────────── */
  const seenEscalationIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!hasSupabase()) return;

    const sb = getSupabaseBrowser();
    const channel = sb
      .channel("followups-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "followups" },
        (payload) => {
          const row = payload.new as FollowupRowPayload;
          void loadFollowups(true);
          if (row.status === "escalate" && !seenEscalationIds.current.has(row.id)) {
            seenEscalationIds.current.add(row.id);
            setToast("New escalation opened");
            setTimeout(() => setToast(null), 3400);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "followups" },
        (payload) => {
          const row = payload.new as FollowupRowPayload;
          const prev = payload.old as FollowupRowPayload | null;
          void loadFollowups(true);
          const becameEscalate =
            row.status === "escalate" && prev?.status !== "escalate";
          if (becameEscalate && !seenEscalationIds.current.has(row.id)) {
            seenEscalationIds.current.add(row.id);
            setToast("New escalation — check follow-ups");
            setTimeout(() => setToast(null), 3400);
          }
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [loadFollowups]);

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3400);
  }, []);

  const openEscalation = useCallback((f: FollowUp) => setEscalation(f), []);
  const closeEscalation = useCallback(() => setEscalation(null), []);
  const approveEscalation = useCallback(() => {
    setEscalation((cur) => {
      if (!cur) return null;
      setFollowups((fs) => fs.filter((x) => x.id !== cur.id));
      setResolvedCount((c) => c + 1);
      // fire-and-forget — mock route just logs
      void api
        .correction({
          feature: "triage",
          followupId: cur.id,
          glmOutput: cur.level,
          approved: true,
        })
        .catch(() => {});
      flashToast(`Sent to ${cur.owner} · ${cur.patient} closed`);
      return null;
    });
  }, [flashToast]);

  return (
    <Ctx.Provider
      value={{
        followups,
        patients,
        metrics,
        resolvedCount,
        loading,
        error,
        refresh,
        toast,
        escalation,
        openEscalation,
        closeEscalation,
        approveEscalation,
        setToast,
        flashToast,
        expandedPatient,
        setExpandedPatient,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}
