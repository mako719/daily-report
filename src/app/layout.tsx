import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "営業日報システム",
  description: "営業担当者の日報を記録し、上長がコメントする",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
