import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import {
  create,
  destroy,
  LinkExit,
  LinkLogLevel,
  LinkSuccess,
  open,
} from "react-native-plaid-link-sdk";

const API_BASE = "http://10.0.2.2:3001"; // Android emulator -> your laptop localhost

export default function ConnectBank() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/plaid/create_link_token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        const text = await res.text();
        if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

        const json = JSON.parse(text);
        if (!json?.link_token) throw new Error("No link_token returned");

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

      // Good practice when retrying multiple times
      await destroy();

      // Step 1: preload Link
      create({ token: linkToken, noLoadingState: false });

      // Step 2: open Link UI
      open({
        onSuccess: async (success: LinkSuccess) => {
          try {
            const res = await fetch(`${API_BASE}/plaid/exchange_public_token`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ public_token: success.publicToken }),
            });

            const text = await res.text();
            if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

            Alert.alert("✅ Connected", "Access token saved on server.");
            router.back();
          } catch (e: any) {
            Alert.alert("Exchange failed", e?.message ?? "Unknown error");
          }
        },
        onExit: (exit: LinkExit) => {
          // user closed Plaid UI (or error)
          console.log("Plaid exit:", exit);
        },
        logLevel: LinkLogLevel.ERROR,
      });
    } catch (e: any) {
      Alert.alert("Plaid error", e?.message ?? "Failed to open Plaid");
    } finally {
      setOpening(false);
    }
  };

  if (loading) {
    return (
      <View style={{ padding: 20 }}>
        <Text>Preparing Plaid…</Text>
        <Text style={{ marginTop: 8, opacity: 0.7 }}>
          Contacting: {API_BASE}
        </Text>
      </View>
    );
  }

  if (!linkToken) {
    return (
      <View style={{ padding: 20 }}>
        <Text style={{ fontWeight: "700" }}>No link token</Text>
        <Text style={{ marginTop: 8, opacity: 0.7 }}>
          This usually means your server route /plaid/create_link_token is not
          reachable from the emulator.
        </Text>

        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: 14,
            backgroundColor: "#111",
            padding: 14,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "white", textAlign: "center" }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "800" }}>Connect Bank</Text>

      <Pressable
        onPress={openPlaid}
        disabled={opening}
        style={{
          backgroundColor: "#111",
          padding: 14,
          borderRadius: 12,
          opacity: opening ? 0.6 : 1,
        }}
      >
        <Text style={{ color: "white", textAlign: "center" }}>
          {opening ? "Opening…" : "Open Plaid Link"}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        style={{ backgroundColor: "#111", padding: 14, borderRadius: 12 }}
      >
        <Text style={{ color: "white", textAlign: "center" }}>Go Back</Text>
      </Pressable>
    </View>
  );
}
