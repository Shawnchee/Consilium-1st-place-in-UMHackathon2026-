/**
 * Smoke test for the mock GLM client.
 *
 * Run:  npx tsx scripts/test-glm.ts
 *
 * Exercises each feature and prints the canned output. No network in mock
 * mode. With ANTHROPIC_API_KEY set in .env, it hits Claude directly.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import type { Brief, ConsultOutput } from "../lib/types";
import type { TriageFixtureOutput } from "../lib/glm-fixtures";

async function main() {
  const { callGLM } = await import("../lib/glm");

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
    user: "4yo MN Golden Retriever, limping right hand 2 weeks. Partial CCL suspected. X-ray taken, e-collar recommended.",
  });
  console.log(`source=${consult.source}  latency=${consult.latencyMs}ms`);
  console.log("  SOAP.S:", consult.data.soap.S);
  console.log("  SOAP.A:", consult.data.soap.A);
  console.log("  SOAP.O:", consult.data.soap.O);
  console.log("  SOAP.P:", consult.data.soap.P);
  console.log("  prescriptions:", consult.data.prescription.length);
  console.log("  billing rows:", consult.data.billing.length);
  console.log(
    "  flagged billing:",
    consult.data.billing.filter((b) => b.flagged).length,
  );

  const TRIAGE_TOOLS = [
    {
      type: "function",
      function: {
        name: "request_media",
        description: "Ask the pet owner to send a photo or video of a specific area or symptom.",
        parameters: {
          type: "object",
          properties: {
            mediaType: {
              type: "string",
              enum: ["photo", "video", "either"],
              description: "The type of media required",
            },
            instruction: {
              type: "string",
              description: "Clear instructions for the owner (e.g. 'Take a clear photo of the red bump')",
            },
            reasoning: {
              type: "string",
              description: "Internal clinical justification for why this media is needed",
            },
            ownerPrompt: {
              type: "string",
              description: "Empathetic message to the owner explaining why we need the photo/video",
            },
          },
          required: ["mediaType", "instruction", "reasoning", "ownerPrompt"],
        },
      },
    },
  ];

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
    const t = await callGLM<TriageFixtureOutput>({
      feature: "triage",
      user: c.msg,
      tools: TRIAGE_TOOLS,
    });
    console.log(`source=${t.source}  latency=${t.latencyMs}ms`);
    
    if (t.data.kind === "decision") {
      console.log(`  decision=${t.data.decision}  confidence=${t.data.confidence}`);
      console.log(`  reasoning: ${t.data.reasoning}`);
      console.log(`  action: ${t.data.recommendedAction}`);
    } else {
      console.log(`  tool_call=${t.data.tool}  args=${JSON.stringify(t.data.args)}`);
      console.log(`  prompt: ${t.data.ownerPrompt}`);
    }
  }

  console.log("\n=== triage: tool-call (ambiguous blood sign) ===");
  const tool = await callGLM<TriageFixtureOutput>({
    feature: "triage",
    user: "She has some blood on her bed, but she seems okay otherwise.",
    tools: TRIAGE_TOOLS,
  });
  
  console.log(`source=${tool.source}  latency=${tool.latencyMs}ms`);
  if (tool.data.kind === "tool_call") {
    console.log(`  tool=${tool.data.tool}`);
    console.log(`  args=${JSON.stringify(tool.data.args)}`);
    console.log(`  prompt: ${tool.data.ownerPrompt}`);
  } else {
    console.log(`  unexpected terminal decision: ${tool.data.decision}`);
    console.log(`  reasoning: ${tool.data.reasoning}`);
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
