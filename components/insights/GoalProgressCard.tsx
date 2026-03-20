import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function GoalProgressCard({
  title,
  current,
  target,
  colors,
}: {
  title: string;
  current: number;
  target: number;
  colors: any;
}) {
  const pct = Math.min((current / target) * 100, 100);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.values, { color: colors.subtext }]}>
        ${current.toLocaleString()} of ${target.toLocaleString()}
      </Text>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: "#34C759" }]} />
      </View>
      <Text style={[styles.percent, { color: colors.text }]}>{pct.toFixed(0)}% complete</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 8 },
  values: { fontSize: 15, marginBottom: 10 },
  track: { height: 12, borderRadius: 999, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999 },
  percent: { marginTop: 10, fontSize: 15, fontWeight: "700" },
});