import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/ToastProvider";
import ConfirmDialogProvider from "@/components/ui/ConfirmDialogProvider";
import GoogleMapsScriptClient from "@/components/GoogleMapsScriptClient";
import GlobalPlayerRoot from "@/components/player/GlobalPlayerRoot";
import ContractPreviewMobileFix from "@/components/contratos/ContractPreviewMobileFix";
import ClientRepertoireHotfixes from "@/components/cliente/ClientRepertoireHotfixes";

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
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <GlobalPlayerRoot>
            <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
          </GlobalPlayerRoot>
        </ToastProvider>
        <ClientRepertoireHotfixes />
        <ContractPreviewMobileFix />
        <GoogleMapsScriptClient apiKey={GOOGLE_MAPS_KEY} />
      </body>
    </html>
  );
}
