import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerInit } from "@/components/ServiceWorkerInit";
import { PageViewTracker } from "@/components/PageViewTracker";
import { MetaPixel } from "@/components/MetaPixel";
import { VersionGuard } from "@/components/VersionGuard";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Maya",
  description:
    "Sua IA pessoal que conecta sono, humor, hábitos, metas e dinheiro para mostrar o que você sozinho não enxerga.",
  manifest: "/manifest.json",
  icons: {
    icon: "/maya-cover.png",
    apple: "/maya-cover.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "Maya",
  },
};

export const viewport: Viewport = {
  // #04060a = oklch(0.12 0.012 270) = --background (cor real do fundo do app).
  // O antigo #0F0F14 destoava do fundo e criava uma faixa/emenda no topo.
  themeColor: "#04060a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full overflow-hidden flex flex-col">
        {/* iOS 26+ desenha um blur/degradê no topo do PWA instalado quando não
            consegue amostrar uma cor sólida no topo da página. Esta faixa fixa,
            na cor do fundo (--background), dá ao iOS uma cor chapada para a
            status bar e remove o degrade. Precisa ser um <div> real (não
            ::before/::after), opaco e encostado no topo. */}
        <div
          aria-hidden
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: "var(--background)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <ServiceWorkerInit />
        <VersionGuard />
        <PageViewTracker />
        <MetaPixel />
        <div className="app-frame">{children}</div>
        <Toaster richColors position="top-center" closeButton={false} duration={4000} />
      </body>
    </html>
  );
}
