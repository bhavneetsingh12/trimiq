import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function HealthScoreCard({
  score,
  delta,
  status,
  message,
  colors,
}: {
  score: number;
  delta: number;
  status: string;
  message: string;
  colors: any;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.subtext }]}>Financial Health Score</Text>
      <Text style={[styles.score, { color: colors.text }]}>{score}/100</Text>
      <Text style={[styles.status, { color: colors.text }]}>
        {status} {delta >= 0 ? `• Up ${delta}` : `• Down ${Math.abs(delta)}`}
      </Text>
      <Text style={[styles.message, { color: colors.subtext }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 16 },
  label: { fontSize: 14, marginBottom: 6 },
  score: { fontSize: 34, fontWeight: "800" },
  status: { fontSize: 16, fontWeight: "700", marginTop: 4 },
  message: { fontSize: 15, marginTop: 8, lineHeight: 22 },
});