// server/index.js
import { createClient } from "@supabase/supabase-js";
import cors from "cors";
import "dotenv/config";
import express from "express";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

import exportRoutes from "./export.js";
import openai from "./openaiClient.js";

const app = express();

app.use(cors());
app.use(express.json());

// --------------------
// Public routes FIRST
// --------------------
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "ledgermind-server" });
});

// --- Supabase (server-side auth lookup; ANON KEY is OK for getUser) ---
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);

// --- Supabase Admin (server-side DB writes; SERVICE ROLE key required) ---
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// TEMP encryption helpers (replace later with real crypto)
const encrypt = (s) => s;
const decrypt = (s) => s;

const AI_ENABLED = process.env.AI_ENABLED !== "false";

const LIMITS = {
  free: {
    chatPerDay: 5,
    insightsPerDay: 1,
    deepPerDay: 0,
  },
  starter: {
    chatPerDay: 10,
    insightsPerDay: 3,
    deepPerDay: 1,
  },
  pro: {
    chatPerDay: 30,
    insightsPerDay: 5,
    deepPerDay: 2,
  },
  admin: {
    chatPerDay: 100,
    insightsPerDay: 20,
    deepPerDay: 10,
  },
};

function chooseModel(planTier, type) {
  if (type === "insight") return "gpt-4.1-nano";
  if (type === "chat") {
    return planTier === "pro" || planTier === "admin"
      ? "gpt-5-mini"
      : "gpt-4.1-mini";
  }
  if (type === "deep") return "gpt-4.1-mini";
  return "gpt-4.1-mini";
}

async function getProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, ai_beta_access")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data || { id: userId, ai_beta_access: false };
}

async function getEntitlements(userId) {
  const { data, error } = await supabaseAdmin
    .from("user_entitlements")
    .select("plan, trial_ends_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data || { plan: "free", trial_ends_at: null };
}

async function getTodayUsage(userId) {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from("ai_usage_daily")
    .select("*")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .maybeSingle();

  if (error) throw new Error(error.message);

return (
  data || {
    user_id: userId,
    usage_date: today,
    chat_count: 0,
    insight_count: 0,
    deep_count: 0,
    updated_at: new Date().toISOString(),
  }
);
}

async function bumpUsage(userId, type) {
  const current = await getTodayUsage(userId);

  const next = {
    ...current,
    chat_count: current.chat_count || 0,
    insight_count: current.insight_count || 0,
    deep_count: current.deep_count || 0,
    updated_at: new Date().toISOString(),
  };

  if (type === "chat") next.chat_count += 1;
  if (type === "insight") next.insight_count += 1;
  if (type === "deep") next.deep_count += 1;

  const { error } = await supabaseAdmin.from("ai_usage_daily").upsert(next);

  if (error) throw new Error(error.message);
}

function ensureAiAllowed(profile, ent, usage, type) {
  if (!AI_ENABLED) {
    const err = new Error("AI is temporarily disabled.");
    err.status = 503;
    throw err;
  }

  if (!profile?.ai_beta_access) {
    const err = new Error("AI is currently in beta.");
    err.status = 403;
    throw err;
  }

  const plan = ent?.plan || "free";
  const limits = LIMITS[plan] || LIMITS.free;

  if (type === "chat" && (usage.chat_count || 0) >= limits.chatPerDay) {
    const err = new Error("Daily chat limit reached.");
    err.status = 429;
    throw err;
  }

  if (type === "insight" && (usage.insight_count || 0) >= limits.insightsPerDay) {
    const err = new Error("Daily insight refresh limit reached.");
    err.status = 429;
    throw err;
  }

  if (type === "deep" && (usage.deep_count || 0) >= limits.deepPerDay) {
    const err = new Error("Daily deep analysis limit reached.");
    err.status = 429;
    throw err;
  }
}

// --------------------
// Auth middleware
// Everything below requires a real Supabase USER access token
// --------------------
app.use(async (req, res, next) => {
  try {
    if (req.method === "OPTIONS") return next();

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: "Missing Authorization token" });
    }

    const { data, error } = await supabaseAuth.auth.getUser(token);

    if (error || !data?.user?.id) {
      return res.status(401).json({ error: "Invalid Authorization token" });
    }

    req.userId = data.user.id;
    next();
  } catch (_e) {
    return res.status(401).json({ error: "Unauthorized" });
  }
});

