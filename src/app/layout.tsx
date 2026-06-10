import type { Metadata } from "next";
import { Fraunces, Spline_Sans, Spline_Sans_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

const splineSans = Spline_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const splineSansMono = Spline_Sans_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
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
      className={`${fraunces.variable} ${splineSans.variable} ${splineSansMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="paper-desk min-h-full flex flex-col bg-background text-foreground"
      >
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
