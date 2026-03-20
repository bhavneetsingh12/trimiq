import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

const FS = FileSystem as any;

export async function exportSubscriptionsExcel(
  apiBase: string,
  accessToken: string,
) {
  const url = `${apiBase}/export/subscriptions.xlsx`;

  // ✅ Web: fetch with auth header then download
  if (Platform.OS === "web") {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Export failed (${res.status})`);
    }

    const blob = await res.blob();
    const a = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;
    a.download = "subscriptions.xlsx";
    a.click();
    URL.revokeObjectURL(objectUrl);
    return;
  }

  // ✅ Native: download into app storage, then share/save

  console.log("Platform:", Platform.OS);
  console.log("FileSystem keys:", Object.keys(FS || {}));
  console.log("docDir:", FS.documentDirectory);
  console.log("cacheDir:", FS.cacheDirectory);

  // pick a safe directory
  const baseDir = FS.cacheDirectory ?? FS.documentDirectory;
  if (!baseDir)
    throw new Error("No writable directory available on this device.");

  const fileUri = `${baseDir}subscriptions.xlsx`;

  // Prefer createDownloadResumable when available; fall back to downloadAsync
  if (typeof FS.createDownloadResumable === "function") {
    const download = FS.createDownloadResumable(url, fileUri, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const result = await download.downloadAsync();
    if (!result?.uri) throw new Error("Download failed.");

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(result.uri);
    } else {
      alert("Saved to: " + result.uri);
    }
  } else {
    const result = await FS.downloadAsync(url, fileUri, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(result.uri);
    } else {
      alert("Saved to: " + result.uri);
    }
  }
}
