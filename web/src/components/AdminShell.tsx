"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, FileSpreadsheet, QrCode, FileImage, LayoutDashboard, ClipboardList, Sprout, FileCheck2, PhoneIncoming, UserPlus } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useBookingRequests, useAllProfiles, useAllBookings, isNewSignup } from "@vagewell/shared";
import { ProfileAvatar } from "@/components/ProfileSummary";
import { OwnProfilePanel } from "@/components/OwnProfilePanel";

const ADMIN_NAV = [
  { href: "/dashboard", label: "Appointments", icon: LayoutDashboard },
  { href: "/requests", label: "Requests", icon: PhoneIncoming },
  { href: "/user-details", label: "User Details", icon: UserPlus },
  { href: "/patients", label: "Clients", icon: Users },
  { href: "/leaf-nodes", label: "Leaf Nodes", icon: Sprout },
  { href: "/reports", label: "Reports", icon: FileCheck2 },
  { href: "/live-sheet", label: "Live sheet", icon: FileSpreadsheet },
  { href: "/payment-proofs", label: "Payment proofs", icon: FileImage },
  { href: "/payment-qr", label: "Payment QR", icon: QrCode },
];

// leaf_node gets a reduced nav — their own assigned work, not the full
// operational surface. Reports is included (not release/admin actions, but
// the full view/history) since report_select RLS already grants any
// is_staff() caller every report regardless of assignment.
const OPS_NAV = [
  { href: "/my-visits", label: "My Visits", icon: ClipboardList },
  { href: "/reports", label: "Reports", icon: FileCheck2 },
  { href: "/live-sheet", label: "Live sheet", icon: FileSpreadsheet },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, role } = useAuth();
  const navLinks = role === "admin" ? ADMIN_NAV : OPS_NAV;
  const portalLabel = role === "admin" ? "Admin Portal" : "Leaf Node Portal";
  const { data: requests } = useBookingRequests(role === "admin");
  const openRequestCount = (requests ?? []).filter((r) => !r.contacted).length;
  const { data: profiles } = useAllProfiles(role === "admin");
  const newPatientCount = (profiles ?? []).filter((p) => p.role === "patient" && isNewSignup(p.created_at)).length;
  const { data: bookings } = useAllBookings(role === "admin");
  const newAppointmentCount = (bookings ?? []).filter((b) => b.booking_status === "requested").length;
  const badgeCounts: Record<string, number> = {
    "/requests": openRequestCount,
    "/user-details": newPatientCount,
    "/dashboard": newAppointmentCount,
  };
  const [showProfile, setShowProfile] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-admin-bg text-admin-text">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-base font-bold">VAgeWell Care</p>
            <p className="text-xs text-admin-muted">{portalLabel}{profile?.full_name ? ` · ${profile.full_name}` : ""}</p>
          </div>
          {profile ? (
            <button onClick={() => setShowProfile(true)} className="shrink-0 active:opacity-70">
              <ProfileAvatar profile={profile} size={36} />
            </button>
          ) : null}
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-admin-border px-3 pb-2 pt-2">
          {navLinks.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            const Icon = l.icon;
            const badgeCount = badgeCounts[l.href] ?? 0;
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
                {badgeCount > 0 ? (
                  <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {badgeCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6">{children}</main>
      <OwnProfilePanel open={showProfile} onClose={() => setShowProfile(false)} />
    </div>
  );
}
