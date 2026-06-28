import type { Metadata } from "next";
import { Fredoka, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jumbo Royale — Co-op Checkers Chaos",
  description: "A silly, chaotic, multiplayer checkers game for friends. Co-op vs the Boss King or PvP chaos. Free, mobile-friendly, no signup.",
  keywords: ["checkers", "multiplayer", "co-op", "browser game", "party game", "friends"],
  authors: [{ name: "Jumbo Royale" }],
  openGraph: {
    title: "Jumbo Royale — Co-op Checkers Chaos",
    description: "A silly, chaotic, multiplayer checkers game for friends.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Jumbo Royale",
    description: "Co-op checkers chaos for friends",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fredoka.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster />
        <SonnerToaster />
      </body>
    </html>
  );
}
