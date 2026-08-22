// VAgeWell Care — live backend search tool.
//
// Real "Request -> Backend -> Database -> Response" flow this app already
// runs on: your own phone (via OTP) proves who you are, then real GET
// requests to Supabase's HTTPS REST API search the actual database — not a
// canned single example, you pick the table and the search term each time.
// No separate backend server needed - Supabase IS the backend here.
//
// Run with:  node scripts/demo-backend.js
// (Needs Node 18+ for built-in fetch.)

const readline = require("readline/promises");
const { stdin, stdout } = require("process");

const SUPABASE_URL = "https://ccvpwfzqgrrhxrmzlkca.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjdnB3ZnpxZ3JyaHhybXpsa2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MDc1ODcsImV4cCI6MjEwMDE4MzU4N30.iO8cmBEEDtvXN-3TRxH660rB3U2u2Kfef8r5OWnCBM4";

// One entry per searchable table in the database — every table this app
// actually has, not a trimmed-down subset. What columns to show, and which
// columns a typed search term matches against (case-insensitive "contains").
const TABLES = {
  1: {
    label: "Patients (profiles)",
    table: "profiles",
    select: "full_name,phone,age,gender,role,address,created_at",
    searchCols: ["full_name", "phone"],
  },
  2: {
    label: "Appointments (bookings)",
    table: "bookings",
    select: "service_name,start_date,time_slot,booking_status,payment_status,total_amount,symptom_brief,created_at",
    searchCols: ["service_name", "symptom_brief"],
  },
  3: {
    label: "Family members (dependents)",
    table: "family_members",
    select: "full_name,relationship,contact_phone,age,created_at",
    searchCols: ["full_name", "contact_phone"],
  },
  4: {
    label: "Services (catalog)",
    table: "services",
    select: "name,description,price_per_day,pricing_model,active",
    searchCols: ["name"],
  },
  5: {
    label: "Medical / clinical records",
    table: "clinical_records",
    select: "systolic,diastolic,blood_glucose,spo2,blood_group,medical_conditions,note,recorded_at",
    searchCols: ["medical_conditions", "note"],
  },
  6: {
    label: "Uploaded reports",
    table: "report_uploads",
    select: "patient_name,service_name,file_name,report_type,note,reviewed,created_at",
    searchCols: ["patient_name", "service_name", "file_name", "note"],
  },
  7: {
    label: "Booking requests (call-back leads)",
    table: "booking_requests",
    select: "note,contacted,contacted_at,created_at",
    searchCols: ["note"],
  },
  8: {
    label: "Patient leads (not-yet-registered callers)",
    table: "patient_leads",
    select: "full_name,phone,note,created_at",
    searchCols: ["full_name", "phone", "note"],
  },
  9: {
    label: "Appointments, combined (patient + dependent + service + caregiver in one row)",
    table: "bookings_full",
    select:
      "service_name,start_date,time_slot,booking_status,payment_status,account_full_name,account_phone,dependent_full_name,dependent_relationship,assignee_full_name,assignee_phone,created_at",
    searchCols: ["service_name", "account_full_name", "dependent_full_name", "assignee_full_name"],
  },
};

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  console.log("=== VAgeWell Care — live backend demo ===\n");

  let phone = (await rl.question("Enter your mobile number (E.164, e.g. +9198XXXXXXXX): ")).trim();
  if (!phone.startsWith("+")) phone = "+91" + phone.replace(/\D/g, "");

  console.log(`\nRequesting OTP for ${phone} ...`);
  const otpRes = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  const otpBody = await otpRes.json().catch(() => ({}));
  if (!otpRes.ok) {
    console.error(`  ✗ Could not send OTP (HTTP ${otpRes.status}):`, otpBody);
    rl.close();
    return;
  }
  console.log("  ✓ OTP sent — check your phone for the code.\n");

  const code = (await rl.question("Enter the code you received: ")).trim();

  const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ phone, token: code, type: "sms" }),
  });
  const verifyBody = await verifyRes.json().catch(() => ({}));
  if (!verifyRes.ok || !verifyBody.access_token) {
    console.error(`  ✗ Verification failed (HTTP ${verifyRes.status}):`, verifyBody);
    rl.close();
    return;
  }
  const accessToken = verifyBody.access_token;
  console.log("  ✓ Verified — got a real session token.\n");

  console.log("\nLogged in. You can now search the real backend as many times as you like.\n");

  const runQuery = async (target, search) => {
    let url = `${SUPABASE_URL}/rest/v1/${target.table}?select=${target.select}`;
    if (search) {
      // PostgREST search syntax: ilike.*term* = case-insensitive "contains".
      // or=(...) checks any of the listed columns, comma-separated inside.
      const term = encodeURIComponent(search);
      const conditions = target.searchCols.map((c) => `${c}.ilike.*${term}*`).join(",");
      url += `&or=(${conditions})`;
    }
    console.log(`\n--- ${target.label} ---`);
    console.log(`GET ${url}`);
    const res = await fetch(url, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` } });
    const data = await res.json().catch(() => ({}));
    console.log(`Response (HTTP ${res.status}):`);
    console.log(JSON.stringify(data, null, 2));
  };

  let again = "y";
  while (again.toLowerCase().startsWith("y")) {
    console.log("Which table do you want to search? (0 = search every table at once, entire backend)");
    for (const [num, t] of Object.entries(TABLES)) console.log(`  ${num}) ${t.label}`);
    const choice = (await rl.question("Enter a number: ")).trim();

    const search = (await rl.question(`Search term (leave blank to list every row you can see): `)).trim();

    if (choice === "0") {
      for (const target of Object.values(TABLES)) await runQuery(target, search);
    } else {
      const target = TABLES[choice];
      if (!target) {
        console.log("Not a valid option, try again.\n");
        continue;
      }
      await runQuery(target, search);
    }

    again = await rl.question("\nSearch again? (y/n): ");
    console.log("");
  }

  rl.close();
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
