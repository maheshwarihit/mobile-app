# VAgeWell Care — Detail-Gathering Prompt

> Paste everything below to your source (client, planning-session notes, or an LLM with the
> original context). Ask them to answer **every** numbered item. Anything left blank becomes a
> guess during the build, so "unknown / decide for me" is a valid answer — just say so explicitly.
> Keep answers concrete (names, numbers, rules), not descriptions of intent.

---

You are helping finalize the requirements for **VAgeWell Care**, a home-healthcare intake &
verification platform (Module 1). The core spec exists; I need precise answers to close 7 gaps
before development starts. Answer each item by its ID so the answers map back to the spec.

## A. Authentication model (blocker)
The spec describes **patients self-registering via phone number + 6-digit SMS OTP** (Supabase Auth,
`auth.uid()`, row-level security). Separately, staff/admins need to log in to clear payments and
enter vitals. Clarify:
- **A1.** Do patients authenticate ONLY via phone + OTP (Supabase Auth), with no username/password? (yes/no)
- **A2.** How do Admin and Staff log in — same phone+OTP flow, or a separate username/password login? Describe.
- **A3.** After OTP verification, is a password ever set for the account, or is every future login another OTP? (choose one)
- **A4.** Session length: how long should a login stay valid before re-authentication is required?

## B. Care services & pricing catalog
The spec gives only one example ("Physiotherapy — ₹1500/day"). I need the full catalog.
- **B1.** List EVERY bookable care service.
- **B2.** For each service: its price **per day** (₹), and whether the price is flat or varies (by patient age, duration, region, etc.).
- **B3.** Are there any add-ons, discounts, taxes/GST, or minimum-booking rules that affect the final total? Describe the exact math if so.
- **B4.** Can one booking include multiple services at once, or is it one service per booking?

## C. SMS / OTP provider
- **C1.** Which provider is live for launch — **Twilio** or **MSG91** (or other)? Pick one.
- **C2.** During development/testing, should OTP be sent for real, or mocked (e.g., fixed test code)? State the test behavior.
- **C3.** OTP rules: how many digits (confirm 6?), how long before it expires, and how many retry/resend attempts are allowed?

## D. Notification / alert delivery
The spec fires a "structured notification" to `maheshwari21102003@gmail.com` on new bookings/payments.
- **D1.** Delivery channel: plain **email** (SMTP/SendGrid/etc.) or the internal **Zoho Cliq** channel? Pick one, and name the service.
- **D2.** What exact fields must the notification contain? (e.g., patient name, service, dates, total amount, payment status, symptom notes — list them.)
- **D3.** Which events trigger a notification? (new booking, payment screenshot uploaded, admin marks paid, vitals recorded — check all that apply.)

## E. Roles & permissions
The spec uses `admin` / `leaf_node`, but the User Types list Patient/Coordinator, Admin, AND Staff.
- **E1.** Confirm the exact set of roles the system will store (the values that go in the `role` column).
- **E2.** For each role, list what they CAN do and CANNOT do — especially: who clears/overrides payment status, who enters vitals, who exports records, who can register dependents.
- **E3.** Is "Admin" distinct from "Staff", or the same role with the same powers?

## F. Scheduling
- **F1.** What time slots can a patient request? (fixed slots like "Morning/Afternoon/Evening", specific times, or free-form?)
- **F2.** For Module 1, does the system just RECORD the requested date/duration/slot, or must it also check nurse availability / prevent double-booking? (choose one)
- **F3.** "Multi-day assignment length" — is this a continuous run of consecutive days, or can the patient pick non-consecutive dates?

## G. Payment screenshot upload
- **G1.** Where should the uploaded UPI screenshots be stored — Supabase Storage, Google Cloud Storage, or elsewhere?
- **G2.** Max file size and allowed file types (png/jpg/webp)?
- **G3.** Confirm the payment lifecycle: patient uploads → status `pending_verification` → admin reviews → admin sets `paid`. Are there any other transitions (e.g., admin rejects → back to `pending`)? Describe rejection handling.

## H. Data specifics (quick confirmations)
- **H1.** Vitals captured by staff: confirm the exact list and units (e.g., Blood Pressure mmHg, Glucose mg/dL, SpO2 %). Add any others.
- **H2.** Dependent profiles: is there a max number of dependents per account? Any required fields beyond Name, Age, Relationship, Contact?
- **H3.** Are patients/staff limited to specific cities/regions for Module 1, or is that entirely a future module (no restriction now)?
- **H4.** Any data-retention, privacy, or consent requirements for medical/vitals data that must be enforced now?

---

**Format for your answers:** reply with the IDs (A1, A2, B1 …) and a short, concrete answer for each.
For any item you want the build team to decide, write: `<ID>: decide for me`.
