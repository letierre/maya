import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerInit } from "@/components/ServiceWorkerInit";
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
    statusBarStyle: "black-translucent",
    title: "Maya",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F0F14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        <ServiceWorkerInit />
        {children}
        <Toaster richColors />
      </body>
    </html>
  );
}
