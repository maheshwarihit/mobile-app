# Google Play — listing text and form answers

Copy-paste source for Play Console. Keep it in sync with the app and the Privacy Policy
(`mobile/src/lib/legal/privacy.json`). Everything here can be edited later in Play Console,
except the package name (`in.vagewell.care`) and "Free".

---

## 1. Main store listing (Grow users → Store presence → Main store listing)

**App name** (max 30)
```
VAgeWell Care
```

**Short description** (max 80)
```
Book home care visits and track the health of your elderly loved ones.
```

**Full description** (max 4000)
```
VAgeWell Care brings home healthcare to elderly people and their families. Book care visits from trained Care Givers, keep everyone's health details in one place, and use simple tools to understand everyday health.

BOOK CARE AT HOME
• Nutrition – diet plans and dietitian support tailored to your health
• Exercise – physiotherapy and guided exercises at home
• Bio Markers – regular BP, sugar and oxygen checks by trained Care Givers
• Mind & Wellbeing – emotional support and companionship for a happier mind
Choose the service, the date and the time. Our team calls to confirm, and you pay the Care Giver after the visit.

ONE ACCOUNT FOR THE WHOLE FAMILY
Add parents, a spouse or children and book care for each of them from the same login. See upcoming and past appointments, and the vitals and reports our care staff record for each person.

EVERYDAY HEALTH TOOLS
• BMI and body measurements, with history
• Health self-assessments
• Meal Scanner – take a photo of a meal to see estimated calories and nutrients
• Lab Report Insights – upload a lab report for a plain-language explanation of the values
AI results are estimates to help you, not medical advice. Always consult your doctor.

SIMPLE AND SECURE
• Sign in with your mobile number (OTP) or Google
• Available in English and Tamil
• Your health data is encrypted and only visible to you and the care staff looking after you
• Delete your account at any time from the Profile tab

VAgeWell Care is not for emergencies. In a medical emergency, call 108 or 112.
```

**Category:** Medical  **Tags:** Health, Home care, Elderly care
**Contact email:** info@vagewell.com  **Website:** (optional)
**Privacy policy:** https://vagewell-web-deploy.vercel.app/privacy-policy.html

**Graphics**
- App icon: 512 × 512 PNG — from `mobile/assets/icon.png`
- Feature graphic: 1024 × 500 PNG/JPG — needs design (logo + "Home care for the whole family")
- Phone screenshots: 2–8, 1080 × 1920 — `screenshots/play-store/` in the parent folder

**Release notes** (first release, max 500)
```
First release of VAgeWell Care: book home care visits, manage family members, track BMI and body measurements, scan meals, and get plain-language lab report insights. English and Tamil.
```

---

## 2. App content (Policy and programs → App content)

### App access
Choose **"All or some functionality is restricted"** and add instructions:
```
Sign in with a test phone number (no real SMS is sent):
1. Open the app → Get Started → Client → Continue.
2. On "Create your account", tap "Login".
3. Mobile number: 9000000001 (India, +91). Tap "Send OTP".
4. OTP code: 123456.
```
This number must exist in Supabase → Authentication → Sign In / Providers → Phone →
Test phone numbers as `919000000001=123456`, and the account must have been created once
(sign up with it before submitting).

### Ads
**No**, the app does not contain ads.

### Content rating
Category: **All other app types**. Answer **No** to violence, sexual content, language,
controlled substances, gambling and user-to-user communication; **No** to sharing the user's
location with other users; **No** digital purchases. Expected rating: Everyone / PEGI 3.

### Target audience and content
Age groups: **18 and over** only. The app is not designed for children (children can only
be added as family members by a parent). Answer **No** to "appeals to children".

### News apps / COVID-19 / Government apps / Financial features
All **No**.

### Health apps
Declare the health features: **Medical / clinical care (home care visits and records)**,
**Health and fitness tracking** (BMI, body measurements, self-assessments), and
**Nutrition**. The app is not a medical device and does not diagnose.

### Data safety
**Does the app collect or share user data?** Yes, collects. **Shared with third parties:** No
(Supabase, Anthropic, Vercel and the SMS provider process data on our behalf, which Play does
not count as sharing).
**Encrypted in transit:** Yes. **Users can request deletion:** Yes (in-app Profile → Delete my
account, and https://vagewell-web-deploy.vercel.app/delete-account.html).

| Data type | Collected | Required? | Purposes |
|---|---|---|---|
| Personal info → Name | Yes | Required | App functionality, Account management |
| Personal info → Email address | Yes | Optional (Google sign-in) | Account management |
| Personal info → Phone number | Yes | Required | App functionality, Account management |
| Personal info → Address | Yes | Optional | App functionality (home visits) |
| Personal info → Other info (date of birth, gender, family members) | Yes | Optional | App functionality |
| Location → Approximate and Precise | Yes | Optional (care staff only, visit photos) | App functionality |
| Health and fitness → Health info | Yes | Optional | App functionality |
| Health and fitness → Fitness info | Yes | Optional | App functionality |
| Photos and videos → Photos | Yes | Optional | App functionality |
| Files and docs | Yes | Optional (lab reports) | App functionality |
| App activity → Other user-generated content (feedback) | Yes | Optional | App functionality, Analytics (improving the app) |

None of the data is processed only on the device, and none is used for advertising.

### Account deletion
Web link: https://vagewell-web-deploy.vercel.app/delete-account.html

---

## 3. Permissions (if Play asks)
| Permission | Why |
|---|---|
| Camera | Take a meal photo, a lab report photo, or (care staff) a visit photo |
| Location (while in use) | Care staff only: tags the visit photo with where the visit took place |

Photos are chosen with Android's system photo picker, so the app does not request photo or
storage permissions.
