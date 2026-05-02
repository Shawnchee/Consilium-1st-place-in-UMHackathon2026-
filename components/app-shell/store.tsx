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
  approving: boolean;
  approveError: string | null;
  openEscalation: (f: FollowUp) => void;
  closeEscalation: () => void;
  approveEscalation: (overrideDraft?: string) => Promise<void>;
  setToast: (msg: string | null) => void;
  flashToast: (msg: string) => void;
  expandedPatient: string | null;
  setExpandedPatient: (id: string | null) => void;
  approveClear: (f: FollowUp) => void;
  changeFollowUpLevel: (f: FollowUp, level: FollowUpLevel) => void;
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
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
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

  const openEscalation = useCallback((f: FollowUp) => {
    setApproveError(null);
    setEscalation(f);
  }, []);
  const closeEscalation = useCallback(() => {
    setApproveError(null);
    setEscalation(null);
  }, []);
  const approveEscalation = useCallback(async (overrideDraft?: string) => {
    const cur = escalation;
    if (!cur || approving) return;

    const body = (overrideDraft ?? cur.draft ?? "").trim();
    if (!body) {
      setApproveError("No draft to send.");
      return;
    }
    if (!cur.chatId) {
      setApproveError(
        "No Telegram chat linked to this follow-up — cannot send.",
      );
      return;
    }
    if (!cur.patientId) {
      setApproveError("No patient linked to this follow-up — cannot send.");
      return;
    }

    setApproving(true);
    setApproveError(null);
    try {
      await api.telegramSend({
        chatId: cur.chatId,
        body,
        patientId: cur.patientId,
      });
      // Log the doctor's approval after a successful delivery.
      void api
        .correction({
          feature: "triage",
          followupId: cur.id,
          glmOutput: cur.level,
          approved: true,
        })
        .catch(() => {});
      setFollowups((fs) => fs.filter((x) => x.id !== cur.id));
      setResolvedCount((c) => c + 1);
      flashToast(`Sent to ${cur.owner} · ${cur.patient} closed`);
      setEscalation(null);
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : "send failed");
    } finally {
      setApproving(false);
    }
  }, [escalation, approving, flashToast]);

  const approveClear = useCallback((f: FollowUp) => {
    setFollowups((fs) => fs.filter((x) => x.id !== f.id));
    setResolvedCount((c) => c + 1);
    flashToast(`${f.patient} categorized as clear`);
    
    void api.correction({
      feature: "triage",
      followupId: f.id,
      glmOutput: "clear",
      approved: true,
    }).catch(() => {});
  }, [flashToast]);

  const changeFollowUpLevel = useCallback((f: FollowUp, level: FollowUpLevel) => {
    setFollowups((fs) => fs.map((x) => x.id === f.id ? { ...x, level } : x));
    flashToast(`${f.patient} moved to ${level}`);
    
    void api.correction({
      feature: "triage",
      followupId: f.id,
      glmOutput: f.level,
      doctorCorrection: level,
      approved: false,
    }).catch(() => {});
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
        approving,
        approveError,
        openEscalation,
        closeEscalation,
        approveEscalation,
        setToast,
        flashToast,
        expandedPatient,
        setExpandedPatient,
        approveClear,
        changeFollowUpLevel,
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
