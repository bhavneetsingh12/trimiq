import { useAppTheme } from "@/src/theme/useAppTheme";
import type { Session } from "@supabase/supabase-js";
import { detectSubscriptionsFromTransactions } from "@/src/lib/subscriptionDetection";
import { Redirect, router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { supabase } from "../../src/lib/supabase";

export default function Home() {
  const colors = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [subs, setSubs] = useState<any[]>([]);

  const displayName =
    session?.user?.user_metadata?.full_name ||
    session?.user?.user_metadata?.name ||
    session?.user?.email?.split("@")[0] ||
    "Welcome";

 useEffect(() => {
  let mounted = true;

  supabase.auth.getSession().then(({ data }) => {
    if (!mounted) return;

    if (__DEV__) {
      console.log("SESSION:", data.session ? "present" : "missing");
      console.log("USER:", data.session?.user?.email ?? "none");
    }

    setSession(data.session ?? null);
    setLoading(false);
  });

  const { data: sub } = supabase.auth.onAuthStateChange(
    (_event, newSession) => {
      if (__DEV__) {
        console.log("AUTH STATE CHANGED:", newSession ? "session present" : "no session");
      }
      setSession(newSession);
    }
  );

  return () => {
    mounted = false;
    sub?.subscription?.unsubscribe();
  };
}, []);

  useEffect(() => {
    const run = async () => {
      if (!session?.user?.id) return;

      await supabase.from("profiles").upsert({
        id: session.user.id,
        email: session.user.email,
        full_name:
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          null,
      });
    };

    run();
  }, [session?.user?.id]);

  const loadSubscriptions = async () => {
    if (!session?.user?.id) return;

    const userId = session.user.id;

    const { data, error } = await supabase
      .from("subscriptions")
      .select(
        "id, display_name, cadence, avg_amount, last_charge_date, charge_count, confidence"
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

  useEffect(() => {
    if (session?.user?.id) loadSubscriptions();
  }, [session?.user?.id]);

  const seedDemoTransactions = async () => {
    if (!session?.user?.id) return;

    setMsg("Seeding demo transactions…");

    const userId = session.user.id;
    const today = new Date();
    const daysAgo = (n: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - n);
      return d.toISOString().slice(0, 10);
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
      onConflict: "user_id,plaid_item_id,plaid_transaction_id",
    });

    if (error) {
      setMsg("Seed failed: " + error.message);
      return;
    }

    setMsg("✅ Demo transactions added. Now click Find Recurring Bills.");
  };

  const detectSubscriptions = async () => {
    if (!session?.user?.id) return;

    setMsg("Detecting recurring bills…");

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
      setMsg("No transactions found. Click Refresh Transactions first.");
      return;
    }

    const candidates = detectSubscriptionsFromTransactions(
  txs as {
    date: string;
    name: string;
    amount: number;
    plaid_item_id?: string | null;
  }[],
  userId
);

    if (candidates.length === 0) {
      setMsg("❌ No recurring bills found. Seed demo data, then try again.");
      return;
    }

    const { error: upErr } = await supabase.from("subscriptions").upsert(
      candidates,
      {
        onConflict: "user_id,plaid_item_id,merchant_key",
      }
    );

    if (upErr) {
      setMsg("Detect failed (write): " + upErr.message);
      return;
    }

    setMsg(`✅ Detected ${candidates.length} recurring subscriptions.`);
    await loadSubscriptions();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Your Money Dashboard</Text>
      <Text style={styles.pageSubtitle}>
        Track subscriptions, spot waste, and get smarter money guidance.
      </Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Welcome back</Text>
        <Text style={styles.heroEmail}>{displayName}</Text>
      </View>

      <Pressable
        onPress={() => router.push("/(tabs)/connect-bank")}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>Add Bank Account</Text>
      </Pressable>

      <View style={styles.buttonSpacer} />

      <Pressable onPress={seedDemoTransactions} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Refresh Transactions</Text>
      </Pressable>

      <View style={styles.buttonSpacer} />

      <Pressable onPress={detectSubscriptions} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Find Recurring Bills</Text>
      </Pressable>

      {!!msg && <Text style={styles.messageText}>{msg}</Text>}

      <Text style={styles.sectionTitle}>Recurring Bills & Subscriptions</Text>

      {subs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No recurring subscriptions detected yet.
          </Text>
        </View>
      ) : (
        subs.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => router.push(`/subscription/${s.id}`)}
            style={styles.subscriptionCard}
          >
            <Text style={styles.subscriptionTitle}>{s.display_name}</Text>

            <Text style={styles.subscriptionMeta}>
              {s.cadence} • ${Number(s.avg_amount).toFixed(2)} • last:{" "}
              {s.last_charge_date}
            </Text>

            <Text style={styles.subscriptionMetaSecondary}>
              {s.charge_count} charges • {s.confidence}% match confidence
            </Text>

            <Text style={styles.subscriptionLink}>View recurring charges</Text>
          </Pressable>
        ))
      )}

      <View style={styles.footerSpacer} />

      <Pressable
        onPress={async () => {
          setMsg("");
          const { error } = await supabase.auth.signOut();
          if (error) {
            setMsg(error.message);
            return;
          }
          router.replace("/login");
        }}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryButtonText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

function getStyles(colors: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 20,
      paddingBottom: 36,
    },
    loadingContainer: {
      flex: 1,
      padding: 20,
      backgroundColor: colors.background,
      justifyContent: "center",
    },
    loadingText: {
      color: colors.text,
      fontSize: 16,
    },
    pageTitle: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.text,
    },
    pageSubtitle: {
      marginTop: 6,
      color: colors.subtext,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 16,
    },
    heroCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 16,
      marginBottom: 16,
    },
    heroEyebrow: {
      color: colors.subtext,
      fontSize: 13,
      marginBottom: 4,
    },
    heroEmail: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    primaryButton: {
      backgroundColor: colors.primaryDark,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: "center",
    },
    primaryButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
    },
    secondaryButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: "center",
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    buttonSpacer: {
      height: 10,
    },
    sectionTitle: {
      fontWeight: "800",
      fontSize: 18,
      color: colors.text,
      marginTop: 22,
      marginBottom: 12,
    },
    subscriptionCard: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 14,
      marginBottom: 12,
    },
    subscriptionTitle: {
      fontWeight: "800",
      color: colors.text,
      fontSize: 16,
      marginBottom: 6,
    },
    subscriptionMeta: {
      color: colors.subtext,
      fontSize: 14,
      lineHeight: 20,
    },
    subscriptionMetaSecondary: {
      color: colors.subtext,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 2,
    },
    subscriptionLink: {
      marginTop: 10,
      color: colors.primaryDark,
      fontWeight: "700",
      fontSize: 14,
    },
    emptyCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
    },
    emptyText: {
      color: colors.subtext,
      fontSize: 15,
    },
    messageText: {
      color: colors.text,
      marginTop: 14,
      marginBottom: 6,
      fontSize: 14,
    },
    footerSpacer: {
      height: 10,
    },
  });
}