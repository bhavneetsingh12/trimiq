// server/entitlements.js
const { supabaseAdmin } = require("./supabaseAdmin");

async function getEntitlements(userId) {
  const { data, error } = await supabaseAdmin
    .from("user_entitlements")
    .select("plan, trial_ends_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  // If no row exists, treat as free
  return data || { plan: "free", trial_ends_at: null };
}

module.exports = { getEntitlements };
