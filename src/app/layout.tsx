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
        {!isAdmin ? (
          <>
            <style
              data-medbbc-prehydrate="1"
              dangerouslySetInnerHTML={{
                __html: `html,body,*{-webkit-user-select:none!important;-moz-user-select:none!important;-ms-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important;-webkit-tap-highlight-color:transparent!important;}input,textarea,[contenteditable="true"]{-webkit-user-select:text!important;-moz-user-select:text!important;-ms-user-select:text!important;user-select:text!important;}.medbbc-viewer,.medbbc-viewer *,[data-medbbc-viewer],[data-medbbc-viewer] *, .protected-view, .protected-view *{-webkit-user-select:text!important;-moz-user-select:text!important;-ms-user-select:text!important;user-select:text!important;}.medbbc-viewer img,.medbbc-viewer video,.medbbc-viewer canvas,.medbbc-viewer svg,.medbbc-viewer iframe,[data-medbbc-viewer] img,[data-medbbc-viewer] video,[data-medbbc-viewer] canvas,[data-medbbc-viewer] svg,[data-medbbc-viewer] iframe,.protected-view img,.protected-view video,.protected-view canvas,.protected-view svg,.protected-view iframe{-webkit-user-select:none!important;-moz-user-select:none!important;-ms-user-select:none!important;user-select:none!important;}::selection{background:transparent!important;color:inherit!important;}::-moz-selection{background:transparent!important;color:inherit!important;}.medbbc-viewer ::selection,[data-medbbc-viewer] ::selection,.protected-view ::selection{background:rgba(250,204,21,.42)!important;color:inherit!important;}.medbbc-viewer ::-moz-selection,[data-medbbc-viewer] ::-moz-selection,.protected-view ::-moz-selection{background:rgba(250,204,21,.42)!important;color:inherit!important;}img,video,canvas,svg{-webkit-user-drag:none!important;user-drag:none!important;}`,
              }}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `(function(){if(window.__MEDBBC_PREHYDRATE__)return;window.__MEDBBC_PREHYDRATE__=1;function editable(n){return !!(n&&n.closest&&n.closest('input,textarea,[contenteditable="true"]'));}['contextmenu','copy','cut','paste','dragstart'].forEach(function(evt){document.addEventListener(evt,function(e){if(editable(e.target))return;e.preventDefault();return false;},{capture:true});});document.addEventListener('keydown',function(e){var k=(e.key||'').toLowerCase();var meta=e.ctrlKey||e.metaKey;if(e.key==='F12'||k==='f12'){e.preventDefault();return false;}if(k==='printscreen'){e.preventDefault();return false;}if(meta&&['c','x','v','a','s','p','u'].indexOf(k)!==-1&&!editable(e.target)){e.preventDefault();return false;}if(meta&&e.shiftKey&&['i','j','c','s'].indexOf(k)!==-1){e.preventDefault();return false;}},{capture:true});})();`,
              }}
            />
          </>
        ) : null}
      </head>
      <body className={`min-h-screen antialiased${isAdmin ? " admin-mode" : ""}`}>
        <AntiCopy isAdmin={isAdmin} />
        {children}
      </body>
    </html>
  );
}
