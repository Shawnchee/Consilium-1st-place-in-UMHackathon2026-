"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button, Icon } from "@/components/atoms";
import { BORDER_HAIRLINE, C, FONT_MONO, FONT_SERIF, RADIUS, SHADOW_CARD } from "@/lib/tokens";
import { useStore } from "./store";
import { api } from "@/lib/api";

export function AddPatientModal({ onClose }: { onClose: () => void }) {
  const { refresh, flashToast } = useStore();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"Male" | "Female">("Male");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [isSexDropdownOpen, setSexDropdownOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10);
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", esc);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", esc);
      setMounted(false);
    };
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const parsedAge = parseInt(age, 10);
    if (isNaN(parsedAge) || parsedAge < 0) {
      setError("Please enter a valid age");
      return;
    }

    setLoading(true);
    try {
      await api.createPatient({
        name,
        species,
        breed,
        age: parsedAge,
        sex,
        ownerName,
        ownerPhone,
      });
      flashToast("Patient added successfully");
      await refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add patient");
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: RADIUS.md,
    border: BORDER_HAIRLINE,
    fontSize: 14,
    color: C.text,
    background: "#FFFFFF",
    outline: "none",
  };

  const labelStyle = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
    color: C.muted,
    marginBottom: 6,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(15,23,42,0.42)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        animation: "backdropIn 220ms ease both",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.card,
          borderRadius: RADIUS.lg,
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: SHADOW_CARD,
          animation: "modalIn 320ms cubic-bezier(0.2,0.8,0.2,1) both",
          border: BORDER_HAIRLINE,
        }}
      >
        <div
          style={{
            padding: "22px 28px 18px",
            borderBottom: BORDER_HAIRLINE,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: FONT_SERIF,
                fontSize: 22,
                fontWeight: 600,
                color: C.text,
                letterSpacing: -0.4,
              }}
            >
              Add New Patient
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: RADIUS.sm,
              background: "transparent",
              color: C.muted,
              border: BORDER_HAIRLINE,
              fontSize: 16,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: "22px 28px", display: "grid", gap: 16 }}>
            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "rgba(220,38,38,0.1)",
                  border: `1px solid rgba(220,38,38,0.3)`,
                  borderRadius: RADIUS.md,
                  color: C.red,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <div>
              <label style={labelStyle}>Patient Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
                placeholder="e.g. Buddy"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>Species</label>
                <input
                  required
                  value={species}
                  onChange={(e) => setSpecies(e.target.value)}
                  style={inputStyle}
                  placeholder="e.g. Dog, Parrot, Rabbit"
                />
              </div>
              <div style={{ position: "relative" }}>
                <label style={labelStyle}>Sex</label>
                <div
                  onClick={() => setSexDropdownOpen(!isSexDropdownOpen)}
                  style={{
                    ...inputStyle,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <span>{sex}</span>
                  <span style={{ color: C.muted, transform: isSexDropdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms ease" }}>
                    {Icon.chevron(14)}
                  </span>
                </div>
                
                <AnimatePresence>
                  {isSexDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        background: "#FFFFFF",
                        border: BORDER_HAIRLINE,
                        borderRadius: RADIUS.md,
                        boxShadow: SHADOW_CARD,
                        zIndex: 50,
                        overflow: "hidden",
                      }}
                    >
                      {(["Male", "Female"] as const).map((option) => (
                        <div
                          key={option}
                          onClick={() => {
                            setSex(option);
                            setSexDropdownOpen(false);
                          }}
                          style={{
                            padding: "10px 14px",
                            fontSize: 14,
                            color: C.text,
                            cursor: "pointer",
                            background: sex === option ? "rgba(15,23,42,0.04)" : "transparent",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,23,42,0.04)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = sex === option ? "rgba(15,23,42,0.04)" : "transparent")}
                        >
                          {option}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>Breed</label>
                <input
                  required
                  value={breed}
                  onChange={(e) => setBreed(e.target.value)}
                  style={inputStyle}
                  placeholder="e.g. Golden Retriever"
                />
              </div>
              <div>
                <label style={labelStyle}>Age (Years)</label>
                <input
                  required
                  type="number"
                  min="0"
                  max="30"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  style={inputStyle}
                  placeholder="e.g. 5"
                />
              </div>
            </div>

            <div style={{ height: 1, background: C.borderSoft, margin: "8px 0" }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>Owner Name</label>
                <input
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  style={inputStyle}
                  placeholder="e.g. Jane Doe"
                />
              </div>
              <div>
                <label style={labelStyle}>Owner Phone</label>
                <input
                  required
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  style={{ ...inputStyle, fontFamily: FONT_MONO }}
                  placeholder="e.g. +60123456789"
                />
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "16px 28px 22px",
              borderTop: BORDER_HAIRLINE,
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              background: "#FBFAF7",
            }}
          >
            <Button variant="soft" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Patient"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
