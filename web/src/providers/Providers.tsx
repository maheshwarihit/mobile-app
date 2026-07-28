"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast as sonnerToast } from "sonner";
import { makeQueryClient, configureCore } from "@vagewell/shared";
import { supabase } from "@/lib/supabase";
import { AuthProvider } from "@/providers/AuthProvider";

// One-time wiring of the shared data layer to this app's Supabase client + toast
// implementation (see shared/src/runtime.ts — the DI seam the hooks/mutations
// read through instead of importing a platform SDK directly).
configureCore({
  supabase,
  toast: {
    success: (m: string) => sonnerToast.success(m),
    error: (m: string) => sonnerToast.error(m),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => makeQueryClient());
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        {children}
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
