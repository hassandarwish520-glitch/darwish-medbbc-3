import type { Metadata } from "next";
import "./globals.css";
import AntiCopy from "@/components/AntiCopy";
import { requireUser, isAdminProfile } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Darwish MedBBC — Professional Medical Education",
  description: "A production medical education platform for USMLE / MBBS students.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let isAdmin = false;
  try {
    const ctx = await requireUser();
    isAdmin = isAdminProfile(ctx?.profile);
  } catch {
    // unauthenticated — protection stays active
  }

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Prevent theme flash: read localStorage before paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('medbbc-theme');if(t==='light'){document.documentElement.classList.remove('dark');}else{document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`min-h-screen antialiased${isAdmin ? " admin-mode" : ""}`}>
        <AntiCopy isAdmin={isAdmin} />
        {children}
      </body>
    </html>
  );
}
