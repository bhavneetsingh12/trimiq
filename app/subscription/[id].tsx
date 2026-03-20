import { useAppTheme } from "@/src/theme/useAppTheme";
import { Stack, router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  evidence?: any;
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

function getCancelGuide(displayName: string) {
  const k = normalize(displayName);

  const guides: Record<string, string> = {
    NETFLIX: [
      "Netflix help:",
      "1) Open Netflix in a browser.",
      "2) Go to Account.",
      "3) Open Membership & Billing.",
      "4) Choose Cancel Membership and confirm.",
    ].join("\n"),

    SPOTIFY: [
      "Spotify help:",
      "1) Open spotify.com in a browser.",
      "2) Go to Account.",
      "3) Open Your Plan.",
      "4) Choose Change Plan, then cancel Premium.",
    ].join("\n"),

    APPLE: [
      "Apple subscription help:",
      "1) On iPhone: Settings → Apple ID → Subscriptions.",
      "2) Select the subscription.",
      "3) Choose Cancel Subscription.",
      "Or on Mac: App Store → Account Settings → Subscriptions.",
    ].join("\n"),

    "LA FITNESS": [
      "LA Fitness help:",
      "Cancellation steps can vary by location and membership type.",
      "A club visit or written request may be required.",
      "If you want, we can make this more specific later by state.",
    ].join("\n"),
  };

  if (k.includes("NETFLIX")) return guides.NETFLIX;
  if (k.includes("SPOTIFY")) return guides.SPOTIFY;
  if (k.includes("APPLE")) return guides.APPLE;
  if (k.includes("LA FITNESS") || (k.includes("LA") && k.includes("FITNESS"))) {
    return guides["LA FITNESS"];
  }

  return [
    "Merchant help:",
    "No saved help steps are available for this merchant yet.",
    "You can still review the recent recurring charges below.",
  ].join("\n");
}

export default function SubscriptionDetail() {
  const colors = useAppTheme();
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

    if ((subData as any).user_id !== userId) {
      setMsg("You don’t have access to this subscription.");
      setLoading(false);
      return;
    }

    const s = subData as SubRow;
    setSub(s);

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

    const evidenceItemId =
      s.evidence?.plaid_item_id || s.evidence?.recent?.[0]?.plaid_item_id || null;

    const dnNorm = normalize(s.display_name);
    const dnParts = dnNorm.split(" ").filter(Boolean).slice(0, 3);

    const filtered = (txData ?? []).filter((t: any) => {
      const nameNorm = normalize(t.name);

      if (mkNorm && nameNorm === mkNorm) {
        if (evidenceItemId && t.plaid_item_id) {
          return String(t.plaid_item_id) === String(evidenceItemId);
        }
        return true;
      }

      if (evidenceItemId && t.plaid_item_id) {
        if (String(t.plaid_item_id) !== String(evidenceItemId)) return false;
      }

      if (dnParts.length === 0) return false;
      return dnParts.every((p) => nameNorm.includes(p));
    });

    setTxs(filtered as TxRow[]);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [idStr]);

  const setIgnored = async (ignored: boolean) => {
    if (!sub?.id) return;

    setMsg("");

    const { error } = await supabase
      .from("subscriptions")
      .update({ ignored })
      .eq("id", sub.id);

    if (error) {
      setMsg((ignored ? "Update" : "Restore") + " failed: " + error.message);
      return;
    }

    setMsg(ignored ? "Hidden from analysis." : "Restored to analysis.");
    await refresh();
  };

  return (
  <>
    <Stack.Screen
      options={{
        headerShown: false,
      }}
    />

    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      >
        <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingTop:12, paddingBottom: 40 }}
    >
      <Pressable
        onPress={() => router.back()}
        style={{
          alignSelf: "flex-start",
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          marginBottom: 16,
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontWeight: "600",
          }}
        >
          ← Back
        </Text>
      </Pressable>

      {loading ? (
        <View style={{ paddingTop: 30 }}>
          <ActivityIndicator color={colors.primaryDark} />
          <Text
            style={{
              marginTop: 10,
              color: colors.subtext,
              fontSize: 15,
            }}
          >
            Loading…
          </Text>
        </View>
      ) : !sub ? (
        <View style={{ paddingTop: 10 }}>
          <Text
            style={{
              fontSize: 22,
              fontWeight: "800",
              color: colors.text,
            }}
          >
            Subscription not found
          </Text>

          {!!msg && (
            <Text
              style={{
                marginTop: 8,
                color: colors.subtext,
              }}
            >
              {msg}
            </Text>
          )}
        </View>
      ) : (
        <>
          <Text
            style={{
              fontSize: 30,
              fontWeight: "800",
              color: colors.text,
              marginBottom: 14,
            }}
          >
            {sub.display_name}
          </Text>

          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              borderRadius: 20,
              padding: 18,
              marginBottom: 14,
            }}
          >
            <Text
              style={{
                fontSize: 22,
                fontWeight: "700",
                color: colors.primaryDark,
                marginBottom: 10,
              }}
            >
              ${Number(sub.avg_amount ?? 0).toFixed(2)} {sub.cadence}
            </Text>

            <Text
              style={{
                color: colors.subtext,
                fontSize: 15,
                lineHeight: 22,
                marginBottom: 4,
              }}
            >
              Last charge:{" "}
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {sub.last_charge_date}
              </Text>
            </Text>

            <Text
              style={{
                color: colors.subtext,
                fontSize: 15,
                lineHeight: 22,
                marginBottom: 4,
              }}
            >
              Recurring charges detected:{" "}
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {sub.charge_count}
              </Text>
            </Text>

            <Text
              style={{
                color: colors.subtext,
                fontSize: 15,
                lineHeight: 22,
              }}
            >
              Detection confidence:{" "}
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {sub.confidence}%
              </Text>
            </Text>
          </View>

          <Pressable
            onPress={() => setIgnored(!sub.ignored)}
            style={{
              backgroundColor: colors.primaryDark,
              padding: 16,
              borderRadius: 16,
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                textAlign: "center",
                fontWeight: "700",
                fontSize: 16,
              }}
            >
              {sub.ignored ? "Restore to analysis" : "Hide from analysis"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setShowCancel((v) => !v)}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: 16,
              borderRadius: 16,
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                textAlign: "center",
                fontWeight: "700",
                fontSize: 16,
                color: colors.text,
              }}
            >
              {showCancel ? "Hide" : "View"} merchant help
            </Text>
          </Pressable>

          {showCancel && (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                borderRadius: 18,
                padding: 16,
                marginBottom: 14,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 15,
                  lineHeight: 24,
                }}
              >
                {getCancelGuide(sub.display_name)}
              </Text>
            </View>
          )}

          <Text
            style={{
              fontWeight: "800",
              fontSize: 22,
              color: colors.text,
              marginTop: 8,
              marginBottom: 12,
            }}
          >
            Charge history
          </Text>

          {txs.length === 0 ? (
            <Text
              style={{
                color: colors.subtext,
                fontSize: 15,
              }}
            >
              No matching transactions found yet.
            </Text>
          ) : (
            txs.map((t, idx) => (
              <View
                key={`${t.date}-${t.amount}-${idx}`}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    fontWeight: "800",
                    color: colors.text,
                    fontSize: 16,
                    marginBottom: 4,
                  }}
                >
                  {t.name}
                </Text>

                <Text
                  style={{
                    color: colors.subtext,
                    fontSize: 15,
                    lineHeight: 22,
                  }}
                >
                  {t.date} • ${Number(t.amount ?? 0).toFixed(2)}
                </Text>
              </View>
            ))
          )}

          {!!msg && (
            <Text
              style={{
                marginTop: 10,
                color: colors.subtext,
                fontSize: 14,
              }}
            >
              {msg}
            </Text>
          )}
        </>
      )}
    </ScrollView>
    </SafeAreaView>
  </>
);
}
