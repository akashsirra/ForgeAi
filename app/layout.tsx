import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./mobile.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "ForgeAI — Build and Ship Websites With AI",
    template: "%s | ForgeAI",
  },
  description:
    "Turn an idea into a polished responsive website, preview it, save it, and ship it to the web with ForgeAI.",
  applicationName: "ForgeAI",
  keywords: [
    "AI website builder",
    "AI website generator",
    "website builder",
    "AI web design",
    "ForgeAI",
  ],
  authors: [{ name: "ForgeAI" }],
  creator: "ForgeAI",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "ForgeAI",
    title: "ForgeAI — Build and Ship Websites With AI",
    description:
      "Turn an idea into a polished responsive website and ship it to the web.",
    url: appUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "ForgeAI — Build and Ship Websites With AI",
    description:
      "Turn an idea into a polished responsive website and ship it to the web.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
