import { supabase } from "@/src/lib/supabase";
import { useAppTheme } from "@/src/theme/useAppTheme";
import type { Session } from "@supabase/supabase-js";
import { Redirect } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function LoginScreen() {
  const colors = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={styles.authContainer}>
      <Text style={styles.pageTitle}>LedgerMind MVP</Text>
      <Text style={styles.pageSubtitle}>
        Detect recurring subscriptions from your transactions.
      </Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor={colors.subtext}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor={colors.subtext}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      <Pressable
        onPress={async () => {
          setMsg("");
          const { error } = await supabase.auth.signUp({ email, password });
          setMsg(error ? error.message : "Signed up. Now log in.");
        }}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>Sign up</Text>
      </Pressable>

      <View style={styles.buttonSpacer} />

      <Pressable
        onPress={async () => {
          setMsg("");
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          setMsg(error ? error.message : "Logged in ✅");
        }}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>Log in</Text>
      </Pressable>

      {!!msg && <Text style={styles.messageText}>{msg}</Text>}
    </View>
  );
}

function getStyles(colors: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
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
    authContainer: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
      gap: 12,
      justifyContent: "center",
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
    buttonSpacer: {
      height: 10,
    },
    messageText: {
      color: colors.text,
      marginTop: 14,
      marginBottom: 6,
      fontSize: 14,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      color: colors.text,
      backgroundColor: colors.inputBackground,
    },
  });
}