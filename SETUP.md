VAGEWELL CARE - SETUP AND RUN GUIDE

This guide explains the settings the application needs and the exact steps to run it. It is written in plain language so anyone can follow it.


ABOUT THE APP

VAgeWell Care is a mobile-first web application (a Progressive Web App). Patients sign in with their phone number and a one-time code, browse care services, book multi-day home visits, and upload a payment screenshot. Staff and admins record patient vitals, approve or reject payments, and export the list of appointments to Excel. The app is built with Next.js for the screens and Supabase for the database, the login, and file storage. There is no separate backend server to run.


WHAT YOU NEED BEFORE STARTING

1. Node.js version 20 or newer, together with npm.
2. The Supabase command line tool (the Supabase CLI).
3. Docker Desktop, installed and running. This is only needed for the local option (Option A). If you use a hosted Supabase project instead (Option B), you do not need Docker.


THE SETTINGS THE APP NEEDS

The application uses only a few settings. They live in two different places.

Place 1. The front end file, located at frontend/.env.local
These are the only two settings the browser uses, and both are safe to expose.
  NEXT_PUBLIC_SUPABASE_URL   This is the web address of your Supabase project. You get it by running "supabase status" for the local option, or from Project Settings, API section, for the hosted option.
  NEXT_PUBLIC_SUPABASE_ANON_KEY   This is the public anon key from the same place. Important: never put the service role key here.

Place 2. The phone code (SMS) settings, set in the Supabase dashboard
These are under Authentication, then Providers, then Phone. For local testing you need nothing here, because ready-made test phone numbers and codes are already set in the file supabase/config.toml.

Note: complete example files are already in the project. See the file .env.example at the root, and the file frontend/.env.local.example.


OPTION A. RUN IT LOCALLY (this needs Docker)

This is the fastest way to see the app working. It needs no cloud account and no real SMS.

Step 1. Make sure Docker Desktop is running. Then open a terminal in the project folder:
    cd C:\aswitha\mobile-app

Step 2. Start the local Supabase services (database, login, storage, and the Studio dashboard):
    supabase start
    This prints an API URL such as http://127.0.0.1:54321, an anon key, and a service role key. Keep these values handy.

Step 3. Create all the tables, the security rules, and the six sample services:
    supabase db reset

Step 4. Set up the front end and start it:
    cd frontend
    Make a copy of the file frontend/.env.local.example and name the copy frontend/.env.local
    Open frontend/.env.local and paste the URL and anon key from Step 2.
    npm install
    npm run dev
    The app now runs at http://localhost:3000


FIRST LOGIN

Use the ready-made test account. On the login screen, enter the phone number +919000000001 and the code 123456. These test values are defined in the file supabase/config.toml.

To make an account an admin: first register with a phone number. Then open the file supabase/seed.sql, remove the comment marks from the founding-admin block, put that phone number in, and run "supabase db reset" again. As an alternative, you can run the same UPDATE statement directly in the Studio SQL editor.


OPTION B. RUN IT ON A HOSTED SUPABASE PROJECT (no Docker needed)

Step 1. Create a project at supabase.com. From Settings, API, copy three values: the URL, the anon key, and the service role key.

Step 2. Connect your project and load the database:
    supabase link --project-ref YOUR_PROJECT_REF
    supabase db push
    Then open the SQL editor in the dashboard and run the contents of the file supabase/seed.sql.

Step 3. Turn on phone login. Go to Authentication, then Providers, then Phone. Enter your Twilio account details and set the code length to 6.

Step 4. Put the hosted URL and anon key into frontend/.env.local, then run "npm install" and "npm run dev", or deploy the front end to any host you prefer.


THE SHORTEST PATH TO SEE IT WORKING

Have Docker running. Run "supabase start", then "supabase db reset". Put the two NEXT_PUBLIC values into frontend/.env.local. Run "npm run dev". Everything else, such as real SMS, is only needed for production.
