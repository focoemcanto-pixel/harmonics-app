import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/ToastProvider";
import ConfirmDialogProvider from "@/components/ui/ConfirmDialogProvider";
import GoogleMapsScriptClient from "@/components/GoogleMapsScriptClient";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Harmonics",
  description: "Gestão profissional de eventos musicais",
  openGraph: {
    title: "Harmonics",
    description: "Gestão profissional de eventos musicais",
    url: "https://app.bandaharmonics.com",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.png?v=2",
    shortcut: "/favicon.png?v=2",
    apple: "/apple-touch-icon.png?v=2",
  },
};

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const shouldLoadMaps = Boolean(GOOGLE_MAPS_KEY);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
        </ToastProvider>

        {/* Load Google Maps only if API key exists */}
        {shouldLoadMaps && (
          <GoogleMapsScriptClient apiKey={GOOGLE_MAPS_KEY} />
        )}
      </body>
    </html>
  );
}
