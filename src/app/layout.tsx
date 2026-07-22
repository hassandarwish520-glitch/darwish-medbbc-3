import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Darwish MedBBC — Professional Medical Education",
  description: "A production medical education platform for USMLE / MBBS students.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
