import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { imageUriToBytes } from "@/lib/fileBytes";

/**
 * Copies of the Nutrition modules' results on the server (migration 0047,
 * table nutrition_records), so the admin and the patient's assigned Care
 * Givers can see them. The phone keeps its own copy as before; syncing is
 * best-effort and never blocks or fails a save on the phone.
 */
export type NutritionKind = "body_metrics" | "meal" | "lab_report" | "self_assessment";

export type NutritionRecord = {
  id: string;
  account_id: string;
  family_member_id: string | null;
  kind: NutritionKind;
  client_id: string;
  data: unknown;
  photo_path: string | null;
  created_at: string;
  updated_at: string;
};

export const NUTRITION_PHOTO_BUCKET = "nutrition-photos";

const photoPath = (userId: string, clientId: string) => `${userId}/${clientId.replace(/[^a-zA-Z0-9_-]/g, "_")}.jpg`;

/** Save (or replace) one record for this person; `photoUri` uploads a small picture with it. */
export async function syncNutrition(
  userId: string | null,
  personKey: string,
  kind: NutritionKind,
  clientId: string,
  data: unknown,
  photoUri?: string | null,
  createdAt?: string,
): Promise<boolean> {
  if (!userId) return false;
  try {
    let photo_path: string | null = null;
    if (photoUri) {
      try {
        const path = photoPath(userId, clientId);
        const bytes = await imageUriToBytes(photoUri);
        const { error } = await supabase.storage.from(NUTRITION_PHOTO_BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: true });
        if (!error) photo_path = path;
      } catch {
        // the record is still worth saving without its picture
      }
    }
    const row: Record<string, unknown> = {
      account_id: userId,
      family_member_id: personKey === "self" ? null : personKey,
      kind,
      client_id: clientId,
      data,
      updated_at: new Date().toISOString(),
    };
    if (photo_path) row.photo_path = photo_path;
    if (createdAt) row.created_at = createdAt;
    const { error } = await supabase.from("nutrition_records").upsert(row, { onConflict: "account_id,client_id" });
    if (error) {
      console.warn("nutrition sync failed:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("nutrition sync failed:", e);
    return false;
  }
}

/** Remove one record (and its picture) from the server. */
export async function unsyncNutrition(userId: string | null, clientId: string): Promise<void> {
  if (!userId) return;
  try {
    await supabase.from("nutrition_records").delete().eq("account_id", userId).eq("client_id", clientId);
    await supabase.storage.from(NUTRITION_PHOTO_BUCKET).remove([photoPath(userId, clientId)]);
  } catch {
    // best-effort
  }
}

// Items saved on the phone before syncing existed are uploaded once.
const doneKey = (userId: string) => `vagewell.nutritionSynced.${userId}`;

export async function syncOnce(
  userId: string | null,
  personKey: string,
  kind: NutritionKind,
  items: { clientId: string; data: unknown; photoUri?: string | null; createdAt?: string }[],
): Promise<void> {
  if (!userId || !items.length) return;
  let done: string[] = [];
  try {
    done = JSON.parse((await AsyncStorage.getItem(doneKey(userId))) ?? "[]");
  } catch {
    done = [];
  }
  const todo = items.filter((i) => !done.includes(i.clientId));
  if (!todo.length) return;
  for (const item of todo) {
    if (await syncNutrition(userId, personKey, kind, item.clientId, item.data, item.photoUri, item.createdAt)) done.push(item.clientId);
  }
  try {
    await AsyncStorage.setItem(doneKey(userId), JSON.stringify(done));
  } catch {
    // retried next time
  }
}

/** The care team's view: one person's records, newest first. */
export async function loadNutritionRecords(accountId: string, familyMemberId: string | null): Promise<NutritionRecord[]> {
  let q = supabase.from("nutrition_records").select("*").eq("account_id", accountId).order("created_at", { ascending: false });
  q = familyMemberId ? q.eq("family_member_id", familyMemberId) : q.is("family_member_id", null);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as NutritionRecord[];
}

/** Temporary links (1 hour) for records' pictures in the private bucket. */
export async function nutritionPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await supabase.storage.from(NUTRITION_PHOTO_BUCKET).createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  for (const item of data ?? []) if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  return out;
}
