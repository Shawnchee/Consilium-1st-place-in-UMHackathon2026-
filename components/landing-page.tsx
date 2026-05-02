"use client";

import Link from "next/link";
import {
  CSSProperties,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button, Dot, Icon, Pill } from "@/components/atoms";
import { HeroDog, MousePosition } from "@/components/dogs";
import BlurWord from "@/components/react-bits/BlurWord";
import CountUp from "@/components/react-bits/CountUp";
import DotField from "@/components/react-bits/DotField";
import {
  BORDER_HAIRLINE,
  C,
  FONT_MONO,
  FONT_SERIF,
  SHADOW_CARD,
} from "@/lib/tokens";
import { CLINIC } from "@/lib/clinic";

/* ───────────────────────── shared helpers ───────────────────────── */

const MAX_W = 1200;

function useReveal<T extends HTMLElement>(threshold = 0.12) {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const t = setTimeout(() => setShown(true), 0);
      return () => clearTimeout(t);
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        });
      },
      { threshold, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, shown };
}

function Reveal({
  children,
  delay = 0,
  as = "div",
  style,
}: {
  children: ReactNode;
  delay?: number;
  as?: "div" | "section" | "article";
  style?: CSSProperties;
}) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  const Tag = as as "div";
  return (
    <Tag
      ref={ref}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(14px)",
        transition: `opacity 520ms ease ${delay}ms, transform 520ms ease ${delay}ms`,
        willChange: "transform, opacity",
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

/* soft eyebrow — small uppercase tag with a numeric prefix */
function Eyebrow({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: FONT_MONO,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 1.6,
        textTransform: "uppercase",
        color: C.muted,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function RuleLine({ style }: { style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{
        width: "100%",
        height: 1,
        background: C.borderSoft,
        ...style,
      }}
    />
  );
}

/* ───────────────────────── nav ───────────────────────── */

function TopNav() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "rgba(244,242,237,0.88)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderBottom: BORDER_HAIRLINE,
      }}
    >
      <div
        style={{
          maxWidth: MAX_W,
          margin: "0 auto",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          gap: 36,
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 8,
            color: C.text,
            textDecoration: "none",
          }}
        >
          <span
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: -0.4,
            }}
          >
            Consilium
          </span>
          <span
            style={{
              fontFamily: FONT_SERIF,
              fontStyle: "italic",
              fontSize: 12,
              color: C.hint,
            }}
          >
            n. medical council
          </span>
        </Link>

        <nav
          style={{
            display: "flex",
            gap: 26,
            marginLeft: 8,
          }}
        >
          {[
            { label: "Product", href: "#product" },
            { label: "Clinic Login", href: "/dashboard" },
          ].map((l) => (
            <a
              key={l.label}
              href={l.href}
              style={{
                fontSize: 13.5,
                color: C.muted,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <Link href="/dashboard" style={{ textDecoration: "none" }}>
          <Button size="sm" iconRight={Icon.arrow(14)}>
            Open the Dashboard
          </Button>
        </Link>
      </div>
    </header>
  );
}

/* ───────────────────────── hero ───────────────────────── */

function FlatBadge({
  title,
  sub,
  dotColor,
  pulsing,
}: {
  title: string;
  sub: string;
  dotColor: string;
  pulsing?: boolean;
}) {
  return (
    <div
      style={{
        background: C.card,
        border: BORDER_HAIRLINE,
        borderRadius: 10,
        padding: "10px 14px",
        boxShadow: SHADOW_CARD,
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 220,
      }}
    >
      <Dot color={dotColor} size={8} pulsing={pulsing} />
      <div>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: C.text,
            letterSpacing: -0.1,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 11,
            color: C.muted,
            marginTop: 2,
            fontFamily: FONT_MONO,
            letterSpacing: 0.2,
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  );
}

function HeroProof({ children, l }: { children: ReactNode; l: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: FONT_SERIF,
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: -0.8,
          color: C.text,
          lineHeight: 1,
        }}
      >
        {children}
      </div>
      <div
        style={{
          fontSize: 12,
          color: C.muted,
          marginTop: 6,
          lineHeight: 1.35,
          maxWidth: 160,
        }}
      >
        {l}
      </div>
    </div>
  );
}

function Hero({
  mouseRef,
}: {
  mouseRef: React.MutableRefObject<MousePosition>;
}) {
  return (
    <section
      style={{
        borderBottom: BORDER_HAIRLINE,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* interactive dot field — restrained editorial backdrop */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.55,
          maskImage:
            "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0) 90%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0) 90%)",
        }}
      >
        <DotField
          dotRadius={1.2}
          dotSpacing={26}
          cursorRadius={240}
          bulgeOnly
          bulgeStrength={34}
          glowColor="transparent"
          glowRadius={0}
          gradientFrom="rgba(15,23,42,0.22)"
          gradientTo="rgba(15,23,42,0.22)"
        />
      </div>

      <div
        style={{
          position: "relative",
          maxWidth: MAX_W,
          margin: "0 auto",
          padding: "72px 32px 96px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.35fr)",
          gap: 56,
          alignItems: "center",
        }}
      >
        {/* LEFT — editorial column */}
        <div
          style={{
            animation: "fadeUp 640ms ease both",
          }}
        >
          <Eyebrow style={{ marginBottom: 22 }}>
            <span
              style={{
                width: 18,
                height: 1,
                background: C.hint,
                display: "inline-block",
              }}
            />
            AI Decision Copilot · Vet Clinics · SEA
          </Eyebrow>

          <h1
            style={{
              fontFamily: FONT_SERIF,
              fontWeight: 500,
              fontSize: "clamp(42px, 5.4vw, 72px)",
              lineHeight: 1.08,
              letterSpacing: -0.8,
              margin: "0 0 28px",
              color: C.text,
              textWrap: "balance",
            }}
          >
            The AI that thinks{" "}
            <BlurWord
              delay={280}
              style={{ fontStyle: "italic", color: C.brand }}
            >
              before
            </BlurWord>{" "}
            the consult,
            <br />
            and acts{" "}
            <BlurWord
              delay={520}
              style={{ fontStyle: "italic", color: C.brand }}
            >
              after
            </BlurWord>{" "}
            it.
          </h1>

          <p
            style={{
              fontSize: 17,
              lineHeight: 1.6,
              color: C.muted,
              margin: "0 0 36px",
              maxWidth: 520,
            }}
          >
            A copilot for solo vet clinics. Briefs the doctor before, structures
            the notes during, follows up with owners after — escalating only
            what needs your eyes.
          </p>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              marginBottom: 44,
              flexWrap: "wrap",
            }}
          >
            <Link href="/dashboard" style={{ textDecoration: "none" }}>
              <Button
                size="lg"
                iconRight={Icon.arrow(16)}
                style={{
                  background: C.brand,
                  color: "#FFFFFF",
                  boxShadow: "none",
                }}
              >
                Open the Dashboard
              </Button>
            </Link>
            <a href="#problem" style={{ textDecoration: "none" }}>
              <Button
                size="lg"
                variant="ghost"
                style={{
                  border: `1px solid ${C.text}`,
                  color: C.text,
                }}
              >
                See how it works
              </Button>
            </a>
          </div>

          <RuleLine style={{ margin: "0 0 28px" }} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 24,
            }}
          >
            <HeroProof l="Triage accuracy (vs 63% keyword baseline)">
              <CountUp to={94} duration={1.6} />%
            </HeroProof>
            <HeroProof l="Billing recovered per clinic / month">
              RM <CountUp to={10} duration={1.6} />k
            </HeroProof>
            <HeroProof l="Saved per doctor per day">
              <CountUp to={3} duration={1.6} /> hrs
            </HeroProof>
          </div>
        </div>

        {/* RIGHT — dog as main UI, full stage */}
        <div
          style={{
            position: "relative",
            display: "grid",
            placeItems: "center",
            minHeight: 720,
          }}
        >
          {/* soft elliptical ground — flat, blurred for diffusion */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: "7%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "58%",
              height: 28,
              borderRadius: "50%",
              background: "rgba(15,23,42,0.06)",
              filter: "blur(14px)",
              pointerEvents: "none",
            }}
          />

          <HeroDog mouseRef={mouseRef} size={700} />

          {/* badge near the head — the decision moment */}
          <div
            style={{
              position: "absolute",
              top: "10%",
              left: "-4%",
              animation: "fadeUp 720ms ease both",
              animationDelay: "200ms",
            }}
          >
            <FlatBadge
              title={`Escalate → ${CLINIC.doctor}`}
              sub="Post-spay Day 2 · wound check"
              dotColor={C.red}
              pulsing
            />
          </div>

          {/* badge near the tail — the revenue moment */}
          <div
            style={{
              position: "absolute",
              bottom: "14%",
              right: "-4%",
              animation: "fadeUp 720ms ease both",
              animationDelay: "340ms",
            }}
          >
            <FlatBadge
              title="+RM 145 billing recovered"
              sub="Radiograph + E-collar flagged"
              dotColor={C.amber}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── problem strip ───────────────────────── */

