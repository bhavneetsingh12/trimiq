import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { supabase } from "../../src/lib/supabase";

type SubRow = {
  id: string;
  user_id: string;
  display_name: string;
  cadence: string;
  avg_amount: number;
  last_charge_date: string;
  first_seen_date?: string | null;
  charge_count: number;
  confidence: number;
  merchant_key?: string | null;
  ignored?: boolean;
  evidence?: any; // jsonb in supabase
};

type TxRow = {
  date: string;
  name: string;
  amount: number;
  plaid_item_id?: string | null;
};

function normalize(s: string) {
  return String(s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cached cancel instructions (no OpenAI yet). Add more anytime. */
function getCancelGuide(displayName: string) {
  const k = normalize(displayName);

  const guides: Record<string, string> = {
    NETFLIX: [
      "Netflix cancel (typical):",
      "1) Open Netflix (web is easiest).",
      "2) Account → Membership & Billing → Cancel Membership.",
      "3) Confirm cancellation. You can keep watching until billing period ends.",
    ].join("\n"),

    SPOTIFY: [
      "Spotify cancel (typical):",
      "1) Open spotify.com (web).",
      "2) Account → Your plan → Change plan.",
      "3) Scroll down → Cancel Premium → Confirm.",
    ].join("\n"),

    APPLE: [
      "Apple subscriptions cancel:",
      "1) iPhone: Settings → Apple ID → Subscriptions.",
      "2) Tap the subscription → Cancel Subscription.",
      "OR",
      "Mac: App Store → Account Settings → Subscriptions → Manage → Cancel.",
    ].join("\n"),

    "LA FITNESS": [
      "LA Fitness cancel (varies by state/club):",
      "Common options: in-club cancellation or written cancellation form.",
      "If you want, tell me your state and I’ll make this exact.",
    ].join("\n"),
  };

  // match “APPLE BILL”, “APPLE.COM/BILL” → APPLE, etc.
  if (k.includes("NETFLIX")) return guides.NETFLIX;
  if (k.includes("SPOTIFY")) return guides.SPOTIFY;
  if (k.includes("APPLE")) return guides.APPLE;
  if (k.includes("LA FITNESS") || (k.includes("LA") && k.includes("FITNESS")))
    return guides["LA FITNESS"];

  return [
    "Cancel instructions (cached):",
    "No guide saved for this merchant yet.",
    "Tell me the exact merchant name and I’ll add a reusable guide for it.",
  ].join("\n");
}

export default function SubscriptionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const idStr = useMemo(() => (Array.isArray(id) ? id[0] : id) ?? "", [id]);

  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<SubRow | null>(null);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [msg, setMsg] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setMsg("");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user?.id;

    if (!userId) {
      setMsg("Not logged in. Go back and log in.");
      setLoading(false);
      return;
    }
    if (!idStr) {
      setMsg("Missing subscription id.");
      setLoading(false);
      return;
    }

    // 1) load subscription row
    const { data: subData, error: subErr } = await supabase
      .from("subscriptions")
      .select(
        "id,user_id,display_name,cadence,avg_amount,last_charge_date,first_seen_date,charge_count,confidence,merchant_key,ignored,evidence",
      )
      .eq("id", idStr)
      .single();

    if (subErr) {
      setMsg("Failed to load subscription: " + subErr.message);
      setLoading(false);
      return;
    }

    // safety: ensure it's the same user (RLS should already enforce)
    if ((subData as any).user_id !== userId) {
      setMsg("You don’t have access to this subscription.");
      setLoading(false);
      return;
    }

    const s = subData as SubRow;
    setSub(s);

    // 2) load transactions and filter them
    const { data: txData, error: txErr } = await supabase
      .from("transactions")
      .select("date,name,amount,plaid_item_id")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(800);

    if (txErr) {
      setMsg("Failed to load transactions: " + txErr.message);
      setLoading(false);
      return;
    }

    const mkNorm = s.merchant_key ? normalize(s.merchant_key) : null;

    // If we stored a representative plaid_item_id in evidence, use it
    const evidenceItemId =
      s.evidence?.plaid_item_id ||
      s.evidence?.recent?.[0]?.plaid_item_id ||
      null;

    const dnNorm = normalize(s.display_name);
    const dnParts = dnNorm.split(" ").filter(Boolean).slice(0, 3);

    const filtered = (txData ?? []).filter((t: any) => {
      const nameNorm = normalize(t.name);

      // Best: exact merchant_key match
      if (mkNorm && nameNorm === mkNorm) {
        // if item id known, optionally tighten it
        if (evidenceItemId && t.plaid_item_id)
          return String(t.plaid_item_id) === String(evidenceItemId);
        return true;
      }

      // If we know plaid_item_id, prioritize it
      if (evidenceItemId && t.plaid_item_id) {
        if (String(t.plaid_item_id) !== String(evidenceItemId)) return false;
      }

      // fallback: all display-name parts appear in transaction name
      if (dnParts.length === 0) return false;
      return dnParts.every((p) => nameNorm.includes(p));
    });

    setTxs(filtered as TxRow[]);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idStr]);

  const setIgnored = async (ignored: boolean) => {
    if (!sub?.id) return;
    setMsg("");
    const { error } = await supabase
      .from("subscriptions")
      .update({ ignored })
      .eq("id", sub.id);

    if (error) {
      setMsg((ignored ? "Ignore" : "Unignore") + " failed: " + error.message);
      return;
    }

    setMsg(ignored ? "✅ Ignored (won’t show in list)." : "✅ Unignored.");
    await refresh();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Pressable
        onPress={() => router.back()}
        style={{
          alignSelf: "flex-start",
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "#eee",
        }}
      >
        <Text>← Back</Text>
      </Pressable>

      {loading ? (
        <View style={{ paddingTop: 30 }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10, opacity: 0.7 }}>Loading…</Text>
        </View>
      ) : !sub ? (
        <View style={{ paddingTop: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: "800" }}>
            Subscription not found
          </Text>
          {!!msg && <Text style={{ marginTop: 8 }}>{msg}</Text>}
        </View>
      ) : (
        <>
          <Text style={{ fontSize: 28, fontWeight: "800" }}>
            {sub.display_name}
          </Text>

          <View
            style={{
              borderWidth: 1,
              borderColor: "#eee",
              borderRadius: 12,
              padding: 12,
              gap: 6,
            }}
          >
            <Text style={{ opacity: 0.75 }}>
              Cadence: <Text style={{ fontWeight: "700" }}>{sub.cadence}</Text>
            </Text>

            <Text style={{ opacity: 0.75 }}>
              Avg amount:{" "}
              <Text style={{ fontWeight: "700" }}>
                ${Number(sub.avg_amount ?? 0).toFixed(2)}
              </Text>
            </Text>

            <Text style={{ opacity: 0.75 }}>
              Last charge:{" "}
              <Text style={{ fontWeight: "700" }}>{sub.last_charge_date}</Text>
            </Text>

            <Text style={{ opacity: 0.75 }}>
              Charges:{" "}
              <Text style={{ fontWeight: "700" }}>{sub.charge_count}</Text>
            </Text>

            <Text style={{ opacity: 0.75 }}>
              Confidence:{" "}
              <Text style={{ fontWeight: "700" }}>{sub.confidence}%</Text>
            </Text>

            {!!sub.merchant_key && (
              <Text style={{ opacity: 0.6 }}>
                merchant_key: {sub.merchant_key}
              </Text>
            )}
          </View>

          {/* Ignore / Unignore */}
          <Pressable
            onPress={() => setIgnored(!sub.ignored)}
            style={{
              backgroundColor: "#111",
              padding: 14,
              borderRadius: 12,
              marginTop: 4,
            }}
          >
            <Text style={{ color: "white", textAlign: "center" }}>
              {sub.ignored ? "Unignore" : "Ignore"} this subscription
            </Text>
          </Pressable>

          {/* Cancel instructions (cached) */}
          <Pressable
            onPress={() => setShowCancel((v) => !v)}
            style={{
              borderWidth: 1,
              borderColor: "#eee",
              padding: 14,
              borderRadius: 12,
            }}
          >
            <Text style={{ textAlign: "center", fontWeight: "700" }}>
              {showCancel ? "Hide" : "Show"} cancel instructions
            </Text>
          </Pressable>

          {showCancel && (
            <View
              style={{
                borderWidth: 1,
                borderColor: "#eee",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <Text style={{ whiteSpace: "pre-wrap" as any }}>
                {getCancelGuide(sub.display_name)}
              </Text>
            </View>
          )}

          {/* Charge history */}
          <Text style={{ fontWeight: "800", fontSize: 18, marginTop: 10 }}>
            Charge history
          </Text>

          {txs.length === 0 ? (
            <Text style={{ opacity: 0.7 }}>
              No matching transactions found yet.
            </Text>
          ) : (
            txs.map((t, idx) => (
              <View
                key={`${t.date}-${t.amount}-${idx}`}
                style={{
                  borderWidth: 1,
                  borderColor: "#eee",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 10,
                }}
              >
                <Text style={{ fontWeight: "800" }}>{t.name}</Text>
                <Text style={{ opacity: 0.75 }}>
                  {t.date} • ${Number(t.amount ?? 0).toFixed(2)}
                </Text>
              </View>
            ))
          )}

          {!!msg && <Text style={{ marginTop: 10 }}>{msg}</Text>}
        </>
      )}
    </ScrollView>
  );
}
