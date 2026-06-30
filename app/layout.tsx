import type { Metadata, Viewport } from "next";
import { Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import MysteryBackdrop from "@/components/MysteryBackdrop";
import { AuthProvider } from "@/components/AuthProvider";

// Noto Sans SC：清晰的中文无衬线，带动漫感的现代气质
const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-noto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI 侦探推理 | 真相只有一个",
  description: "沉浸式 AI 悬疑推理 — 烧脑式侦探体验，挑战你的推理直觉",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${notoSansSC.variable} font-sans overflow-x-hidden`}>
        <AuthProvider>
          <MysteryBackdrop />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