function ProblemStrip() {
  const stats: { render: ReactNode; l: string }[] = [
    {
      render: (
        <>
          <CountUp to={3} duration={1.8} />+ hrs
        </>
      ),
      l: "lost per doctor per day to admin, note-writing, and follow-up coordination",
    },
    {
      render: (
        <>
          10–<CountUp to={15} duration={1.8} />%
        </>
      ),
      l: "of billable items missed every consult — silent revenue leak",
    },
    {
      render: "0",
      l: "systems today that catch post-treatment complications early",
    },
  ];
  return (
    <section
      id="problem"
      style={{
        borderBottom: BORDER_HAIRLINE,
        background: C.bgAlt,
        scrollMarginTop: 80,
      }}
    >
      <div
        style={{
          maxWidth: MAX_W,
          margin: "0 auto",
          padding: "88px 32px",
        }}
      >
        <Reveal>
          <h2
            style={{
              fontFamily: FONT_SERIF,
              fontWeight: 500,
              fontSize: "clamp(30px, 3.6vw, 44px)",
              lineHeight: 1.12,
              letterSpacing: -0.8,
              margin: "0 0 14px",
              color: C.text,
              maxWidth: 760,
            }}
          >
            Small vet clinics in Southeast Asia are{" "}
            <em style={{ fontStyle: "italic", color: C.brand }}>
              drowning in admin
            </em>{" "}
            — and{" "}
            <em style={{ fontStyle: "italic", color: C.brand }}>
              bleeding revenue
            </em>{" "}
            they never see.
          </h2>
          <p
            style={{
              fontSize: 16,
              color: C.muted,
              lineHeight: 1.55,
              maxWidth: 640,
              margin: "0 0 40px",
            }}
          >
            2–5-doctor clinics don&apos;t have a scribe, a billing auditor, or a
            follow-up team. The doctor is all three. The day is the casualty.
          </p>
        </Reveal>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            borderTop: BORDER_HAIRLINE,
            borderLeft: BORDER_HAIRLINE,
          }}
        >
          {stats.map((s, i) => (
            <Reveal key={i} delay={i * 80}>
              <div
                style={{
                  padding: "32px 28px 36px",
                  borderRight: BORDER_HAIRLINE,
                  borderBottom: BORDER_HAIRLINE,
                  background: C.card,
                  minHeight: 180,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    fontFamily: FONT_SERIF,
                    fontSize: 56,
                    fontWeight: 500,
                    letterSpacing: -2,
                    color: C.text,
                    lineHeight: 1,
                  }}
                >
                  {s.render}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: C.muted,
                    lineHeight: 1.5,
                    marginTop: 20,
                    maxWidth: 300,
                  }}
                >
                  {s.l}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── thesis / manifesto ───────────────────────── */

function ThesisBlock() {
  const pillars = [
    {
      k: "Before",
      t: "Intelligence brief",
      d: "Years of free-text notes → a 5-line read the doctor can absorb in seconds.",
    },
    {
      k: "During",
      t: "Structured capture",
      d: "Dictate or type. SOAP, prescription, billing, staff to-dos — all at once.",
    },
    {
      k: "After",
      t: "Telegram triage",
      d: "Auto-reach out, read the owner's reply, escalate only what needs a doctor.",
    },
  ];
  return (
    <section
      id="thesis"
      style={{
        borderBottom: BORDER_HAIRLINE,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.35,
          maskImage:
            "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 55%, rgba(0,0,0,0) 90%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 55%, rgba(0,0,0,0) 90%)",
        }}
      >
        <DotField
          dotRadius={1.1}
          dotSpacing={30}
          cursorRadius={220}
          bulgeOnly
          bulgeStrength={26}
          glowColor="transparent"
          glowRadius={0}
          gradientFrom="rgba(15,23,42,0.2)"
          gradientTo="rgba(15,23,42,0.2)"
        />
      </div>
      <div
        style={{
          position: "relative",
          maxWidth: MAX_W,
          margin: "0 auto",
          padding: "100px 32px",
          textAlign: "center",
        }}
      >
        <Reveal>
          <p
            style={{
              fontFamily: FONT_SERIF,
              fontSize: "clamp(26px, 3.2vw, 38px)",
              lineHeight: 1.28,
              letterSpacing: -0.5,
              color: C.text,
              margin: "0 auto",
              maxWidth: "60ch",
              fontWeight: 500,
            }}
          >
            Every other vet AI automates the exam room.{" "}
            <em style={{ fontStyle: "italic", color: C.brand }}>
              Consilium owns the decision layer
            </em>{" "}
            — before the consult, during it, and after it.
          </p>
        </Reveal>

        <div
          style={{
            marginTop: 56,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 0,
            borderTop: BORDER_HAIRLINE,
            borderLeft: BORDER_HAIRLINE,
            textAlign: "left",
          }}
        >
          {pillars.map((p, i) => (
            <Reveal key={p.k} delay={i * 80}>
              <div
                style={{
                  padding: "28px 26px",
                  borderRight: BORDER_HAIRLINE,
                  borderBottom: BORDER_HAIRLINE,
                  background: C.card,
                  minHeight: 170,
                }}
              >
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10.5,
                    letterSpacing: 1.6,
                    textTransform: "uppercase",
                    color: C.brand,
                    marginBottom: 14,
                    fontWeight: 700,
                  }}
                >
                  {p.k}
                </div>
                <div
                  style={{
                    fontFamily: FONT_SERIF,
                    fontSize: 22,
                    fontWeight: 500,
                    letterSpacing: -0.4,
                    color: C.text,
                    marginBottom: 10,
                  }}
                >
                  {p.t}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: C.muted,
                    lineHeight: 1.55,
                  }}
                >
                  {p.d}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── feature sections F1–F6 ───────────────────────── */

type FeatureMock = ReactNode;

function FeatureRow({
  id,
  n,
  when,
  title,
  body,
  impact,
  mock,
  reverse,
  hero,
}: {
  id?: string;
  n: string;
  when: string;
  title: string;
  body: string;
  impact: string;
  mock: FeatureMock;
  reverse?: boolean;
  hero?: boolean;
}) {
  return (
    <Reveal>
      <article
        id={id}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.05fr)",
          gap: 56,
          alignItems: "center",
          padding: "88px 0",
          borderBottom: BORDER_HAIRLINE,
          scrollMarginTop: 80,
        }}
      >
        <div style={{ order: reverse ? 2 : 1 }}>
          <Eyebrow style={{ marginBottom: 16 }}>
            <span>{n}</span>
            <span
              style={{
                width: 18,
                height: 1,
                background: C.hint,
                display: "inline-block",
              }}
            />
            {when}
            {hero && (
              <span
                style={{
                  marginLeft: 8,
                  padding: "2px 8px",
                  border: `1px solid ${C.border}`,
                  borderRadius: 999,
                  fontSize: 10,
                  letterSpacing: 1.4,
                  color: C.red,
                  background: C.card,
                }}
              >
                HERO
              </span>
            )}
          </Eyebrow>
          <h3
            style={{
              fontFamily: FONT_SERIF,
              fontWeight: 500,
              fontSize: "clamp(28px, 3.2vw, 40px)",
              lineHeight: 1.12,
              letterSpacing: -0.8,
              color: C.text,
              margin: "0 0 18px",
              maxWidth: 520,
            }}
          >
            {title}
          </h3>
          <p
            style={{
              fontSize: 16,
              color: C.muted,
              lineHeight: 1.6,
              margin: "0 0 24px",
              maxWidth: 520,
            }}
          >
            {body}
          </p>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 14px",
              border: BORDER_HAIRLINE,
              borderRadius: 999,
              background: C.card,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: C.green,
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontSize: 13,
                color: C.text,
                fontFamily: FONT_MONO,
                letterSpacing: 0.1,
              }}
            >
              {impact}
            </span>
          </div>
        </div>
        <div style={{ order: reverse ? 1 : 2 }}>{mock}</div>
      </article>
    </Reveal>
  );
}

