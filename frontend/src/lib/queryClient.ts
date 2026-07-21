import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

// Query-key factories (typed, centralized).
export const qk = {
  services: ["services"] as const,
  profile: ["profile"] as const,
  familyMembers: ["family_members"] as const,
  bookings: (scope: "mine" | "all") => ["bookings", scope] as const,
  booking: (id: string) => ["booking", id] as const,
  clinical: (subject: string) => ["clinical", subject] as const,
  users: ["users"] as const,
};
