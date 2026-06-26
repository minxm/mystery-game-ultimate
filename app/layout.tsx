import type { Metadata } from "next";
import { Noto_Sans_SC } from "next/font/google";
import "./globals.css";

// Noto Sans SC：清晰的中文无衬线，带动漫感的现代气质
const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-noto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI 侦探推理 — 柯南的世界",
  description: "沉浸式 AI 推理案件，挑战你的侦探直觉",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${notoSansSC.variable} font-sans`}>{children}</body>
    </html>
  );
}
