import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import type { ProofSource } from "@vagewell/shared";
import { imageUriToBytes } from "@/lib/fileBytes";

export type PickedImage = { uri: string; mimeType: string; fileSize: number };

function guessMime(nameOrUri: string): string {
  const ext = nameOrUri.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

/** Launch the OS image picker. Returns null if cancelled; throws if permission denied. */
export async function pickImageAsset(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error("Photo access is needed to upload a screenshot. Enable it in Settings.");
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
  });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  const mimeType = a.mimeType ?? guessMime(a.fileName ?? a.uri);
  let fileSize = a.fileSize ?? 0;
  if (!fileSize && Platform.OS !== "web") {
    // getInfoAsync is native-only; on web the picker already provides fileSize.
    const info = await FileSystem.getInfoAsync(a.uri);
    fileSize = info.exists && !info.isDirectory ? info.size : 0;
  }
  return { uri: a.uri, mimeType, fileSize };
}

/** Wrap a picked image as the platform-neutral ProofSource the shared upload mutation expects. */
export function assetToProofSource(img: PickedImage): ProofSource {
  return {
    contentType: img.mimeType,
    sizeBytes: img.fileSize,
    toArrayBuffer: () => imageUriToBytes(img.uri),
  };
}
