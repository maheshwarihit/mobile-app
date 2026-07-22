import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";

/**
 * Read a picked-image URI to bytes for upload — works on BOTH web and native.
 * - Web: the picker returns a blob:/data: URL → fetch it and take the ArrayBuffer.
 *   (expo-file-system is native-only and throws on web.)
 * - Native: read the file:// URI as base64 via expo-file-system, then decode.
 */
export async function imageUriToBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    return res.arrayBuffer();
  }
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return decode(b64);
}
