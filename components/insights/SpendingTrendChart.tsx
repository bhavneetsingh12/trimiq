import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { LineChart } from "react-native-chart-kit";

const width = Dimensions.get("window").width - 56;

export default function SpendingTrendChart({ data, colors }: { data: any[]; colors: any }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>Monthly Spending Trend</Text>
<LineChart
  data={{
    labels: data.map((d) => d.label),
    datasets: [{ data: data.map((d) => d.value) }],
  }}
  width={width}
  height={220}
  chartConfig={{
          backgroundGradientFrom: colors.card,
          backgroundGradientTo: colors.card,
          decimalPlaces: 0,
          color: () => "#007AFF",
          labelColor: () => colors.subtext,
          propsForDots: { r: "4" },
        }}
        bezier
        style={{ marginTop: 8, borderRadius: 12 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
});