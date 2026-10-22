import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";

/** What the analyze-lab-report edge function returns (mirrors its schema). */
export type LabTestStatus = "Normal" | "High" | "Low" | "Critical" | "Unclear";
export type LabUrgency = "Routine" | "Consult Soon" | "Urgent";
export type LabReport = {
  status: "ok" | "unreadable";
  unreadable_reason: string;
  retake_tip: string;
  report_type: "Blood Test" | "Urine Routine" | "Stool Routine" | "Other";
  report_panels: string[];
  tests: {
    name: string;
    value: string;
    unit: string;
    reference_range: string;
    range_source: "report" | "standard";
    status: LabTestStatus;
  }[];
  abnormal_explanations: { test: string; what_it_measures: string; possible_causes: string }[];
  summary: string;
  health_concerns: string[];
  diet_lifestyle: string[];
  doctor_questions: string[];
  urgency: LabUrgency;
  disclaimer: string;
};

export type ReportSource = "camera" | "gallery";
export type PickedReport = { uri: string; base64: string; mediaType: "image/jpeg" };

// Long enough edge to keep small print readable, small enough to send quickly.
const MAX_SIDE = 2000;

/** Web: redraw any picked image as a JPEG no larger than MAX_SIDE on its long edge. */
async function webJpegBase64(uri: string): Promise<string> {
  const img = new (globalThis as any).Image() as HTMLImageElement;
  img.src = uri;
  await img.decode();
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = (globalThis as any).document.createElement("canvas") as HTMLCanvasElement;
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}

/**
 * Take or choose a photo of a lab report (whole page, no crop), asking for
 * the camera / photo permission first. Null if cancelled; throws with a
 * readable message if the permission is refused.
 */
export async function pickReport(source: ReportSource): Promise<PickedReport | null> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("Camera access is needed to take a picture. Allow it in your phone's Settings for VAgeWell Care.");
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error("Photo access is needed to choose a picture. Allow it in your phone's Settings for VAgeWell Care.");
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7, base64: Platform.OS !== "web" };
  const res = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  const base64 = Platform.OS === "web" ? await webJpegBase64(a.uri) : (a.base64 ?? "");
  if (!base64) throw new Error("Could not read the picture. Please try again.");
  return { uri: a.uri, base64, mediaType: "image/jpeg" };
}

/** Send a report photo for AI reading. Throws an Error with a user-readable message on failure. */
export async function analyzeReport(
  base64: string,
  language: string,
  person: { age?: number; gender?: string },
): Promise<LabReport> {
  const { data, error } = await supabase.functions.invoke("analyze-lab-report", {
    body: { image_base64: base64, media_type: "image/jpeg", language, person },
  });
  if (error) {
    // The function's own { error } message, when it sent one.
    let message: string | null = null;
    try {
      const ctx = (error as { context?: Response }).context;
      const body = ctx ? await ctx.json() : null;
      if (body && typeof body.error === "string") message = body.error;
    } catch {
      // not JSON — fall through to the generic message
    }
    throw new Error(message ?? "Report reading isn't available right now. Please try again later.");
  }
  return data as LabReport;
}
