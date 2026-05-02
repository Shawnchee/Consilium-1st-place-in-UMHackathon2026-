"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { KnowledgeRule } from "@/lib/api-types";
import { BORDER_HAIRLINE, C, RADIUS, SHADOW_CARD, FONT_SERIF } from "@/lib/tokens";

export default function KnowledgePage() {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<KnowledgeRule[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadKnowledge();
  }, []);

  async function loadKnowledge() {
    setLoading(true);
    try {
      const data = await api.getKnowledge();
      // Normalize Rules
      const normalizedRules = (data.rules || []).map((r: any) => ({
        ...r,
        verified: r.verified ?? (r.status === "verified" || r.status === "confirmed" || !!r.pinned),
        pinned: !!r.pinned,
        added_date: r.added_date || r.last_reinforced_at || new Date().toISOString(),
        last_reinforced_at: r.last_reinforced_at || r.updated_date || new Date().toISOString()
      }));
      setRules(normalizedRules);
      setUpdatedAt(data.updatedAt);
    } catch (err) {
      console.error("Failed to load knowledge:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(index: number) {
    const newRules = [...rules];
    newRules[index].verified = true;
    setRules(newRules);
    save(newRules);
  }

  async function handlePin(index: number) {
    const newRules = [...rules];
    newRules[index].pinned = !newRules[index].pinned;
    if (newRules[index].pinned) newRules[index].verified = true; // Safety
    setRules(newRules);
    save(newRules);
  }

  async function deleteRule(index: number) {
    const newRules = rules.filter((_, i) => i !== index);
    setRules(newRules);
    save(newRules);
  }

  async function save(updatedRules: KnowledgeRule[]) {
    setSaving(true);
    try {
      await api.updateKnowledge({ rules: updatedRules });
    } catch (err) {
      console.error("Failed to save rules:", err);
    } finally {
      setSaving(false);
    }
  }

  const permanentRules = rules.filter(r => r.verified && r.pinned);
  const temporaryRules = rules.filter(r => r.verified && !r.pinned);
  const pendingRules = rules.filter(r => !r.verified);

  return (
    <main style={{ padding: "60px 24px", minHeight: "100vh", backgroundColor: C.bg }}>
      <div style={{ maxWidth: 840, margin: "0 auto" }}>
        <header style={{ marginBottom: 60, textAlign: "center" }}>
          <h1 style={{ fontSize: 40, fontFamily: FONT_SERIF, fontWeight: 500, letterSpacing: "-0.03em", color: C.text, marginBottom: 12 }}>
            Clinic Knowledge
          </h1>
          <p style={{ color: C.muted, fontSize: 18, lineHeight: 1.6, maxWidth: 600, margin: "0 auto" }}>
            Manage the Master SOPs and AI behaviors driving your triage agent.
          </p>
          {updatedAt && (
            <div style={{ fontSize: 12, color: C.hint, marginTop: 24, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1 }}>
              Last Sync: {new Date(updatedAt).toLocaleDateString()} · {new Date(updatedAt).toLocaleTimeString()}
            </div>
          )}
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 64 }}>
          
          {/* 1. Permanent Protocols */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>Permanent Protocols</h2>
              <div style={{ height: 1, flex: 1, backgroundColor: C.borderSoft }} />
              {saving && <span style={{ fontSize: 11, fontWeight: 700, color: C.brand, textTransform: "uppercase" }}>Syncing...</span>}
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {loading ? (
                [1].map(i => <div key={i} style={{ height: 100, backgroundColor: C.card, borderRadius: RADIUS.lg, border: BORDER_HAIRLINE, opacity: 0.5 }} />)
              ) : permanentRules.length === 0 ? (
                <EmptyState text="No permanent protocols. Pin verified rules to make them immutable." />
              ) : (
                permanentRules.map((rule) => {
                  const globalIdx = rules.findIndex(r => r.action === rule.action);
                  return (
                    <RuleCard 
                      key={globalIdx} 
                      rule={rule} 
                      onPin={() => handlePin(globalIdx)}
                      onDelete={() => deleteRule(globalIdx)} 
                    />
                  );
                })
              )}
            </div>
          </section>

          {/* 2. Temporary Protocols */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>Temporary Protocols</h2>
              <div style={{ height: 1, flex: 1, backgroundColor: C.borderSoft }} />
            </div>
            <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>Approved rules that will auto-expire in 30 days unless pinned or reinforced.</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {loading ? (
                [1, 2].map(i => <div key={i} style={{ height: 100, backgroundColor: C.card, borderRadius: RADIUS.lg, border: BORDER_HAIRLINE, opacity: 0.5 }} />)
              ) : temporaryRules.length === 0 ? (
                <EmptyState text="No temporary protocols. Verify AI suggestions to move them here." />
              ) : (
                temporaryRules.map((rule) => {
                  const globalIdx = rules.findIndex(r => r.action === rule.action);
                  return (
                    <RuleCard 
                      key={globalIdx} 
                      rule={rule} 
                      onPin={() => handlePin(globalIdx)}
                      onDelete={() => deleteRule(globalIdx)} 
                    />
                  );
                })
              )}
            </div>
          </section>

          {/* 3. AI Suggestions */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>AI Suggestions</h2>
              <div style={{ height: 1, flex: 1, backgroundColor: C.borderSoft }} />
            </div>
            <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>Rules learned from corrections. The agent is <b>using these</b> but they require verification.</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {loading ? (
                [1, 2, 3].map(i => <div key={i} style={{ height: 100, backgroundColor: C.card, borderRadius: RADIUS.lg, border: BORDER_HAIRLINE, opacity: 0.5 }} />)
              ) : pendingRules.length === 0 ? (
                <EmptyState text="No new AI suggestions at this time." />
              ) : (
                pendingRules.map((rule) => {
                  const globalIdx = rules.findIndex(r => r.action === rule.action);
                  return (
                    <RuleCard 
                      key={globalIdx} 
                      rule={rule} 
                      onVerify={() => handleVerify(globalIdx)}
                      onDelete={() => deleteRule(globalIdx)} 
                    />
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center", border: `1px dashed ${C.border}`, borderRadius: RADIUS.lg, color: C.hint, fontSize: 15 }}>
      {text}
    </div>
  );
}

function RuleCard({ rule, onVerify, onPin, onDelete }: { rule: KnowledgeRule, onVerify?: () => void, onPin?: () => void, onDelete: () => void }) {
  const isPinned = rule.pinned;
  const isVerified = rule.verified;
  
  return (
    <div 
      style={{ 
        padding: "24px 28px", 
        backgroundColor: C.card, 
        borderRadius: RADIUS.lg, 
        border: isPinned ? `2px solid ${C.brand}` : BORDER_HAIRLINE,
        boxShadow: SHADOW_CARD,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 32,
        transition: "all 0.2s ease"
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
          {!isVerified ? (
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", padding: "3px 8px", borderRadius: 6, backgroundColor: C.amberLight, color: C.amber, letterSpacing: 0.5 }}>
              Review Required
            </span>
          ) : isPinned ? (
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", padding: "3px 8px", borderRadius: 6, backgroundColor: C.brand, color: "#fff", letterSpacing: 0.5 }}>
              Permanent
            </span>
          ) : (
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", padding: "3px 8px", borderRadius: 6, backgroundColor: C.bgAlt, color: C.muted, letterSpacing: 0.5 }}>
              Temporary
            </span>
          )}
          
          <span style={{ fontSize: 12, color: C.hint }}>
            Synthesized {new Date(rule.added_date).toLocaleDateString()}
          </span>
          {isVerified && !isPinned && (
            <span style={{ fontSize: 12, color: C.amber, fontWeight: 600 }}>
              · Expires in {Math.max(0, 30 - Math.floor((Date.now() - new Date(rule.last_reinforced_at).getTime()) / (1000 * 60 * 60 * 24)))} days
            </span>
          )}
        </div>
        <div style={{ fontSize: 17, lineHeight: 1.5, color: C.text, fontWeight: 500, fontFamily: FONT_SERIF }}>{rule.action}</div>
        {rule.condition && (
          <div style={{ fontSize: 14, color: C.muted, marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: C.brand, fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>Condition:</span>
            {rule.condition}
          </div>
        )}
      </div>
      
      <div style={{ display: "flex", gap: 16 }}>
        {onVerify && (
          <button 
            onClick={onVerify}
            style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: C.brand, border: `1px solid ${C.brand}`, cursor: "pointer", padding: "8px 16px", borderRadius: RADIUS.md }}
          >
            Verify
          </button>
        )}
        {onPin && (
          <button 
            onClick={onPin}
            style={{ 
              fontSize: 13, 
              fontWeight: 700, 
              color: isPinned ? C.muted : C.brand, 
              background: "none", 
              border: `1px solid ${isPinned ? C.border : C.brand}`, 
              cursor: "pointer", 
              padding: "8px 16px", 
              borderRadius: RADIUS.md 
            }}
          >
            {isPinned ? "Unpin" : "Pin Protocol"}
          </button>
        )}
        <button 
          onClick={onDelete}
          style={{ fontSize: 13, fontWeight: 700, color: C.red, background: "none", border: `1px solid ${C.redBorder}`, cursor: "pointer", padding: "8px 16px", borderRadius: RADIUS.md }}
        >
          Discard
        </button>
      </div>
    </div>
  );
}
