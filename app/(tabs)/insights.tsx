import { useAppTheme } from "@/src/theme/useAppTheme";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import {
    AIRecommendationCard,
    CategoryBreakdownChart,
    GoalProgressCard,
    HealthScoreCard,
    SpendingTrendChart,
    SubscriptionStackChart,
} from "../../components/insights";

export default function InsightsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const chartColors = useMemo(
    () => ({
      card: theme.surface,
      border: theme.border,
      text: theme.text,
      subtext: theme.subtext,
      primary: theme.primaryDark,
    }),
    [theme],
  );

  const score = 72;
  const delta = 4;

  const monthlyTrend = [
    { label: "Jan", value: 2900 },
    { label: "Feb", value: 3100 },
    { label: "Mar", value: 3480 },
    { label: "Apr", value: 3225 },
    { label: "May", value: 3050 },
    { label: "Jun", value: 2980 },
  ];

  const categoryTotals = [
    { name: "Subscriptions", amount: 481 },
    { name: "Food", amount: 690 },
    { name: "Fuel", amount: 220 },
    { name: "Shopping", amount: 310 },
    { name: "Bills", amount: 950 },
    { name: "Other", amount: 370 },
  ];

  const subscriptionBars = [
    { label: "LA Fitness", value: 65 },
    { label: "Netflix", value: 22 },
    { label: "Spotify", value: 12 },
    { label: "Apple", value: 10 },
    { label: "iCloud", value: 3 },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>AI Insights</Text>
      <Text style={styles.subtitle}>
        Visualize recurring charges and spending patterns with AI-assisted summaries.
      </Text>

      <HealthScoreCard
        score={score}
        delta={delta}
        status="Improving"
        message="Recurring charges are one of your biggest spending pressure points right now."
        colors={chartColors}
      />

      <SpendingTrendChart data={monthlyTrend} colors={chartColors} />
      <CategoryBreakdownChart data={categoryTotals} colors={chartColors} />
      <SubscriptionStackChart data={subscriptionBars} colors={chartColors} />

      <AIRecommendationCard
        title="Recommended next step"
        body="You could free up about $87 each month by reviewing your highest recurring charges and deciding which ones still add value."
        buttonLabel="Chat with AI Coach"
        colors={chartColors}
        onPress={() => router.push("/ai")}
      />

      <GoalProgressCard
        title="Safety Fund Progress"
        current={900}
        target={6000}
        colors={chartColors}
      />
    </ScrollView>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 20,
      paddingBottom: 30,
    },
    title: {
      fontSize: 30,
      fontWeight: "800",
      marginBottom: 6,
      color: colors.text,
    },
    subtitle: {
      fontSize: 16,
      marginBottom: 18,
      color: colors.subtext,
      lineHeight: 22,
    },
  });