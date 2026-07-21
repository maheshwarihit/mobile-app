import type { Metadata, Viewport } from "next";
import { Nunito_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "@/styles/design_tokens.css";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { AppShell } from "@/components/shell/AppShell";

const nunito = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VAgeWell Care",
  description: "Home healthcare intake & verification for multi-generational households.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "VAgeWell", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#9810FA",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <body>
        <QueryProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
            <Toaster position="top-center" richColors closeButton />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
