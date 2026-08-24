import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { View, Image, Text, Platform } from "react-native";
import { captureRef } from "react-native-view-shot";

export type VisitPhotoStamperHandle = {
  /** Renders `uri` with `lines` burned onto its bottom-left corner, captures
   * the composite, and resolves to the new image's `{ uri, mimeType,
   * stamped }` — mirroring GPS-camera apps that stamp location/time directly
   * onto the photo instead of keeping it as separate metadata. `stamped` is
   * false when compositing failed and the original, unstamped photo was
   * returned instead — a caregiver should never be blocked from completing
   * a visit by a rendering bug, but the caller should tell them the stamp
   * didn't apply rather than silently uploading a plain photo. */
  stamp: (uri: string, width: number, height: number, lines: string[]) => Promise<{ uri: string; mimeType: string; stamped: boolean }>;
};

type Job = { uri: string; width: number; height: number; lines: string[]; resolve: (uri: string) => void; reject: (e: unknown) => void };

const MAX_WIDTH = 1000; // keeps the captured composite (and its upload) a sane size

export const VisitPhotoStamper = forwardRef<VisitPhotoStamperHandle>(function VisitPhotoStamper(_props, ref) {
  const containerRef = useRef<View>(null);
  const [job, setJob] = useState<Job | null>(null);

  useImperativeHandle(ref, () => ({
    stamp: async (uri, width, height, lines) => {
      try {
        const composedUri = await new Promise<string>((resolve, reject) => setJob({ uri, width, height, lines, resolve, reject }));
        return { uri: composedUri, mimeType: "image/jpeg", stamped: true };
      } catch (e) {
        console.warn("VisitPhotoStamper: compositing failed, uploading the plain photo instead.", e);
        return { uri, mimeType: "image/jpeg", stamped: false };
      }
    },
  }));

  const onImageLoad = async () => {
    if (!job) return;
    try {
      // A couple of frames so the overlay text has genuinely painted (and,
      // on Android, so the native view actually has a rendered bitmap to
      // capture — `onLoad` alone isn't a reliable enough signal for that).
      await new Promise((r) => setTimeout(r, 150));
      const result = await captureRef(containerRef, {
        format: "jpg",
        quality: 0.9,
        result: Platform.OS === "web" ? "data-uri" : "tmpfile",
      });
      job.resolve(result);
    } catch (e) {
      job.reject(e);
    } finally {
      setJob(null);
    }
  };

  if (!job) return null;

  const scale = Math.min(1, MAX_WIDTH / job.width);
  const w = Math.round(job.width * scale);
  const h = Math.round(job.height * scale);

  return (
    // Kept within the actual screen bounds (not pushed off to a large
    // negative offset) — react-native-view-shot on Android can silently
    // fail to rasterize a view positioned entirely outside the viewport,
    // since it's never actually drawn to a real bitmap. opacity: 0 +
    // pointerEvents="none" keeps it invisible and non-interactive without
    // needing to move it off-screen.
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, opacity: 0 }}>
      <View ref={containerRef} collapsable={false} style={{ width: w, height: h }}>
        <Image source={{ uri: job.uri }} style={{ width: w, height: h }} onLoad={onImageLoad} />
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        >
          {job.lines.map((line, i) => (
            <Text key={i} style={{ color: "#ffffff", fontSize: 12, fontWeight: i === 0 ? "700" : "400", lineHeight: 16 }}>
              {line}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
});
