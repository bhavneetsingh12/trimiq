import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("⚠️ SUPABASE_SERVICE_ROLE_KEY missing — using ANON key (dev mode)");
}

const FEATURE_MAP = {
  export_excel: ["starter", "pro"],
  ai_insights: ["starter", "pro"],
  ai_chat: ["pro"],
  alerts: ["pro"],
  full_history: ["starter", "pro"],
};

export default function requireFeature(featureKey) {
  return async (req, res, next) => {
    if (!req.userId) return res.status(401).send("Not authenticated");

    const { data, error } = await supabaseAdmin
      .from("user_entitlements")
      .select("plan, trial_ends_at")
      .eq("user_id", req.userId)
      .maybeSingle();

    if (error) return res.status(500).send(error.message);

    const plan = data?.plan || "free";
    const allowed = FEATURE_MAP[featureKey] || [];

    const inTrial =
      !!data?.trial_ends_at && new Date(data.trial_ends_at).getTime() > Date.now();

    if (!allowed.includes(plan) && !inTrial) {
      return res
        .status(402)
        .send(`Upgrade required to access ${featureKey.replace("_", " ")}.`);
    }

    next();
  };
}