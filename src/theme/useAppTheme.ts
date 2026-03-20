import { useColorScheme } from "@/hooks/use-color-scheme";
import { palette } from "./colors";

export function useAppTheme() {
  const scheme = useColorScheme() ?? "light";
  return palette[scheme];
}