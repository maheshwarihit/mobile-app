import { Platform } from "react-native";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { pickReportFiles } from "@/lib/reportFile";
import { openUrl } from "@/lib/signedUrl";
import { decode } from "base64-arraybuffer";
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
  /** Set when the report seems to belong to someone else (name, age or gender differ); missing on older readings. */
  person_mismatch?: string;
};

export type ReportSource = "camera" | "gallery";
export type ReportMediaType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
/** One page or file of a report: a photo, or a PDF (which may hold several pages itself). `uri` is what to show as its picture. */
export type PickedReport = { uri: string; base64: string; mediaType: ReportMediaType; name?: string };

/** The picture shown for a PDF, which has no photo of its own. */
export const PDF_THUMB_URI = Asset.fromModule(require("../../assets/pdf-page.png")).uri;

// A file this large (as base64) is over the AI's 5 MB per-file limit.
const MAX_FILE_BASE64_CHARS = 6_800_000;

async function webFileBase64(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Most pages one report can have (the reading function accepts up to this many). */
export const MAX_REPORT_PAGES = 6;

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
 * Take a photo of a report page (camera), or choose one or more report files
 * — PDF, JPG / JPEG or PNG — from the device. Empty if cancelled; throws with
 * a readable message if a permission is refused or a file can't be used.
 * `limit` caps how many can be chosen at once.
 */
export async function pickReport(source: ReportSource, limit = MAX_REPORT_PAGES): Promise<PickedReport[]> {
  if (source === "gallery") return pickReportUploads(limit);
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error("Camera access is needed to take a picture. Allow it in your phone's Settings for VAgeWell Care.");
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7, base64: Platform.OS !== "web" };
  const res = await ImagePicker.launchCameraAsync(options);
  if (res.canceled || !res.assets.length) return [];
  const pages: PickedReport[] = [];
  for (const a of res.assets.slice(0, limit)) {
    const base64 = Platform.OS === "web" ? await webJpegBase64(a.uri) : (a.base64 ?? "");
    if (!base64) throw new Error("Could not read the picture. Please try again.");
    pages.push({ uri: a.uri, base64, mediaType: "image/jpeg" });
  }
  return pages;
}

/** Upload: PDF and image files through the document picker (the photo picker can't return a PDF). */
async function pickReportUploads(limit: number): Promise<PickedReport[]> {
  const files = (await pickReportFiles()).slice(0, limit);
  const out: PickedReport[] = [];
  for (const f of files) {
    const isPdf = f.mimeType === "application/pdf";
    if (!isPdf && !f.mimeType.startsWith("image/")) throw new Error("Please choose a PDF, JPG or PNG file.");
    let base64: string;
    let mediaType: ReportMediaType;
    if (isPdf) {
      base64 = Platform.OS === "web" ? await webFileBase64(f.uri) : await FileSystem.readAsStringAsync(f.uri, { encoding: "base64" });
      mediaType = "application/pdf";
    } else if (Platform.OS === "web") {
      // Re-drawn as a JPEG no larger than MAX_SIDE, so large photos still fit.
      base64 = await webJpegBase64(f.uri);
      mediaType = "image/jpeg";
    } else {
      base64 = await FileSystem.readAsStringAsync(f.uri, { encoding: "base64" });
      mediaType = f.mimeType === "image/png" ? "image/png" : f.mimeType === "image/webp" ? "image/webp" : "image/jpeg";
    }
    if (!base64) throw new Error("Could not read the file. Please try again.");
    if (base64.length > MAX_FILE_BASE64_CHARS) throw new Error(`"${f.name}" is larger than 5 MB. Please choose a smaller file.`);
    out.push({ uri: isPdf ? PDF_THUMB_URI : f.uri, base64, mediaType, name: f.name });
  }
  return out;
}

/** Send a report's pages — photos and/or PDFs, in order — for AI reading as one report. Throws an Error with a user-readable message on failure. */
export async function analyzeReport(
  pages: { base64: string; mediaType: ReportMediaType }[],
  language: string,
  person: { age?: number; gender?: string },
): Promise<LabReport> {
  // The function is named "analyze-lab-report" in Supabase, but it was first
  // deployed with an auto-generated name and a function's address never
  // changes, so it is reached at /functions/v1/hyper-function.
  const { data, error } = await supabase.functions.invoke("hyper-function", {
    body: {
      images: pages.map((p) => ({ image_base64: p.base64, media_type: p.mediaType })),
      // The first page again in the original single-image fields, so a
      // function deployed before multi-page support still works.
      image_base64: pages[0]?.base64,
      media_type: pages[0]?.mediaType,
      language,
      person,
    },
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

/** Translate a stored reading's explanations into `language` (no image is sent). */
export async function translateReport(report: LabReport, language: string): Promise<LabReport> {
  // Same function as analyzeReport (see the note there about its address).
  const { data, error } = await supabase.functions.invoke("hyper-function", { body: { translate: report, language } });
  if (error) {
    let message: string | null = null;
    try {
      const ctx = (error as { context?: Response }).context;
      const body = ctx ? await ctx.json() : null;
      if (body && typeof body.error === "string") message = body.error;
    } catch {
      // not JSON
    }
    throw new Error(message ?? "Could not translate.");
  }
  return data as LabReport;
}

// ── The original files (every page / PDF), kept privately (migration 0049) ──
export const LAB_FILE_BUCKET = "lab-report-files";
export type ReportFile = { path: string; mediaType: ReportMediaType };

const extOf = (m: ReportMediaType) => (m === "application/pdf" ? "pdf" : m === "image/png" ? "png" : m === "image/webp" ? "webp" : "jpg");

/** Upload a report's pages under <account>/<report id>/. Returns the files that were stored (best-effort). */
export async function uploadReportFiles(
  userId: string,
  reportId: string,
  pages: { base64: string; mediaType: ReportMediaType }[],
): Promise<ReportFile[]> {
  const stored: ReportFile[] = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const path = `${userId}/${reportId}/page-${i + 1}.${extOf(p.mediaType)}`;
    try {
      const { error } = await supabase.storage.from(LAB_FILE_BUCKET).upload(path, decode(p.base64), { contentType: p.mediaType, upsert: true });
      if (!error) stored.push({ path, mediaType: p.mediaType });
    } catch {
      // keep going with the other pages
    }
  }
  return stored;
}

export async function removeReportFiles(files: ReportFile[] | undefined): Promise<void> {
  if (!files?.length) return;
  try {
    await supabase.storage.from(LAB_FILE_BUCKET).remove(files.map((f) => f.path));
  } catch {
    // best-effort
  }
}

/** Open one original page / PDF (a short-lived private link). */
export async function openReportFile(path: string): Promise<boolean> {
  const { data } = await supabase.storage.from(LAB_FILE_BUCKET).createSignedUrl(path, 600);
  if (!data?.signedUrl) return false;
  openUrl(data.signedUrl);
  return true;
}
