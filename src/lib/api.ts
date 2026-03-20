// src/lib/api.ts
import { Platform } from "react-native";
import { supabase } from "./supabase";

export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ??
  (Platform.OS === "android"
    ? "http://10.0.2.2:3001"
    : "http://10.0.0.243:3001");

export async function apiFetch(path: string, options: RequestInit = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  console.log("SESSION:", session ? "present" : "null");

  const token = session?.access_token;

  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
}

export async function getAiInsights(payload?: {
  transactions?: any[];
  subscriptions?: any[];
  userProfile?: any;
}) {
  const res = await apiFetch("/ai/insights", {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "Failed to get AI insights");
  }

  return data;
}

export async function sendAiChat(payload: {
  message: string;
  conversation: { role: "user" | "assistant"; content: string }[];
  financialContext?: any;
}) {
  const res = await apiFetch("/ai/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "Failed to send chat message");
  }

  return data;
}