import type { Session } from "@supabase/supabase-js";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { supabase } from "../../src/lib/supabase";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [msg, setMsg] = useState("");
  const [subs, setSubs] = useState<any[]>([]);

  // ✅ Detect session on app load + subscribe to auth changes
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      },
    );

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // ✅ Ensure profiles row exists (optional)
  useEffect(() => {
    const run = async () => {
      if (!session?.user?.id) return;
      await supabase.from("profiles").upsert({ id: session.user.id });
    };
    run();
  }, [session?.user?.id]);

  const loadSubscriptions = async () => {
    if (!session?.user?.id) return;

    const userId = session.user.id;

    const { data, error } = await supabase
      .from("subscriptions")
      .select(
        "id, display_name, cadence, avg_amount, last_charge_date, charge_count, confidence",
      )
      .eq("user_id", userId)
      .eq("ignored", false)
      .order("confidence", { ascending: false });

    if (error) {
      setMsg("Load subscriptions failed: " + error.message);
      return;
    }

    setSubs(data ?? []);
  };

  // Auto-load subs when session exists
  useEffect(() => {
    if (session?.user?.id) loadSubscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const seedDemoTransactions = async () => {
    if (!session?.user?.id) return;

    setMsg("Seeding demo transactions…");

    const userId = session.user.id;
    const today = new Date();
    const daysAgo = (n: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - n);
      return d.toISOString().slice(0, 10); // YYYY-MM-DD
    };

    const demo = [
      { name: "NETFLIX.COM", amount: 15.49, date: daysAgo(2) },
      { name: "NETFLIX.COM", amount: 15.49, date: daysAgo(33) },
      { name: "NETFLIX.COM", amount: 15.49, date: daysAgo(64) },

      { name: "SPOTIFY", amount: 10.99, date: daysAgo(5) },
      { name: "SPOTIFY", amount: 10.99, date: daysAgo(36) },
      { name: "SPOTIFY", amount: 10.99, date: daysAgo(67) },

      { name: "APPLE.COM/BILL", amount: 2.99, date: daysAgo(8) },
      { name: "APPLE.COM/BILL", amount: 2.99, date: daysAgo(39) },
      { name: "APPLE.COM/BILL", amount: 2.99, date: daysAgo(70) },

      { name: "LA FITNESS", amount: 35.0, date: daysAgo(10) },
      { name: "LA FITNESS", amount: 35.0, date: daysAgo(40) },
      { name: "LA FITNESS", amount: 35.0, date: daysAgo(71) },

      { name: "STARBUCKS", amount: 6.25, date: daysAgo(1) },
      { name: "SAFEWAY", amount: 42.18, date: daysAgo(3) },
      { name: "SHELL OIL", amount: 55.12, date: daysAgo(6) },
    ].map((t, i) => ({
      user_id: userId,
      plaid_item_id: "demo_item",
      plaid_transaction_id: `demo_${userId}_${i}_${t.date}_${t.amount}`,
      date: t.date,
      name: t.name,
      merchant_name: null,
      amount: t.amount,
      iso_currency_code: "USD",
      pending: false,
    }));

    const { error } = await supabase.from("transactions").upsert(demo, {
      onConflict: "plaid_transaction_id",
    });

    if (error) {
      setMsg("Seed failed: " + error.message);
      return;
    }

    setMsg("✅ Demo transactions added. Now click Detect Subscriptions.");
  };

  const detectSubscriptions = async () => {
    if (!session?.user?.id) return;

    setMsg("Detecting subscriptions…");

    const userId = session.user.id;

    const { data: txs, error: txErr } = await supabase
      .from("transactions")
      .select("date,name,amount,plaid_item_id")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(500);

    if (txErr) {
      setMsg("Detect failed (fetch): " + txErr.message);
      return;
    }
    if (!txs || txs.length === 0) {
      setMsg("No transactions found. Click Sync Transactions first.");
      return;
    }

    const normalize = (s: string) =>
      s
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    type Tx = { date: string; name: string; amount: number };
    const byMerchant = new Map<string, Tx[]>();

    for (const t of txs as Tx[]) {
      const key = normalize(t.name);
      if (!byMerchant.has(key)) byMerchant.set(key, []);
      byMerchant.get(key)!.push(t);
    }

    const candidates: any[] = [];

    for (const [merchantKey, list] of byMerchant.entries()) {
      if (list.length < 3) continue;

      const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
      const dates = sorted.map((x) => new Date(x.date));
      const amounts = sorted.map((x) => Number(x.amount));

      const intervals: number[] = [];
      for (let i = 1; i < dates.length; i++) {
        const diff =
          (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
        intervals.push(Math.round(diff));
      }

      const avgInterval = Math.round(
        intervals.reduce((a, b) => a + b, 0) / intervals.length,
      );

      const cadence =
        avgInterval >= 27 && avgInterval <= 33
          ? "monthly"
          : avgInterval >= 6 && avgInterval <= 8
            ? "weekly"
            : avgInterval >= 13 && avgInterval <= 16
              ? "biweekly"
              : "irregular";

      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const stable = amounts.every(
        (x) => Math.abs(x - avgAmount) <= avgAmount * 0.15,
      );

      let confidence = 50;
      if (cadence !== "irregular") confidence += 25;
      if (stable) confidence += 25;
      if (list.length >= 4) confidence += 5;
      if (confidence > 95) confidence = 95;

      if (confidence < 70) continue;

      const displayName =
        merchantKey
          .split(" ")
          .slice(0, 3)
          .join(" ")
          .replace("COM", "")
          .trim() || merchantKey;

      candidates.push({
        user_id: userId,
        merchant_key: merchantKey,
        display_name: displayName,
        cadence,
        avg_amount: Number(avgAmount.toFixed(2)),
        first_seen_date: sorted[0].date,
        last_charge_date: sorted[sorted.length - 1].date,
        charge_count: sorted.length,
        confidence,
        detection_source: "rules",
        evidence: {
          intervals,
          sample_amounts: amounts.slice(0, 5),
          plaid_item_id:
            (sorted[sorted.length - 1] as any).plaid_item_id ?? null,
        },

        updated_at: new Date().toISOString(),
        plaid_item_id: (sorted[sorted.length - 1] as any).plaid_item_id ?? null,
      });
    }

    if (candidates.length === 0) {
      setMsg("❌ No subscriptions detected. Seed demo → then Detect again.");
      return;
    }

    const { error: upErr } = await supabase
      .from("subscriptions")
      .upsert(candidates, { onConflict: "user_id,merchant_key" });

    if (upErr) {
      setMsg("Detect failed (write): " + upErr.message);
      return;
    }

    setMsg(`✅ Detected ${candidates.length} subscriptions.`);
    await loadSubscriptions();
  };

  // ---------------- UI ----------------

  if (loading) {
    return (
      <View style={{ padding: 20 }}>
        <Text>Loading…</Text>
      </View>
    );
  }

  // ✅ If logged in → show dashboard
  if (session) {
    return (
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 28, fontWeight: "800" }}>
          TrimIQ Dashboard
        </Text>
        <Text style={{ opacity: 0.7, marginTop: 6 }}>
          Signed in as: {session.user.email}
        </Text>

        <View style={{ height: 12 }} />

        <Pressable
          onPress={() => router.push("/(tabs)/connect-bank")}
          style={{ backgroundColor: "#111", padding: 14, borderRadius: 12 }}
        >
          <Text style={{ color: "white", textAlign: "center" }}>
            Connect Bank
          </Text>
        </Pressable>

        <View style={{ height: 10 }} />

        <Pressable
          onPress={seedDemoTransactions}
          style={{ backgroundColor: "#111", padding: 14, borderRadius: 12 }}
        >
          <Text style={{ color: "white", textAlign: "center" }}>
            Sync Transactions
          </Text>
        </Pressable>

        <View style={{ height: 10 }} />

        <Pressable
          onPress={detectSubscriptions}
          style={{ backgroundColor: "#111", padding: 14, borderRadius: 12 }}
        >
          <Text style={{ color: "white", textAlign: "center" }}>
            Detect Subscriptions
          </Text>
        </Pressable>

        <View style={{ height: 18 }} />

        <Text style={{ fontWeight: "800", fontSize: 18 }}>
          Recurring Subscriptions
        </Text>

        <View style={{ height: 10 }} />

        {subs.length === 0 ? (
          <Text style={{ opacity: 0.7 }}>No subscriptions detected yet.</Text>
        ) : (
          subs.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => router.push(`/subscription/${s.id}`)}
              style={{
                borderWidth: 1,
                borderColor: "#eee",
                borderRadius: 12,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <Text style={{ fontWeight: "800" }}>{s.display_name}</Text>

              <Text style={{ opacity: 0.75 }}>
                {s.cadence} • ${Number(s.avg_amount).toFixed(2)} • last:{" "}
                {s.last_charge_date}
              </Text>

              <Text style={{ opacity: 0.6 }}>
                {s.charge_count} charges • confidence {s.confidence}%
              </Text>

              <Text style={{ marginTop: 6, opacity: 0.7 }}>
                Tap for details →
              </Text>
            </Pressable>
          ))
        )}

        <View style={{ height: 8 }} />
        {!!msg && <Text style={{ marginTop: 10 }}>{msg}</Text>}

        <View style={{ height: 12 }} />

        <Pressable
          onPress={async () => {
            setMsg("");
            const { error } = await supabase.auth.signOut();
            setMsg(error ? error.message : "Signed out");
          }}
          style={{ backgroundColor: "#111", padding: 14, borderRadius: 12 }}
        >
          <Text style={{ color: "white", textAlign: "center" }}>Log out</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ✅ If NOT logged in → show login
  return (
    <View style={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: "800" }}>TrimIQ MVP</Text>
      <Text style={{ opacity: 0.7 }}>
        Detect recurring subscriptions from your transactions (no auto-cancel).
      </Text>

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          borderRadius: 12,
          padding: 12,
        }}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          borderRadius: 12,
          padding: 12,
        }}
      />

      <Pressable
        onPress={async () => {
          setMsg("");
          const { error } = await supabase.auth.signUp({ email, password });
          setMsg(error ? error.message : "Signed up. Now log in.");
        }}
        style={{ backgroundColor: "#111", padding: 14, borderRadius: 12 }}
      >
        <Text style={{ color: "white", textAlign: "center" }}>Sign up</Text>
      </Pressable>

      <Pressable
        onPress={async () => {
          setMsg("");
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          setMsg(error ? error.message : "Logged in ✅");
        }}
        style={{ backgroundColor: "#111", padding: 14, borderRadius: 12 }}
      >
        <Text style={{ color: "white", textAlign: "center" }}>Log in</Text>
      </Pressable>

      {!!msg && <Text>{msg}</Text>}
    </View>
  );
}