function FrameMock({
  label,
  children,
  accent,
}: {
  label: string;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: C.card,
        border: BORDER_HAIRLINE,
        borderRadius: 12,
        boxShadow: SHADOW_CARD,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          borderBottom: BORDER_HAIRLINE,
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: C.bgAlt,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: accent ?? C.hint,
            display: "inline-block",
          }}
        />
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            letterSpacing: 1.4,
            textTransform: "uppercase",
            color: C.muted,
          }}
        >
          {label}
        </div>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function KV({ k, v, flag }: { k: string; v: string; flag?: "amber" | "red" }) {
  const color = flag === "amber" ? C.amber : flag === "red" ? C.red : C.text;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "130px 1fr",
        gap: 14,
        padding: "9px 0",
        borderBottom: `1px solid ${C.borderSoft}`,
        alignItems: "baseline",
      }}
    >
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: C.muted,
        }}
      >
        {k}
      </div>
      <div style={{ fontSize: 14, color, lineHeight: 1.45 }}>{v}</div>
    </div>
  );
}

/* ===== F1 mock — pre-consult brief ===== */
function F1Mock() {
  return (
    <FrameMock label="Pre-Consult Brief · Patient #0142" accent={C.green}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: -0.4,
            }}
          >
            Milo
          </div>
          <div
            style={{
              fontSize: 12,
              color: C.muted,
              marginTop: 2,
              fontFamily: FONT_MONO,
            }}
          >
            Golden Retriever · 4yo · Male (N)
          </div>
        </div>
        <Pill tone="green">Ready</Pill>
      </div>
      <div>
        <KV k="Last visit" v="14 Mar — Ear infection, responded well" />
        <KV k="Chronic" v="None" />
        <KV
          k="Compliance"
          v="Owner declined dental recommendation ×2"
          flag="amber"
        />
        <KV k="Probe today" v="Check if ear condition fully resolved" />
        <KV k="Pending" v="Annual vaccine overdue by 6 weeks" flag="amber" />
      </div>
    </FrameMock>
  );
}

