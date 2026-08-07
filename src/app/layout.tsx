import type { Metadata, Viewport } from "next";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { Nav } from "@/components/Nav";
import { PwaRegister } from "@/components/PwaRegister";
import { ViewAsBanner } from "@/components/ViewAsBanner";
import { WhatsNewBanner } from "@/components/WhatsNewBanner";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const APP_NAME = "Homeschool Academy";
const APP_DESCRIPTION =
  "Companion & Tracker for homeschool families and academies";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e7490",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" className={`${plusJakarta.variable} h-full antialiased`}>
        <body className="min-h-full font-sans text-[var(--foreground)]">
          <ConvexClientProvider>
            <PwaRegister />
            <Nav />
            <Suspense fallback={null}>
              <ViewAsBanner />
            </Suspense>
            <Suspense fallback={null}>
              <WhatsNewBanner />
            </Suspense>
            <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
              {children}
            </main>
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
