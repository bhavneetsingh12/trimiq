import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

console.log(
  "requireFeature.js SUPABASE_URL:",
  JSON.stringify(process.env.SUPABASE_URL),
);
console.log(
  "requireFeature.js SUPABASE_ANON_KEY:",
  process.env.SUPABASE_ANON_KEY ? "SET" : "MISSING",
);

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "⚠️ SUPABASE_SERVICE_ROLE_KEY missing — using ANON key (dev mode)",
  );
}

const FEATURE_MAP = {
  export_excel: ["pro", "premium"],
  ai_assistant: ["premium"],
};

export default function requireFeature(featureKey) {
  return async (req, res, next) => {
    if (!req.userId) return res.status(401).send("Not authenticated");

    const { data, error } = await supabaseAdmin
      .from("user_entitlements")
      .select("plan,trial_ends_at")
      .eq("user_id", req.userId)
      .maybeSingle();

    if (error) return res.status(500).send(error.message);

    const plan = data?.plan || "free";
    const allowed = FEATURE_MAP[featureKey] || [];

    // allow trial if trial_ends_at in future (optional)
    const now = new Date();
    const inTrial = data?.trial_ends_at && new Date(data.trial_ends_at) > now;

    if (!allowed.includes(plan) && !inTrial) {
      return res.status(402).send("Upgrade required to export Excel.");
    }

    next();
  };
}
