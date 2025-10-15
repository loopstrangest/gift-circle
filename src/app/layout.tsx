import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

import { IdentityProvider } from "@/components/identity-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gift Circle",
  description:
    "Host gift circles, share offers and desires, and coordinate real-time generosity.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-slate-50 text-slate-900 antialiased`}
      >
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold text-indigo-600">
              Gift Circle
            </Link>
            <nav className="text-sm text-slate-600">
              <Link href="/" className="hover:text-slate-900">
                Home
              </Link>
            </nav>
          </div>
        </header>
        <IdentityProvider>{children}</IdentityProvider>
      </body>
    </html>
  );
}
