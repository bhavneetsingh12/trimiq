import { useAppTheme } from "@/src/theme/useAppTheme";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getAiInsights, sendAiChat } from "../../src/lib/api";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function cleanAiText(text: string) {
  return text
    .replace(/#{1,6}\s?/g, "")
    .replace(/\*\*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function AIInsights() {
  const colors = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [insightText, setInsightText] = useState("");
  const [input, setInput] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi — I’m your LedgerMind AI Coach. I can help you understand recurring charges, spending patterns, and budgeting options.",
    },
  ]);

  useEffect(() => {
    console.log("AI exports check", {
      hasGetAiInsights: typeof getAiInsights,
      hasSendAiChat: typeof sendAiChat,
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadInitialInsights = async () => {
      try {
        setErr(null);
        setLoadingInsights(true);

        const json = await getAiInsights();

        if (!mounted) return;

        setData(json);
        setInsightText(json?.insight || json?.narrative || "");
      } catch (e: any) {
        if (mounted) {
          setErr(e?.message || "AI insights failed");
        }
      } finally {
        if (mounted) {
          setLoadingInsights(false);
        }
      }
    };

    loadInitialInsights();

    return () => {
      mounted = false;
    };
  }, []);

  const handleRefreshInsights = async () => {
    try {
      setLoadingInsights(true);
      setErr(null);

      const json = await getAiInsights();

      setData(json);
      setInsightText(json?.insight || json?.narrative || "");
    } catch (e: any) {
      setErr(e?.message || "Failed to refresh AI insights");
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loadingChat) return;

    const updatedMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];

    setMessages(updatedMessages);
    setInput("");
    setLoadingChat(true);

    try {
      const financialContext = {
        summary: data?.summary || {},
        scenarios: data?.scenarios || [],
        top_subscriptions: data?.top_subscriptions || [],
      };

      const response = await sendAiChat({
        message: trimmed,
        conversation: updatedMessages,
        financialContext,
      });

      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: response?.reply || "No reply returned.",
        },
      ]);
    } catch (e: any) {
      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: `Error: ${e?.message || "Failed to send message"}`,
        },
      ]);
    } finally {
      setLoadingChat(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={110}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>AI Coach</Text>
        <Text style={styles.subtitle}>
          AI-generated budgeting insights for informational and planning purposes only.
        </Text>

        {err ? <Text style={styles.errorText}>{err}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Snapshot</Text>

          {loadingInsights ? (
            <ActivityIndicator style={{ marginTop: 12 }} color={colors.primaryDark} />
          ) : !data ? (
            <Text style={styles.placeholderText}>No data available yet.</Text>
          ) : (
            <>
              <Text style={styles.statText}>
                Monthly recurring charges: $
                {Number(
                  data?.summary?.monthly_subscriptions_estimate ?? 0,
                ).toFixed(2)}
              </Text>

              <Text style={styles.statText}>
                Debt balance: $
                {Number(data?.summary?.total_debt_balance ?? 0).toFixed(2)}
              </Text>

              <Text style={styles.statText}>
                Active subscriptions:{" "}
                {Number(data?.summary?.subscriptions_count ?? 0)}
              </Text>

              <Text style={styles.statText}>
                Debt accounts: {Number(data?.summary?.debts_count ?? 0)}
              </Text>
            </>
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={handleRefreshInsights}
            disabled={loadingInsights}
          >
            <Text style={styles.buttonText}>
              {loadingInsights ? "Updating..." : "Update Analysis"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>AI Coach Summary</Text>

          {insightText ? (
            <Text style={styles.insightText}>{cleanAiText(insightText)}</Text>
          ) : (
            <Text style={styles.placeholderText}>
              No narrative insight returned yet.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Budget Scenarios</Text>
          <Text style={styles.helperText}>
            If recurring-charge spend were redirected to each debt:
          </Text>

          <View style={{ height: 10 }} />

          {(data?.scenarios || []).length === 0 ? (
            <Text style={styles.placeholderText}>No budget scenarios yet.</Text>
          ) : (
            (data?.scenarios || []).map((s: any, index: number) => (
              <View
                key={s.debt_id ?? s.id ?? `${s.name ?? "scenario"}-${index}`}
                style={styles.scenarioCard}
              >
                <Text style={styles.scenarioTitle}>
                  {s.name || "Debt Scenario"}
                </Text>

                <Text style={styles.scenarioText}>
                  Balance: ${Number(s.balance ?? 0).toFixed(2)}
                </Text>

                <Text style={styles.scenarioText}>
                  Redirected monthly amount: $
                  {Number(s.extra_from_subscriptions_monthly ?? 0).toFixed(2)}
                </Text>

                <Text style={styles.scenarioText}>
                  Estimated months:{" "}
                  {s.est_months_if_redirect_all_subs ?? "Need APR/min payment"}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Chat with AI Coach</Text>

          <View style={styles.chatBox}>
            {messages.map((msg, index) => (
              <View
                key={`${msg.role}-${index}`}
                style={[
                  styles.messageBubble,
                  msg.role === "user"
                    ? styles.userBubble
                    : styles.assistantBubble,
                ]}
              >
                <Text style={styles.messageRole}>
                  {msg.role === "user" ? "You" : "LedgerMind AI Coach"}
                </Text>
                <Text
                  style={[
                    styles.messageText,
                    msg.role === "user"
                      ? styles.userMessageText
                      : styles.assistantMessageText,
                  ]}
                >
                  {msg.content}
                </Text>
              </View>
            ))}

            {loadingChat ? <ActivityIndicator style={{ marginTop: 12 }} color={colors.primaryDark} /> : null}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Ask about recurring charges, spending patterns, or budgeting options..."
            placeholderTextColor={colors.subtext}
            value={input}
            onChangeText={setInput}
            multiline
          />

          <TouchableOpacity
            style={styles.button}
            onPress={handleSend}
            disabled={loadingChat}
          >
            <Text style={styles.buttonText}>
              {loadingChat ? "Sending..." : "Send"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      padding: 20,
      paddingBottom: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.text,
    },
    subtitle: {
      marginTop: 6,
      marginBottom: 16,
      color: colors.subtext,
      fontSize: 14,
      lineHeight: 20,
    },
    errorText: {
      color: colors.danger,
      marginBottom: 12,
      fontSize: 14,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: "700",
      marginBottom: 12,
      color: colors.text,
    },
    statText: {
      marginTop: 6,
      fontSize: 15,
      color: colors.text,
      lineHeight: 22,
    },
    helperText: {
      marginTop: 2,
      color: colors.subtext,
      fontSize: 14,
      lineHeight: 20,
    },
    button: {
      backgroundColor: colors.primaryDark,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 16,
      alignItems: "center",
      marginTop: 14,
    },
    buttonText: {
      color: "#FFFFFF",
      fontWeight: "700",
      fontSize: 15,
    },
    insightText: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
    },
    placeholderText: {
      fontSize: 14,
      color: colors.subtext,
    },
    scenarioCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      backgroundColor: colors.surface,
    },
    scenarioTitle: {
      fontWeight: "800",
      color: colors.text,
      marginBottom: 4,
      fontSize: 15,
    },
    scenarioText: {
      color: colors.subtext,
      marginTop: 2,
      fontSize: 14,
      lineHeight: 20,
    },
    chatBox: {
      marginBottom: 12,
    },
    messageBubble: {
      borderRadius: 14,
      padding: 12,
      marginBottom: 10,
    },
    userBubble: {
      backgroundColor: colors.primaryDark,
    },
    assistantBubble: {
      backgroundColor: colors.mutedSurface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    messageRole: {
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 4,
      color: colors.subtext,
    },
    messageText: {
      fontSize: 15,
      lineHeight: 21,
    },
    userMessageText: {
      color: "#FFFFFF",
    },
    assistantMessageText: {
      color: colors.text,
    },
    input: {
      minHeight: 52,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.inputBackground,
      color: colors.text,
      textAlignVertical: "top",
      marginBottom: 10,
    },
  });