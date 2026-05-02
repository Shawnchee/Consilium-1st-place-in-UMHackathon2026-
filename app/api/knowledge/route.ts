import { json, errorResponse } from "@/lib/api-response";
import { getSupabaseServer } from "@/lib/supabase";
import { ENV } from "@/lib/env";
import { parseUpdateKnowledgeRequest } from "@/lib/api-types";

/**
 * CLINIC KNOWLEDGE API
 * 
 * Direct Database Implementation. 
 * We read/write from the 'store' table used by LangGraph to ensure
 * total consistency between the Agent's memory and the Doctor's Dashboard.
 */

async function getKnowledgeFromDb() {
  const supabase = getSupabaseServer();
  const ns = `clinic_knowledge.${ENV.clinic.id}`;
  
  const { data, error } = await supabase
    .from("store")
    .select("key, value")
    .eq("prefix", ns);

  if (error) {
    console.error("[api/knowledge] DB query failed:", error.message);
    return { rules: [], trends: [], updatedAt: null };
  }

  const sops = data?.find(r => r.key === "master_sops")?.value || { rules: [] };
  const trends = data?.find(r => r.key === "clinic_trends")?.value || { trends: [] };

  return {
    rules: sops.rules || [],
    trends: trends.trends || [],
    updatedAt: sops.updated_at || trends.updated_at || null
  };
}

export async function GET() {
  return json(await getKnowledgeFromDb());
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = parseUpdateKnowledgeRequest(body);

    const supabase = getSupabaseServer();
    const prefix = `clinic_knowledge.${ENV.clinic.id}`;
    
    // We only update the Master SOPs (the rules) here.
    // Trends are updated by the nightly consolidation job.
    const value = {
      rules: validated.rules,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from("store")
      .upsert({ 
        prefix, 
        key: "master_sops", 
        value 
      }, { onConflict: "prefix,key" });

    if (error) return errorResponse(error);
    return json({ ok: true });
  } catch (err) {
    console.error("[api/knowledge] POST failed:", err);
    return errorResponse(err);
  }
}
