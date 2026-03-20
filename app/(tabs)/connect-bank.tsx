import { API_BASE, apiFetch } from "@/src/lib/api";
import type { LinkExit, LinkSuccess } from "@/src/lib/plaid";
import { useAppTheme } from "@/src/theme/useAppTheme";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { create, destroy, open } from "../../src/lib/plaid";

export default function ConnectBank() {
  const router = useRouter();
  const colors = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/plaid/create_link_token", {
          method: "POST",
        });

        let json: any = null;
        try {
          json = await res.json();
        } catch {
          const text = await res.text();
          if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
          throw new Error("Unexpected non-JSON response from server");
        }

        if (!res.ok) {
          throw new Error(json?.error || `HTTP ${res.status}`);
        }

        if (!json?.link_token) throw new Error("No link token returned");

        setLinkToken(json.link_token);
      } catch (e: any) {
        Alert.alert(
          "Server error",
          e?.message ?? "Failed to create link token",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openPlaid = async () => {
    if (!linkToken) return;

    try {
      setOpening(true);

      await destroy();
      create({ token: linkToken, noLoadingState: false });

      open({
        onSuccess: async (success: LinkSuccess) => {
          try {
            const res = await apiFetch("/plaid/exchange_public_token", {
              method: "POST",
              body: JSON.stringify({ public_token: success.publicToken }),
            });

            const text = await res.text();
            if (!res.ok) {
              if (res.status === 401) {
                throw new Error(
                  "Not logged in. Please sign in first so we can securely link your bank.",
                );
              }
              throw new Error(text || `HTTP ${res.status}`);
            }

            const syncRes = await apiFetch("/plaid/sync_all", {
              method: "POST",
              body: JSON.stringify({}),
            });

            const syncText = await syncRes.text();
            if (!syncRes.ok) {
              if (syncRes.status === 401) {
                throw new Error(
                  "Not logged in. Please sign in first so we can sync your transactions.",
                );
              }
              throw new Error(syncText || `HTTP ${syncRes.status}`);
            }

            Alert.alert(
              "Connected",
              "Your bank was linked and your transactions were synced.",
            );
            router.back();
          } catch (e: any) {
            Alert.alert("Link failed", e?.message ?? "Unknown error");
          }
        },

        onExit: (exit: LinkExit) => {
          console.log("Plaid exit:", exit);
        },
      });
    } catch (e: any) {
      Alert.alert("Plaid error", e?.message ?? "Failed to open Plaid");
    } finally {
      setOpening(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.pageTitle}>Link your bank</Text>
        <Text style={styles.pageSubtitle}>
          Securely preparing your connection.
        </Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>Preparing Plaid…</Text>
          <Text style={styles.metaText}>Server: {API_BASE}</Text>
        </View>
      </View>
    );
  }

  if (!linkToken) {
    return (
      <View style={styles.container}>
        <Text style={styles.pageTitle}>Link your bank</Text>
        <Text style={styles.pageSubtitle}>
          We could not start the secure bank connection.
        </Text>

        <View style={styles.infoCard}>
          <Text style={styles.errorTitle}>No link token available</Text>
          <Text style={styles.metaText}>
            This usually means the server route
            {" "}
            /plaid/create_link_token
            {" "}
            is not reachable.
          </Text>
        </View>

        <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Maybe Later</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Link your bank</Text>
      <Text style={styles.pageSubtitle}>
        Securely connect an account to track spending, subscriptions, and savings opportunities.
      </Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoText}>Powered by Plaid secure bank linking.</Text>
        <Text style={styles.metaText}>
          Your transactions will sync after the connection is complete.
        </Text>
      </View>

      <Pressable
        onPress={openPlaid}
        disabled={opening}
        style={[styles.primaryButton, opening && styles.primaryButtonDisabled]}
      >
        <Text style={styles.primaryButtonText}>
          {opening ? "Opening…" : "Link Bank Account"}
        </Text>
      </Pressable>

      <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Maybe Later</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 24,
    },
    pageTitle: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "800",
      marginBottom: 8,
    },
    pageSubtitle: {
      color: colors.subtext,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 20,
    },
    infoCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
      marginBottom: 18,
    },
    infoText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 6,
    },
    metaText: {
      color: colors.subtext,
      fontSize: 14,
      lineHeight: 20,
    },
    errorTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
      marginBottom: 6,
    },
    primaryButton: {
      backgroundColor: colors.primaryDark,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: "center",
      marginBottom: 12,
    },
    primaryButtonDisabled: {
      opacity: 0.6,
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
  });