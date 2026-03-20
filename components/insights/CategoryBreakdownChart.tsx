import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { PieChart } from "react-native-chart-kit";

const width = Dimensions.get("window").width - 56;

export default function CategoryBreakdownChart({ data, colors }: { data: any[]; colors: any }) {
  const chartData = [
    "#007AFF",
    "#34C759",
    "#FF9500",
    "#AF52DE",
    "#FF3B30",
    "#8E8E93",
  ].map((color, i) => ({
    name: data[i]?.name || `Cat ${i + 1}`,
    amount: data[i]?.amount || 0,
    color,
    legendFontColor: colors.text,
    legendFontSize: 13,
  }));

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>Spending Breakdown</Text>
      <PieChart
        data={chartData}
        width={width}
        height={220}
        accessor="amount"
        backgroundColor="transparent"
        paddingLeft="8"
        chartConfig={{ color: () => colors.text }}
        absolute
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
});