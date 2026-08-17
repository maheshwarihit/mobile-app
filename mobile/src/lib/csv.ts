import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { toast } from "sonner-native";

/** Serialize an array of flat row objects into RFC-4180-ish CSV text. */
export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))];
  return lines.join("\n");
}

/**
 * Save CSV text to the device. Web: Blob + anchor click (DOM reached via
 * `globalThis`, same pattern this project's now-deleted web portal used).
 * Native: write into the cache dir, then hand off to the share sheet — same
 * two-branch shape as `ProfileScreen`'s report `downloadReport`.
 */
export async function downloadCsv(fileName: string, csv: string): Promise<void> {
  if (Platform.OS === "web") {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const doc = (globalThis as any).document;
    const a = doc.createElement("a");
    a.href = url;
    a.download = fileName;
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }
  try {
    const uri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, csv);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    } else {
      toast.error("Sharing isn't available on this device.");
    }
  } catch {
    toast.error("Could not save the CSV file.");
  }
}
