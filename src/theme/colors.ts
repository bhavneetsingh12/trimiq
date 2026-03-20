export const palette = {
  light: {
    background: "#F7F8FA",
    surface: "#FFFFFF",
    text: "#0B132B",
    subtext: "#6B7280",
    border: "#E7EAF0",
    primary: "#1473E6",
    primaryDark: "#071633",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
    tabInactive: "#7B8190",
    inputBackground: "#FFFFFF",
    mutedSurface: "#F1F3F7",
  },
  dark: {
    background: "#0B1020",
    surface: "#121A2B",
    text: "#F3F6FC",
    subtext: "#A7B0C0",
    border: "#253047",
    primary: "#3B82F6",
    primaryDark: "#1E293B",
    success: "#22C55E",
    warning: "#FBBF24",
    danger: "#F87171",
    tabInactive: "#8A93A5",
    inputBackground: "#182235",
    mutedSurface: "#1A2436",
  },
} as const;

export type AppThemeMode = keyof typeof palette;
export type AppColors = (typeof palette)[AppThemeMode];