import type { Metadata } from "next";
import {
  IBM_Plex_Mono,
  Public_Sans,
  Schibsted_Grotesk,
} from "next/font/google";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

const schibstedGrotesk = Schibsted_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const publicSans = Public_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "CV Polisher",
  description: "Polish your CV with AI-powered ATS optimisation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${schibstedGrotesk.variable} ${publicSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-background text-foreground"
      >
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