// --- Plaid ---
const env = process.env.PLAID_ENV || "sandbox";
const plaidEnv =
  env === "production"
    ? PlaidEnvironments.production
    : env === "development"
      ? PlaidEnvironments.development
      : PlaidEnvironments.sandbox;

const config = new Configuration({
  basePath: plaidEnv,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

const plaid = new PlaidApi(config);

console.log("✅ Server boot");
console.log("PLAID_ENV:", env);
console.log(
  "PLAID_CLIENT_ID:",
  process.env.PLAID_CLIENT_ID ? "SET" : "MISSING",
);
console.log("PLAID_SECRET:", process.env.PLAID_SECRET ? "SET" : "MISSING");
console.log("SUPABASE_URL:", process.env.SUPABASE_URL ? "SET" : "MISSING");
console.log(
  "SUPABASE_ANON_KEY:",
  process.env.SUPABASE_ANON_KEY ? "SET" : "MISSING",
);
console.log(
  "SUPABASE_SERVICE_ROLE_KEY:",
  process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "MISSING",
);
console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "SET" : "MISSING");

// Create link token
app.post("/plaid/create_link_token", async (req, res) => {
  try {
    const client_user_id = req.userId;

    const response = await plaid.linkTokenCreate({
      user: { client_user_id },
      client_name: "LedgerMind",
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
    });

    return res.json({ link_token: response.data.link_token });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

// Exchange public token + store access token + item metadata
app.post("/plaid/exchange_public_token", async (req, res) => {
  try {
    const userId = req.userId;
    const { public_token } = req.body;

    if (!public_token) {
      return res.status(400).json({ error: "Missing public_token" });
    }

    const exchange = await plaid.itemPublicTokenExchange({ public_token });

    const access_token = exchange.data.access_token;
    const plaid_item_id = exchange.data.item_id;

    let institution_name = null;

    try {
      const itemResp = await plaid.itemGet({ access_token });
      const instId = itemResp.data?.item?.institution_id;

      if (instId) {
        const instResp = await plaid.institutionsGetById({
          institution_id: instId,
          country_codes: ["US"],
        });
        institution_name = instResp.data?.institution?.name ?? null;
      }
    } catch (_e) {
      // ignore institution lookup failure
    }

    const access_token_enc = encrypt(access_token);

    const { error } = await supabaseAdmin.from("plaid_items").upsert(
      {
        user_id: userId,
        plaid_item_id,
        institution_name,
        access_token_enc,
        last_synced_at: null,
        plaid_cursor: null,
      },
      { onConflict: "user_id,plaid_item_id" },
    );

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ ok: true, plaid_item_id, institution_name });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

// Sync ALL items for this user
app.post("/plaid/sync_all", async (req, res) => {
  try {
    const userId = req.userId;

    const { data: items, error } = await supabaseAdmin
      .from("plaid_items")
      .select("plaid_item_id, access_token_enc, plaid_cursor")
      .eq("user_id", userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    for (const item of items || []) {
      const accessToken = decrypt(item.access_token_enc);

      let hasMore = true;
      let nextCursor = item.plaid_cursor || null;

      while (hasMore) {
        const resp = await plaid.transactionsSync({
          access_token: accessToken,
          cursor: nextCursor,
          count: 500,
        });

        const added = resp.data.added || [];
        const modified = resp.data.modified || [];
        const removed = resp.data.removed || [];

        hasMore = resp.data.has_more;
        nextCursor = resp.data.next_cursor;

        const rows = [...added, ...modified].map((t) => ({
          user_id: userId,
          plaid_item_id: item.plaid_item_id,
          plaid_transaction_id: t.transaction_id,
          date: t.date,
          name: t.name,
          merchant_name: t.merchant_name,
          amount: t.amount,
          iso_currency_code: t.iso_currency_code,
          pending: t.pending ?? false,
        }));

        if (rows.length) {
          const { error: upErr } = await supabaseAdmin
            .from("transactions")
            .upsert(rows, {
              onConflict: "user_id,plaid_item_id,plaid_transaction_id",
            });

          if (upErr) {
            return res.status(500).json({ error: upErr.message });
          }
        }

        if (removed.length) {
          const ids = removed.map((r) => r.transaction_id);

          const { error: delErr } = await supabaseAdmin
            .from("transactions")
            .delete()
            .eq("user_id", userId)
            .eq("plaid_item_id", item.plaid_item_id)
            .in("plaid_transaction_id", ids);

          if (delErr) {
            return res.status(500).json({ error: delErr.message });
          }
        }
      }

      const { error: updateErr } = await supabaseAdmin
        .from("plaid_items")
        .update({
          plaid_cursor: nextCursor,
          last_synced_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("plaid_item_id", item.plaid_item_id);

      if (updateErr) {
        return res.status(500).json({ error: updateErr.message });
      }
    }

    return res.json({ ok: true, items: items?.length || 0 });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

// ---- AI INSIGHTS ----
// Uses DB data + OpenAI summary
app.post("/ai/insights", async (req, res) => {
  try {
    const userId = req.userId;
    const profile = await getProfile(userId);
const ent = await getEntitlements(userId);
const usage = await getTodayUsage(userId);

ensureAiAllowed(profile, ent, usage, "insight");

const plan = ent?.plan || "free";
const model = chooseModel(plan, "insight");

    const { data: subs, error: subsErr } = await supabaseAdmin
      .from("subscriptions")
      .select("display_name,cadence,avg_amount,confidence,ignored,canceled")
      .eq("user_id", userId)
      .eq("ignored", false)
      .eq("canceled", false);

    if (subsErr) {
      return res.status(500).json({ error: subsErr.message });
    }

    const { data: debts, error: debtErr } = await supabaseAdmin
      .from("debts")
      .select("id,name,kind,balance,apr,minimum_payment,due_day")
      .eq("user_id", userId);

    if (debtErr) {
      return res.status(500).json({ error: debtErr.message });
    }

    const { data: txns, error: txnErr } = await supabaseAdmin
      .from("transactions")
      .select("date,name,merchant_name,amount,pending,iso_currency_code")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(100);

    if (txnErr) {
      return res.status(500).json({ error: txnErr.message });
    }

    const toMonthly = (cadence, amt) => {
      const a = Number(amt || 0);
      if (!a) return 0;
      if (cadence === "weekly") return (a * 52) / 12;
      if (cadence === "biweekly") return (a * 26) / 12;
      if (cadence === "monthly") return a;
      return a * 0.5;
    };

    const monthlySubs = (subs || []).reduce(
      (sum, s) => sum + toMonthly(s.cadence, s.avg_amount),
      0,
    );

    const totalDebt = (debts || []).reduce(
      (sum, d) => sum + Number(d.balance || 0),
      0,
    );

    const payoffMonths = (balance, apr, minPay, extraPay) => {
      balance = Number(balance || 0);
      minPay = Number(minPay || 0);
      extraPay = Number(extraPay || 0);

      if (balance <= 0) return 0;

      const pmt = Math.max(minPay + extraPay, 0);
      if (pmt <= 0) return null;

      if (!apr || apr <= 0) return Math.ceil(balance / pmt);

      const r = Number(apr) / 100 / 12;
      if (pmt <= balance * r) return null;

      const n = -Math.log(1 - (r * balance) / pmt) / Math.log(1 + r);
      return Math.ceil(n);
    };

    const scenarios = (debts || []).map((d) => ({
      debt_id: d.id,
      name: d.name,
      balance: Number(d.balance || 0),
      apr: d.apr,
      minimum_payment: d.minimum_payment,
      extra_from_subscriptions_monthly: Number(monthlySubs.toFixed(2)),
      est_months_if_redirect_all_subs: payoffMonths(
        d.balance,
        d.apr,
        d.minimum_payment,
        monthlySubs,
      ),
    }));

    let aiNarrative = null;

    try {
      const prompt = `
You are LedgerMind AI, a helpful personal finance assistant.

Rules:
- Use plain consumer-friendly language.
- Do not use markdown headings like ### or **.
- Do not invent currencies.
- Use "$" only unless a specific currency is explicitly required.
- Do not say CAD or USD unless the app explicitly asks for it.
- Keep the response polished and concise.
- Do not use markdown headings.
- Do not use ###, **, or numbered section titles.
- Write like polished app text.

Review the user's financial data and return:
1. A short financial summary
2. Top 3 spending concerns
3. Subscription savings opportunities
4. One practical next action

...

Subscription summary:
${JSON.stringify(subs || [], null, 2)}

Debt summary:
${JSON.stringify(debts || [], null, 2)}

Recent transactions:
${JSON.stringify((txns || []).slice(0, 100), null, 2)}

Computed metrics:
${JSON.stringify(
  {
    monthly_subscriptions_estimate: Number(monthlySubs.toFixed(2)),
    subscriptions_count: subs?.length || 0,
    total_debt_balance: Number(totalDebt.toFixed(2)),
    debts_count: debts?.length || 0,
    scenarios,
  },
  null,
  2,
)}
`;

     const response = await openai.responses.create({
  model,
  input: prompt,
  max_output_tokens: 350,
});

      aiNarrative = response.output_text;
    } catch (aiError) {
      console.error("AI insights generation error:", aiError);
    }
await bumpUsage(userId, "insight");

    return res.json({
      ok: true,
      summary: {
        monthly_subscriptions_estimate: Number(monthlySubs.toFixed(2)),
        subscriptions_count: subs?.length || 0,
        total_debt_balance: Number(totalDebt.toFixed(2)),
        debts_count: debts?.length || 0,
        note: "Estimates only. Not financial advice.",
      },
      scenarios,
      top_subscriptions: (subs || [])
        .slice()
        .sort((a, b) => Number(b.avg_amount || 0) - Number(a.avg_amount || 0))
        .slice(0, 10),
      insight: aiNarrative,
    });
  } catch (e) {
  return res.status(e?.status || 500).json({
    error: e?.message || "Failed to generate insights",
  });
}
});

// ---- AI CHAT ----
app.post("/ai/chat", async (req, res) => {
  try {
    const userId = req.userId;
    const profile = await getProfile(userId);
const ent = await getEntitlements(userId);
const usage = await getTodayUsage(userId);

ensureAiAllowed(profile, ent, usage, "chat");

const plan = ent?.plan || "free";
const model = chooseModel(plan, "chat");

    const { message, conversation = [], financialContext = {} } = req.body;

    if (!message) {
      return res.status(400).json({
        ok: false,
        error: "Message is required",
      });
    }

    const systemPrompt = `
You are LedgerMind AI, a smart and friendly financial assistant.
Help the user understand spending, subscriptions, budgeting, debt payoff, and savings.
Be practical, concise, and supportive.
Do not pretend to be a licensed financial advisor.
Use the provided financial context when relevant.

Rules:
- Use natural language only.
- Do not mention internal field names or raw JSON keys.
- Do not use markdown headings like ### or **.
- Keep answers short and complete.
- End cleanly.
- Do not end with unfinished questions like "Want me to..." unless you complete the sentence.
- Prefer one short paragraph and up to 3 bullets when useful.
`;

  const trimmedConversation = conversation.slice(-6);

const messagesText = trimmedConversation
  .map((m) => `${m.role?.toUpperCase?.() || "USER"}: ${m.content}`)
  .join("\n");

const friendlyFinancialContext = `
Monthly subscriptions estimate: $${Number(financialContext?.summary?.monthly_subscriptions_estimate ?? 0).toFixed(2)}
Total debt balance: $${Number(financialContext?.summary?.total_debt_balance ?? 0).toFixed(2)}
Subscription count: ${Number(financialContext?.summary?.subscriptions_count ?? 0)}
Debt count: ${Number(financialContext?.summary?.debts_count ?? 0)}
`;

const prompt = `
${systemPrompt}

User financial context:
${friendlyFinancialContext}

Conversation so far:
${messagesText}

Latest user message:
${message}
`;

    const response = await openai.responses.create({
  model,
  input: prompt,
  max_output_tokens: 500,
});

await bumpUsage(userId, "chat");

    return res.json({
      ok: true,
      reply: response.output_text,
    });
} catch (error) {
  console.error("Chat error:", error);
  return res.status(error?.status || 500).json({
    ok: false,
    error: error?.message || "Failed to generate chat reply",
  });
}
});

// Mount export routes
app.use("/export", exportRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on http://localhost:${PORT} (bound 0.0.0.0)`);
});

