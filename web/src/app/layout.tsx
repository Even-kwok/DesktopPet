import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DesktopPet Studio",
  description: "Generate and manage desktop pet materials for CatDesktopPet."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
