// Supabase Edge Function: delete-account
//
// Lets a patient delete their own account from inside the app (required by
// Google Play for apps where people create accounts). Removes the person's
// stored files — profile photo, payment screenshots, lab reports and visit
// photos of their bookings — clears references to them from other people's
// records, and then deletes the login itself. Deleting the login cascades in
// the database to their profile, family members, bookings, booking requests,
// clinical records and nutrition records (see migrations 0001, 0009, 0010, 0047).
//
// Staff accounts (admin, Care Giver) are not deleted here: they are linked to
// other people's visits and records and are removed by the admin.
//
// Deploy: supabase functions deploy delete-account
// Uses the SUPABASE_SERVICE_ROLE_KEY that Supabase provides to every function.
//
// Request  (POST, signed-in user's JWT in Authorization, no body needed)
// Response 200: { deleted: true }
// Response 4xx/5xx: { error: string }

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Who is asking: only the signed-in user can delete their own account.
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Please sign in again, then try deleting your account." }, 401);
  const uid = userData.user.id;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  try {
    const { data: profile } = await admin.from("profiles").select("role, avatar_path").eq("id", uid).maybeSingle();
    if (profile && profile.role !== "patient") {
      return json({ error: "Staff accounts are removed by the VAgeWell admin. Please contact them." }, 403);
    }

    // Files first (the rows that point to them are about to be deleted).
    const { data: bookings } = await admin.from("bookings").select("id, payment_proof_path").eq("account_id", uid);
    const bookingIds = (bookings ?? []).map((b) => b.id);
    const paymentProofs = (bookings ?? []).map((b) => b.payment_proof_path).filter((p): p is string => !!p);
    let reportFiles: string[] = [];
    let visitFiles: string[] = [];
    if (bookingIds.length) {
      const { data: reports } = await admin.from("report_uploads").select("storage_path").in("booking_id", bookingIds);
      reportFiles = (reports ?? []).map((r) => r.storage_path).filter(Boolean);
      const { data: visits } = await admin.from("visit_photos").select("storage_path").in("booking_id", bookingIds);
      visitFiles = (visits ?? []).map((v) => v.storage_path).filter(Boolean);
    }
    const removals: [string, string[]][] = [
      ["payment-proofs", paymentProofs],
      ["medical-reports", reportFiles],
      ["visit-photos", visitFiles],
      ["profile-photos", profile?.avatar_path ? [profile.avatar_path] : []],
    ];
    // Original lab report files: <account>/<report id>/page-N.ext
    const { data: reportFolders } = await admin.storage.from("lab-report-files").list(uid, { limit: 1000 });
    const labFiles: string[] = [];
    for (const folder of reportFolders ?? []) {
      const { data: pages } = await admin.storage.from("lab-report-files").list(`${uid}/${folder.name}`, { limit: 100 });
      for (const p of pages ?? []) labFiles.push(`${uid}/${folder.name}/${p.name}`);
    }
    removals.push(["lab-report-files", labFiles]);
    // Nutrition pictures live in a folder named after the account.
    const { data: nutritionFiles } = await admin.storage.from("nutrition-photos").list(uid, { limit: 1000 });
    removals.push(["nutrition-photos", (nutritionFiles ?? []).map((f) => `${uid}/${f.name}`)]);
    for (const [bucket, paths] of removals) {
      if (paths.length) {
        const { error } = await admin.storage.from(bucket).remove(paths);
        if (error) console.error(`delete-account: could not remove files from ${bucket}:`, error.message);
      }
    }

    // Other people's records that merely point at this person: unlink them.
    await admin.from("profiles").update({ primary_account_id: null }).eq("primary_account_id", uid);
    await admin.from("family_members").update({ linked_profile_id: null }).eq("linked_profile_id", uid);
    await admin.from("patient_leads").update({ claimed_profile_id: null }).eq("claimed_profile_id", uid);

    // The login itself; the database removes the profile and everything that belongs to it.
    const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
    if (deleteError) {
      console.error("delete-account: deleteUser failed:", deleteError.message);
      return json({ error: "Your account could not be deleted right now. Please try again or contact VAgeWell." }, 500);
    }
    return json({ deleted: true });
  } catch (error) {
    console.error("delete-account unexpected error:", error);
    return json({ error: "Your account could not be deleted right now. Please try again or contact VAgeWell." }, 500);
  }
});