/* ===== F2 mock — consult capture ===== */
function F2Mock() {
  return (
    <FrameMock label="Consult Output · Structured" accent={C.brand}>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 12.5,
          color: C.text,
          lineHeight: 1.7,
          background: C.bgAlt,
          border: `1px solid ${C.borderSoft}`,
          borderRadius: 8,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <div>
          <span style={{ color: C.muted }}>S:</span> Limping on right hind for
          2 weeks, worse on stairs
        </div>
        <div>
          <span style={{ color: C.muted }}>O:</span> Pain on right stifle
          palpation, mild effusion
        </div>
        <div>
          <span style={{ color: C.muted }}>A:</span> Suspected CCL partial tear
        </div>
        <div>
          <span style={{ color: C.muted }}>P:</span> Radiograph, rest, Meloxicam
          0.1mg/kg SID ×7d
        </div>
      </div>

      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: C.muted,
          marginBottom: 8,
        }}
      >
        Billing recovery
      </div>
      <div>
        {[
          { ok: true, l: "Consultation fee", v: "RM 50" },
          { ok: true, l: "Meloxicam dispensed", v: "RM 35" },
          { ok: false, l: "Radiograph (in notes, unbilled)", v: "RM 120" },
          { ok: false, l: "E-collar (recommended, unbilled)", v: "RM 25" },
        ].map((r, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "20px 1fr auto",
              gap: 10,
              padding: "8px 0",
              borderBottom: `1px solid ${C.borderSoft}`,
              alignItems: "center",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: r.ok ? C.green : C.amber,
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 13, color: r.ok ? C.text : C.amber }}>
              {r.l}
            </span>
            <span
              style={{
                fontSize: 13,
                color: C.text,
                fontFamily: FONT_MONO,
                letterSpacing: 0.1,
              }}
            >
              {r.v}
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span style={{ fontSize: 12, color: C.muted }}>Total recovered</span>
        <span
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 22,
            fontWeight: 600,
            color: C.text,
            letterSpacing: -0.4,
          }}
        >
          +RM 145
        </span>
      </div>
    </FrameMock>
  );
}

