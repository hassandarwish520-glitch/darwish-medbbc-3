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
                __html: `html,body,*{-webkit-user-select:none!important;-moz-user-select:none!important;-ms-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important;-webkit-tap-highlight-color:transparent!important;}input,textarea,[contenteditable="true"]{-webkit-user-select:text!important;-moz-user-select:text!important;-ms-user-select:text!important;user-select:text!important;}::selection{background:transparent!important;color:inherit!important;}::-moz-selection{background:transparent!important;color:inherit!important;}img,video,canvas,svg{-webkit-user-drag:none!important;user-drag:none!important;}`,
              }}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `(function(){if(window.__MEDBBC_PREHYDRATE__)return;window.__MEDBBC_PREHYDRATE__=1;function editable(n){return !!(n&&n.closest&&n.closest('input,textarea,[contenteditable="true"]'));}function clearSel(){try{var a=document.activeElement;if(editable(a))return;var s=window.getSelection&&window.getSelection();if(s&&s.rangeCount)s.removeAllRanges();}catch(_){}}['contextmenu','copy','cut','paste','dragstart','selectstart'].forEach(function(evt){document.addEventListener(evt,function(e){if(editable(e.target))return;e.preventDefault();clearSel();return false;},{capture:true});});document.addEventListener('keydown',function(e){var k=(e.key||'').toLowerCase();var meta=e.ctrlKey||e.metaKey;if(e.key==='F12'||k==='f12'){e.preventDefault();return false;}if(k==='printscreen'){e.preventDefault();clearSel();return false;}if(meta&&['c','x','v','a','s','p','u'].indexOf(k)!==-1&&!editable(e.target)){e.preventDefault();clearSel();return false;}if(meta&&e.shiftKey&&['i','j','c','s'].indexOf(k)!==-1){e.preventDefault();return false;}},{capture:true});document.addEventListener('selectionchange',clearSel,{capture:true});document.addEventListener('mouseup',clearSel,{capture:true});document.addEventListener('touchend',function(){setTimeout(clearSel,0);},{capture:true,passive:true});})();`,
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
