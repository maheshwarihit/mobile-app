import type { RefObject } from "react";
import { Platform, type View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

/**
 * Save what a view shows as a PNG picture.
 * - Web: downloads the file (`fileName`).
 * - Phone: opens the share sheet, where it can be saved to Photos/Files or sent (WhatsApp etc.).
 * Returns false if it could not be captured or shared.
 */
export async function saveViewImage(view: RefObject<View | null>, fileName: string): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      // On web a View ref is the DOM element itself; captureRef would try
      // findNodeHandle (unsupported on web), so draw the element directly.
      const element = view.current as unknown as HTMLElement | null;
      if (!element) return false;
      // html-to-image lets the browser itself draw the element (via SVG), so the
      // picture matches the screen; html2canvas re-draws text a few pixels low.
      const { toPng } = await import("html-to-image");
      const dataUri = await toPng(element, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
      const doc = (globalThis as any).document;
      const a = doc.createElement("a");
      a.href = dataUri;
      a.download = fileName;
      doc.body.appendChild(a);
      a.click();
      doc.body.removeChild(a);
      return true;
    }
    const uri = await captureRef(view, { format: "png", result: "tmpfile", fileName: fileName.replace(/\.png$/, "") });
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: fileName });
    return true;
  } catch (e) {
    console.warn("saveViewImage failed:", e);
    return false;
  }
}
