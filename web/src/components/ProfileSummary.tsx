"use client";

import { UserCircle } from "lucide-react";
import { PROFILE_PHOTO_BUCKET, profileCompletionPercent, type Profile } from "@vagewell/shared";
import { supabase } from "@/lib/supabase";

const RING_STROKE = 3;

function avatarUrl(p: Pick<Profile, "avatar_path" | "updated_at">): string | null {
  if (!p.avatar_path) return null;
  const publicUrl = supabase.storage.from(PROFILE_PHOTO_BUCKET).getPublicUrl(p.avatar_path).data.publicUrl;
  // Cache-bust on every profile change so a re-upload shows immediately
  // instead of serving a stale cached image at the same path prefix.
  return `${publicUrl}?v=${encodeURIComponent(p.updated_at)}`;
}

/** Avatar circle — the uploaded photo, or a placeholder icon if none yet. */
export function ProfileAvatar({
  profile,
  size = 44,
}: {
  profile: Pick<Profile, "avatar_path" | "updated_at"> | null | undefined;
  size?: number;
}) {
  const url = profile ? avatarUrl(profile) : null;
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" style={{ width: size, height: size }} className="rounded-full object-cover" />
    );
  }
  return (
    <div style={{ width: size, height: size }} className="flex items-center justify-center rounded-full bg-brand-50">
      <UserCircle size={Math.round(size * 0.6)} className="text-brand-600" />
    </div>
  );
}

/** Naukri-style completion ring, mirroring the mobile Services screen's version. */
export function ProfileCompletionRing({ percent, size = 44 }: { percent: number; size?: number }) {
  const radius = (size - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e5e7eb" strokeWidth={RING_STROKE} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="var(--color-brand-600, #12809e)"
        strokeWidth={RING_STROKE}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.26} fontWeight={700} fill="#374151">
        {clamped}%
      </text>
    </svg>
  );
}

export { profileCompletionPercent };
