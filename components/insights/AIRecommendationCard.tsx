import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  title: string;
  body: string;
  buttonLabel: string;
  colors: {
    card: string;
    border: string;
    text: string;
    subtext: string;
    primary: string;
  };
  onPress?: () => void;
};

export default function AIRecommendationCard({
  title,
  body,
  buttonLabel,
  colors,
  onPress,
}: Props) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.subtext }]}>{body}</Text>

      <Pressable
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={onPress}
      >
        <Text style={styles.buttonText}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 22, marginBottom: 14 },
  button: { backgroundColor: "#007AFF", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});