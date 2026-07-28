"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, FileSpreadsheet, QrCode, FileImage, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

const NAV_LINKS = [
  { href: "/dashboard", label: "Appointments", icon: LayoutDashboard },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/live-sheet", label: "Live sheet", icon: FileSpreadsheet },
  { href: "/payment-proofs", label: "Payment proofs", icon: FileImage },
  { href: "/payment-qr", label: "Payment QR", icon: QrCode },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { signOut, profile } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-admin-bg text-admin-text">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-base font-bold">VAgeWell Care</p>
            <p className="text-xs text-admin-muted">Staff Portal{profile?.full_name ? ` · ${profile.full_name}` : ""}</p>
          </div>
          <button onClick={signOut} className="text-sm font-semibold text-admin-accent active:opacity-70">
            Log out
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-admin-border px-3 pb-2 pt-2">
          {NAV_LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active ? "bg-admin-surface text-admin-accent" : "text-admin-muted hover:text-admin-text"
                }`}
              >
                <Icon size={14} />
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6">{children}</main>
    </div>
  );
}
