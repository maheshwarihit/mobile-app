import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

/**
 * Permanently delete the signed-in patient's account (the delete-account
 * server function removes their files, records and login), then clear what
 * this device kept for them (Meal / Report libraries, Body Metrics…).
 * Throws an Error with a readable message on failure.
 */
export async function deleteMyAccount(userId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("delete-account", { body: {} });
  if (error) {
    let message: string | null = null;
    try {
      const ctx = (error as { context?: Response }).context;
      const body = ctx ? await ctx.json() : null;
      if (body && typeof body.error === "string") message = body.error;
    } catch {
      // not JSON
    }
    throw new Error(message ?? "Your account could not be deleted right now. Please try again or contact VAgeWell.");
  }
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith("vagewell.") && k.includes(userId)));
  } catch {
    // best-effort: the account itself is already gone
  }
}
