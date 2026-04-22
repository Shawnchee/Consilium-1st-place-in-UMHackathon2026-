/**
 * Smoke test for the mock GLM client.
 *
 * Run:  npx tsx scripts/test-glm.ts
 *
 * Exercises each feature and prints the canned output. No network — safe
 * to run in CI. When Phase 5-real lands, this same script will hit Z.AI
 * without any changes (requires ZAI_API_KEY in env).
 */

import { callGLM } from "../lib/glm";
import type { Brief, ConsultOutput } from "../lib/types";
import type { TriageFixtureOutput } from "../lib/glm-fixtures";

async function main() {
  console.log("\n=== brief ===");
  const brief = await callGLM<Brief>({
    feature: "brief",
    user: "Patient: Milo, 4yo Golden Retriever, here for ear recheck.",
    context: { patientName: "Milo" },
  });
  console.log(`source=${brief.source}  latency=${brief.latencyMs}ms`);
  console.log(brief.data);

  console.log("\n=== consult ===");
  const consult = await callGLM<ConsultOutput>({
    feature: "consult",
    user: "4yo MN Golden Retriever, limping right hind 2 weeks. Partial CCL suspected.",
  });
  console.log(`source=${consult.source}  latency=${consult.latencyMs}ms`);
  console.log("  SOAP.A:", consult.data.soap.A);
  console.log("  prescriptions:", consult.data.prescription.length);
  console.log("  billing rows:", consult.data.billing.length);
  console.log(
    "  flagged billing:",
    consult.data.billing.filter((b) => b.flagged).length,
  );

  const triageCases: Array<{ label: string; msg: string }> = [
    {
      label: "red-flag",
      msg:
        "She's been lying there and won't touch her food since morning. The wound looks a bit red too.",
    },
    {
      label: "clear",
      msg: "All good! Back to his crazy self, eating like a horse. Thanks doc!",
    },
    {
      label: "monitor",
      msg:
        "Stool is firmer today, still a bit soft. Appetite back to normal. Drinking well.",
    },
  ];

  for (const c of triageCases) {
    console.log(`\n=== triage: ${c.label} ===`);
    // Force toolCallCount=1 so the fixture gives a decision (skip the
    // multi-turn info-gathering branch — that's covered in the bot smoke).
    const t = await callGLM<TriageFixtureOutput>({
      feature: "triage",
      user: c.msg,
      context: { toolCallCount: 1 },
    });
    console.log(`source=${t.source}  latency=${t.latencyMs}ms`);
    if (t.data.kind === "decision") {
      console.log(`  decision=${t.data.decision}  confidence=${t.data.confidence}`);
      console.log(`  action: ${t.data.recommendedAction}`);
    } else {
      console.log(`  tool_call=${t.data.tool}  reason=${t.data.reasoning}`);
    }
  }

  console.log("\n=== triage: tool-call (ambiguous first turn) ===");
  const tool = await callGLM<TriageFixtureOutput>({
    feature: "triage",
    user: "She has some blood on her bed",
    context: { toolCallCount: 0, patientName: "Milo" },
  });
  if (tool.data.kind === "tool_call") {
    console.log(`  tool=${tool.data.tool}`);
    console.log(`  prompt: ${tool.data.ownerPrompt}`);
  } else {
    console.log(`  unexpected terminal decision: ${tool.data.decision}`);
  }

  console.log("\n=== few-shot hook ===");
  await callGLM({
    feature: "triage",
    user: "Coco is drooling blood from the extraction site.",
    context: {
      corrections: [
        { glm: "MONITOR", fix: "ESCALATE — socket breakdown on Day 1" },
      ],
    },
  });

  console.log("\nAll smoke checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
