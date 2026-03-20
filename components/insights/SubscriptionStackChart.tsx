import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function SubscriptionStackChart({ data, colors }: { data: any[]; colors: any }) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>Subscription Stack</Text>
      {data.map((item) => (
        <View key={item.label} style={styles.row}>
          <View style={styles.rowTop}>
            <Text style={[styles.label, { color: colors.text }]}>{item.label}</Text>
            <Text style={[styles.value, { color: colors.subtext }]}>${item.value}/mo</Text>
          </View>
          <View style={[styles.track, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.fill,
                { width: `${(item.value / max) * 100}%`, backgroundColor: "#007AFF" },
              ]}
            />
          </View>
        </View>
      ))}
      <Text style={[styles.footer, { color: colors.subtext }]}>
        Top savings opportunity: canceling top 2 saves about $87/month.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 12 },
  row: { marginBottom: 12 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  label: { fontSize: 15, fontWeight: "600" },
  value: { fontSize: 14 },
  track: { height: 10, borderRadius: 999, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999 },
  footer: { marginTop: 8, fontSize: 14, lineHeight: 20 },
});