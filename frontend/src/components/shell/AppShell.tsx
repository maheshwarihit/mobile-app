"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, HeartPulse } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { BottomNav } from "@/components/shell/BottomNav";
import { Avatar, IconButton } from "@/components/ui";

// Routes rendered full-bleed without the app chrome.
const BARE_ROUTES = ["/", "/login", "/register"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, role, user, signOut } = useAuth();

  // Register the PWA service worker once.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const bare = BARE_ROUTES.includes(pathname);
  if (bare) return <>{children}</>;

  const name = profile?.full_name ?? "";
  const [first = "", last = ""] = name.split(" ");

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-[#F9F7FF]/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/services" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600">
              <HeartPulse size={18} className="text-white" />
            </span>
            <span className="text-base font-bold text-gray-900">VAgeWell Care</span>
          </Link>
          {user && (
            <div className="flex items-center gap-2">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium leading-tight text-gray-900">{name || "Account"}</p>
                {role && <p className="text-xs capitalize text-gray-500">{role}</p>}
              </div>
              <Avatar firstName={first} lastName={last} id={user.id} size="sm" />
              <IconButton onClick={handleSignOut} title="Sign out" danger>
                <LogOut size={18} />
              </IconButton>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-5">{children}</main>

      <BottomNav />
    </div>
  );
}
