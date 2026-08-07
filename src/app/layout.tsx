import type { Metadata } from "next";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { Source_Sans_3 } from "next/font/google";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { Nav } from "@/components/Nav";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Homeschool Academy",
  description: "Companion & Tracker for homeschool families and academies",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" className={`${sourceSans.variable} h-full antialiased`}>
        <body className="min-h-full bg-neutral-50 font-sans text-neutral-900">
          <ConvexClientProvider>
            <Nav />
            <main className="mx-auto w-full max-w-4xl px-4 py-6">{children}</main>
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
