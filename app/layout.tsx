import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/ToastProvider";
import ConfirmDialogProvider from "@/components/ui/ConfirmDialogProvider";
import GlobalPlayerRoot from "@/components/player/GlobalPlayerRoot";
import RouteScopedEnhancements from "@/components/RouteScopedEnhancements";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

export const metadata: Metadata = {
  title: "Harmonics",
  description: "Gestão profissional de eventos musicais",
  applicationName: "Harmonics",
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Harmonics",
    statusBarStyle: "black-translucent",
  },
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <GlobalPlayerRoot>
            <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
          </GlobalPlayerRoot>
        </ToastProvider>
        <RouteScopedEnhancements />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
