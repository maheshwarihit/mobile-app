"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Stethoscope, CalendarCheck, User } from "lucide-react";

const TABS = [
  { href: "/services", label: "Services", icon: Stethoscope },
  { href: "/dashboard", label: "Appointments", icon: CalendarCheck },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                active ? "text-purple-700" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon size={22} className={active ? "text-purple-600" : "text-gray-400"} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
