import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";
import type { ProofSource } from "@vagewell/shared";
import { imageUriToBytes } from "@/lib/fileBytes";

export type CapturedVisitPhoto = {
  uri: string;
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
  latitude: number | null;
  longitude: number | null;
};

/**
 * Takes the mandatory "Care Giver with patient" visit photo — camera only
 * (no gallery picker: a gallery photo could be old or unrelated, which
 * defeats the point of a visit-proof photo), tagged with the device's
 * current GPS position at the moment it's taken. Returns null if the
 * caregiver backs out of either the camera or the location step; throws if
 * permission for either is denied outright (surfaced to the caller as an
 * error banner, same pattern as the other pickers in this app).
 */
export async function takeVisitPhoto(): Promise<CapturedVisitPhoto | null> {
  const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
  if (!cameraPerm.granted) {
    throw new Error("Camera access is needed to take the visit photo. Enable it in Settings.");
  }
  const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
  if (shot.canceled || !shot.assets[0]) return null;
  const a = shot.assets[0];
  const mimeType = a.mimeType ?? "image/jpeg";
  let fileSize = a.fileSize ?? 0;
  if (!fileSize && Platform.OS !== "web") {
    const info = await FileSystem.getInfoAsync(a.uri);
    fileSize = info.exists && !info.isDirectory ? info.size : 0;
  }

  // Location is requested *after* the photo, not before: on iOS especially,
  // stacking two permission prompts back to back before the caregiver has
  // even seen the camera reads as suspicious and increases the chance of a
  // blanket "no" — asking once the photo itself is already in hand reads as
  // clearly tied to what it's for.
  let latitude: number | null = null;
  let longitude: number | null = null;
  const locPerm = await Location.requestForegroundPermissionsAsync();
  if (locPerm.granted) {
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch {
      // Location genuinely unavailable (e.g. GPS off) — the photo itself is
      // still required and still useful without coordinates; don't block on it.
    }
  }

  return { uri: a.uri, mimeType, fileSize, width: a.width, height: a.height, latitude, longitude };
}

/** Best-effort street address for a coordinate — native only (the OS's own
 * geocoder; no separate API key/billing). expo-location has no web
 * implementation at all (throws unconditionally), so this resolves to null
 * there rather than surfacing an error for something that was never
 * available on that platform. */
export async function reverseGeocodeVisit(latitude: number, longitude: number): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!place) return null;
    return [place.name, place.city, place.region, place.postalCode, place.country].filter(Boolean).join(", ");
  } catch {
    return null;
  }
}

/** Reads a (possibly stamped) visit photo's bytes once and wraps them as the
 * platform-neutral ProofSource the shared upload mutation expects — reading
 * once and reusing the buffer, rather than a `sizeBytes` guess followed by a
 * second read inside the mutation, since a freshly-composited image has no
 * size known ahead of time the way a plain picked file does. */
export async function buildVisitPhotoSource(uri: string, mimeType: string): Promise<ProofSource> {
  const bytes = await imageUriToBytes(uri);
  return { contentType: mimeType, sizeBytes: bytes.byteLength, toArrayBuffer: async () => bytes };
}
