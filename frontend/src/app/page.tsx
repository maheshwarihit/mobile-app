"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HeartPulse, ShieldCheck, CalendarClock, Users } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

// SCREEN_ID: INITIAL
export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/services");
  }, [loading, user, router]);

  return (
    <main className="auth-bg flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-600 shadow-lg">
          <HeartPulse size={34} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">VAgeWell Care</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          Secure home-healthcare intake for your whole family. Register dependents, book nursing
          and physiotherapy visits, and track care — all in one place.
        </p>

        <div className="mt-8 space-y-3">
          <Link
            href="/register"
            className="block w-full rounded-lg bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-700"
          >
            Register / New User
          </Link>
          <Link
            href="/login"
            className="block w-full rounded-lg border border-purple-200 bg-white px-5 py-3 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-50"
          >
            Existing User / Login
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-3 text-center">
          {[
            { icon: ShieldCheck, label: "OTP secured" },
            { icon: CalendarClock, label: "Book in minutes" },
            { icon: Users, label: "Family profiles" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="rounded-xl bg-white/60 p-3">
              <Icon size={20} className="mx-auto mb-1 text-purple-600" />
              <p className="text-[11px] font-medium text-gray-600">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
