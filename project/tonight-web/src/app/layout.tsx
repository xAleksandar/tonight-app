import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ToastPresenter } from "@/components/tonight/ToastPresenter";
import { SafeAreaTint } from "@/components/tonight/SafeAreaTint";
import { PersistentMobileNav } from "@/components/tonight/PersistentMobileNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tonight",
  description: "Discover or host spontaneous meetups happening near you.",
};

export const viewport: Viewport = {
  themeColor: "#30324b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground`}>
        <AuthProvider>
          <SafeAreaTint />
          {children}
          <PersistentMobileNav />
        </AuthProvider>
        <ToastPresenter />
      </body>
    </html>
  );
}
