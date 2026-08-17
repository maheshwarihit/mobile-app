import * as DocumentPicker from "expo-document-picker";
import type { ProofSource } from "@vagewell/shared";
import { ALLOWED_REPORT_MIME } from "@vagewell/shared";
import { imageUriToBytes } from "@/lib/fileBytes";

export type PickedFile = { uri: string; name: string; mimeType: string; size: number };

function guessMime(nameOrUri: string): string {
  const ext = nameOrUri.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

/**
 * Pick a report file — images *or* PDF, matching the web portal's own
 * accept list (ALLOWED_REPORT_MIME). expo-image-picker can't return a PDF,
 * which is why this uses the document picker instead: a caregiver uploading
 * a lab report or prescription PDF is a normal case, not an edge one.
 * Returns null when the picker is cancelled.
 */
export async function pickReportFile(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: [...ALLOWED_REPORT_MIME],
    copyToCacheDirectory: true, // the uri must outlive the picker for the upload read
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const name = a.name || "report";
  return {
    uri: a.uri,
    name,
    // Android occasionally hands back a null/generic mimeType — fall back to
    // the extension so the upload isn't rejected by the shared MIME guard.
    mimeType: a.mimeType && a.mimeType !== "application/octet-stream" ? a.mimeType : guessMime(name),
    size: a.size ?? 0,
  };
}

/** Wrap a picked file as the platform-neutral ProofSource the shared upload mutation expects. */
export function fileToProofSource(f: PickedFile): ProofSource {
  // imageUriToBytes is URI-generic despite its name (fetch on web, base64 read
  // on native) — it never inspects the content type.
  return { contentType: f.mimeType, sizeBytes: f.size, toArrayBuffer: () => imageUriToBytes(f.uri) };
}