/* ===== F3 mock — escalation card (hero) ===== */
function F3Mock() {
  return (
    <FrameMock label="Follow-up Triage · Live" accent={C.red}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <Dot color={C.red} size={8} pulsing />
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: C.red,
            fontWeight: 700,
          }}
        >
          Escalation — Milo · Post-spay Day 2
        </div>
      </div>
      <div
        style={{
          fontFamily: FONT_SERIF,
          fontStyle: "italic",
          fontSize: 16,
          lineHeight: 1.5,
          color: C.text,
          padding: "12px 14px",
          borderLeft: `2px solid ${C.border}`,
          background: C.bgAlt,
          marginBottom: 18,
        }}
      >
        &ldquo;She&apos;s been lying there and won&apos;t touch her food since
        morning.&rdquo;
      </div>

      {[
        {
          l: "Normal post-anaesthesia recovery",
          v: 65,
          color: C.green,
        },
        {
          l: "Early wound infection",
          v: 35,
          color: C.red,
        },
      ].map((d, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6,
              fontSize: 13,
              color: C.text,
            }}
          >
            <span>{d.l}</span>
            <span style={{ fontFamily: FONT_MONO, color: C.muted }}>
              {d.v}%
            </span>
          </div>
          <div
            style={{
              height: 4,
              borderRadius: 999,
              background: C.borderSoft,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${d.v}%`,
                height: "100%",
                background: d.color,
              }}
            />
          </div>
        </div>
      ))}

      <div
        style={{
          marginTop: 14,
          padding: "10px 12px",
          border: `1px solid ${C.amberBorder}`,
          borderRadius: 8,
          fontSize: 13,
          color: C.amber,
          background: C.card,
        }}
      >
        <strong style={{ fontWeight: 600 }}>Recommended:</strong> Bring in today
        for wound check
      </div>

      <div
        style={{
          marginTop: 14,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <Button size="sm" icon={Icon.check(14)}>
          Approve &amp; Send
        </Button>
        <Button size="sm" variant="soft" icon={Icon.edit(14)}>
          Edit
        </Button>
        <Button size="sm" variant="ghost" icon={Icon.phone(14)}>
          Call Owner
        </Button>
      </div>
    </FrameMock>
  );
}

/* ===== F4 mock — dashboard three-column ===== */
function F4Mock() {
  const cols = [
    {
      h: "Today",
      items: [
        { t: "09:00 · Milo", s: "Brief ready", dot: C.green },
        { t: "09:30 · Luna", s: "New patient", dot: C.hint },
        { t: "10:00 · Rex", s: "Post-op check", dot: C.amber },
      ],
    },
    {
      h: "Follow-up",
      items: [
        { t: "2 escalations", s: "Doctor review", dot: C.red },
        { t: "3 monitor", s: "One-tap confirm", dot: C.amber },
        { t: "12 recovered", s: "Auto-closed", dot: C.green },
      ],
    },
    {
      h: "This month",
      items: [
        { t: "47h saved", s: "Across 2 doctors", dot: C.green },
        { t: "RM 9,200", s: "Billing recovered", dot: C.green },
        { t: "3 caught", s: "Complications", dot: C.amber },
      ],
    },
  ];
  return (
    <FrameMock label="Doctor Dashboard · Realtime" accent={C.brand}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 0,
          borderLeft: `1px solid ${C.borderSoft}`,
        }}
      >
        {cols.map((c, i) => (
          <div
            key={i}
            style={{
              borderRight: `1px solid ${C.borderSoft}`,
              padding: "0 14px",
            }}
          >
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10.5,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                color: C.muted,
                paddingBottom: 10,
                borderBottom: `1px solid ${C.borderSoft}`,
              }}
            >
              {c.h}
            </div>
            {c.items.map((it, j) => (
              <div
                key={j}
                style={{
                  padding: "12px 0",
                  borderBottom:
                    j < c.items.length - 1
                      ? `1px solid ${C.borderSoft}`
                      : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: C.text,
                    fontWeight: 500,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: it.dot,
                      display: "inline-block",
                    }}
                  />
                  {it.t}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                  {it.s}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </FrameMock>
  );
}

/* ===== F5 mock — feedback loop ===== */
function F5Mock() {
  return (
    <FrameMock label="Doctor Feedback · One tap" accent={C.brand}>
      <div
        style={{
          fontSize: 13,
          color: C.muted,
          marginBottom: 14,
          fontFamily: FONT_MONO,
          letterSpacing: 0.2,
        }}
      >
        GLM output
      </div>
      <div
        style={{
          padding: "12px 14px",
          border: BORDER_HAIRLINE,
          borderRadius: 8,
          fontSize: 14,
          color: C.text,
          marginBottom: 16,
          fontFamily: FONT_MONO,
        }}
      >
        Triage · MONITOR · 72% confidence
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <Button size="sm" icon={Icon.check(14)}>
          Correct
        </Button>
        <Button size="sm" variant="ghost">
          Wrong — wrong triage
        </Button>
      </div>
      <RuleLine style={{ margin: "0 0 14px" }} />
      <div
        style={{
          fontSize: 12,
          color: C.muted,
          lineHeight: 1.55,
        }}
      >
        <span style={{ color: C.green }}>●</span> Doctor correction logged.
        Injected as few-shot context into the next 5 triage calls for this
        clinic.
      </div>
    </FrameMock>
  );
}

/* ===== F6 mock — pet passport ===== */
function F6Mock() {
  return (
    <FrameMock label="Pet Passport · consilium.app/passport/milo-0142">
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: -0.4,
            }}
          >
            Milo&apos;s Health Passport
          </div>
          <div
            style={{
              fontSize: 12,
              color: C.muted,
              marginTop: 2,
              fontFamily: FONT_MONO,
            }}
          >
            {CLINIC.name} · Updated 20 Apr 2026
          </div>
        </div>
        <div
          aria-hidden
          style={{
            width: 46,
            height: 46,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            background:
              "repeating-conic-gradient(#0F172A 0% 25%, #F4F2ED 0% 50%) 50% / 8px 8px",
          }}
        />
      </div>
      <KV k="Vaccinations" v="Up to date — next Aug 2026" />
      <KV k="Active meds" v="Otomax — Day 3 of 7" />
      <KV k="Last diagnosis" v="Ear infection — recovering" />
      <KV k="Notes" v="Check right ear, declined dental ×2" />
      <KV k="Emergency" v={`${CLINIC.name} · ${CLINIC.phone}`} />
    </FrameMock>
  );
}

function FeaturesSection() {
  return (
    <section id="product">
      <div
        style={{
          maxWidth: MAX_W,
          margin: "0 auto",
          padding: "100px 32px 0",
        }}
      >
        <Reveal>
          <h2
            style={{
              fontFamily: FONT_SERIF,
              fontWeight: 500,
              fontSize: "clamp(32px, 3.8vw, 46px)",
              lineHeight: 1.1,
              letterSpacing: -0.9,
              color: C.text,
              margin: "0 0 16px",
              maxWidth: 760,
            }}
          >
            Six features. One continuous{" "}
            <em style={{ fontStyle: "italic", color: C.brand }}>
              decision loop
            </em>
            .
          </h2>
          <p
            style={{
              fontSize: 16,
              color: C.muted,
              lineHeight: 1.6,
              margin: "0 0 24px",
              maxWidth: 640,
            }}
          >
            Everything below is built around one principle: the GLM is
            non-removable. Strip it out and you&apos;re left with a Telegram bot
            that says &ldquo;call the clinic.&rdquo;
          </p>
        </Reveal>
      </div>

      <div
        style={{
          maxWidth: MAX_W,
          margin: "0 auto",
          padding: "0 32px",
          borderTop: BORDER_HAIRLINE,
        }}
      >
        <FeatureRow
          id="f1"
          n="F1 / 01"
          when="Before the consult"
          title="A 5-line brief, read from years of free text."
          body="Consilium reads unstructured visit notes, lab results, billing history, past prescriptions — and distills a trajectory the doctor can absorb in the 10 seconds before knocking on the exam-room door."
          impact="80 min / day saved per doctor"
          mock={<F1Mock />}
        />
        <FeatureRow
          n="F2 / 02"
          when="During the consult"
          title="Talk. It writes everything you owe the record — and the till."
          body="One dictation returns four artifacts: a SOAP note, a prescription with dosing, a billing checklist that flags items mentioned-but-unbilled in amber, and a staff to-do list. Doctor approves, edits, or rejects per card."
          impact="~RM 10,000 / clinic / month recovered"
          mock={<F2Mock />}
          reverse
        />
        <FeatureRow
          n="F3 / 03"
          when="After the consult"
          title="The triage that reads between the lines."
          body="24–48h later, a Telegram message goes out. Replies come back in the owner's own words. The GLM classifies all-clear, monitor, or escalate — with differentials, confidence, recommended action, and a draft response. Doctor only sees what needs them."
          impact="94% triage accuracy · <10s per escalation"
          mock={<F3Mock />}
          hero
        />
        <FeatureRow
          n="F4 / 04"
          when="Always on"
          title="A three-column morning. One screen, zero refresh."
          body="Today's schedule, follow-up queue, and the month's KPIs — updated live via Supabase Realtime. Escalation cards appear without a page refresh. The doctor walks in and knows the state of the clinic in one glance."
          impact="Realtime · no page refresh"
          mock={<F4Mock />}
          reverse
        />
        <FeatureRow
          n="F5 / 05"
          when="Per clinic"
          title="Corrections become clinic-specific context — instantly."
          body="One tap says the GLM was right or wrong. Rejections are logged and injected as few-shot examples into the next call — so the accuracy improves per clinic without any model retraining and without ever touching base-model weights."
          impact="Clinic-specific · zero training data exposure"
          mock={<F5Mock />}
        />
        <FeatureRow
          n="F6 / 06"
          when="The x-factor"
          title="A shareable pet passport. The growth loop, on a QR."
          body="After every visit, the patient's passport auto-updates at a public URL. Owners share it with boarding, travel, or any vet. Every scan surfaces Consilium. No extra doctor work, no paper vaccination cards."
          impact="1 scan = 1 referral opportunity"
          mock={<F6Mock />}
          reverse
        />
      </div>
    </section>
  );
}

/* ───────────────────────── closing CTA ───────────────────────── */

function ClosingCTA() {
  return (
    <section
      style={{
        background: C.bgAlt,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.45,
          maskImage:
            "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 55%, rgba(0,0,0,0) 90%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 55%, rgba(0,0,0,0) 90%)",
        }}
      >
        <DotField
          dotRadius={1.2}
          dotSpacing={28}
          cursorRadius={240}
          bulgeOnly
          bulgeStrength={32}
          glowColor="transparent"
          glowRadius={0}
          gradientFrom="rgba(15,23,42,0.22)"
          gradientTo="rgba(15,23,42,0.22)"
        />
      </div>
      <div
        style={{
          position: "relative",
          maxWidth: MAX_W,
          margin: "0 auto",
          padding: "120px 32px",
          textAlign: "center",
        }}
      >
        <RuleLine style={{ margin: "0 auto 56px", maxWidth: 520 }} />
        <Reveal>
          <p
            style={{
              fontFamily: FONT_SERIF,
              fontSize: "clamp(28px, 3.6vw, 44px)",
              lineHeight: 1.22,
              letterSpacing: -0.6,
              color: C.text,
              margin: "0 auto 36px",
              maxWidth: "28ch",
              fontWeight: 500,
            }}
          >
            Consilium briefs you{" "}
            <em style={{ fontStyle: "italic", color: C.brand }}>before</em>{" "}
            every consult, structures the record{" "}
            <em style={{ fontStyle: "italic", color: C.brand }}>during</em> it,
            and watches every patient{" "}
            <em style={{ fontStyle: "italic", color: C.brand }}>after</em> they
            go home — so the only cases on your desk are the ones that need
            you.
          </p>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Link href="/dashboard" style={{ textDecoration: "none" }}>
              <Button
                size="lg"
                iconRight={Icon.arrow(16)}
                style={{
                  background: C.brand,
                  color: "#FFFFFF",
                  boxShadow: "none",
                }}
              >
                Open the Dashboard
              </Button>
            </Link>
            <Link href="/consult" style={{ textDecoration: "none" }}>
              <Button size="lg" variant="ghost">
                See a consultation
              </Button>
            </Link>
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 13,
              color: C.hint,
              fontFamily: FONT_MONO,
              letterSpacing: 0.2,
            }}
          >
            No login · live demo clinic · synthetic data
          </div>
        </Reveal>
        <RuleLine style={{ margin: "56px auto 0", maxWidth: 520 }} />
      </div>
    </section>
  );
}

/* ───────────────────────── footer ───────────────────────── */

function Footer() {
  return (
    <footer style={{ background: C.bg }}>
      <div
        style={{
          maxWidth: MAX_W,
          margin: "0 auto",
          padding: "56px 32px 32px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)",
            gap: 48,
            alignItems: "start",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: FONT_SERIF,
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: -0.5,
                color: C.text,
              }}
            >
              Consilium
            </div>
            <div
              style={{
                fontFamily: FONT_SERIF,
                fontStyle: "italic",
                fontSize: 13,
                color: C.muted,
                marginTop: 6,
              }}
            >
              n. medical council — a small group convened to advise.
            </div>
            <p
              style={{
                fontSize: 14,
                color: C.muted,
                lineHeight: 1.6,
                margin: "18px 0 0",
                maxWidth: 360,
              }}
            >
              An AI decision copilot for solo vet clinics. Built in Kuala
              Lumpur. UMHackathon 2026 entry.
            </p>
          </div>

          <div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                color: C.muted,
                marginBottom: 14,
              }}
            >
              Product
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <a
                href="#product"
                style={{
                  fontSize: 14,
                  color: C.text,
                  textDecoration: "none",
                }}
              >
                Features
              </a>
              <Link
                href="/dashboard"
                style={{
                  fontSize: 14,
                  color: C.text,
                  textDecoration: "none",
                }}
              >
                Dashboard
              </Link>
            </div>
          </div>

          <div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                color: C.muted,
                marginBottom: 14,
              }}
            >
              Team
            </div>
            <div
              style={{
                display: "grid",
                gap: 8,
                fontSize: 14,
                color: C.muted,
                lineHeight: 1.5,
              }}
            >
              <div>Brandon · AI engineer</div>
              <div>Zi Qian · Software</div>
              <div>Yu Han · Data</div>
              <div>Shawn · Frontend + PM</div>
              <div>Harrison · Domain &amp; QA</div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 48,
            paddingTop: 22,
            borderTop: BORDER_HAIRLINE,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 12,
            color: C.hint,
            fontFamily: FONT_MONO,
            letterSpacing: 0.3,
          }}
        >
          <span>© 2026 Consilium Labs Sdn Bhd</span>
          <span style={{ flex: 1 }} />
          <span>Made for vets who&apos;d rather treat pets than type notes</span>
        </div>
      </div>
    </footer>
  );
}

/* ───────────────────────── root ───────────────────────── */

export default function LandingPage() {
  const mouseRef = useRef<MousePosition>({ x: 0.5, y: 0.45 });
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const wrapperStyle: CSSProperties = {
    minHeight: "100vh",
    background: C.bg,
    color: C.text,
  };

  return (
    <div style={wrapperStyle}>
      <TopNav />
      <Hero mouseRef={mouseRef} />
      <ProblemStrip />
      <ThesisBlock />
      <FeaturesSection />
      <ClosingCTA />
      <Footer />
    </div>
  );
}
