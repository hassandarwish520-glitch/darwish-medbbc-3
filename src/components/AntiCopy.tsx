/**
 * <AntiCopy /> — Next.js App Router client component
 *
 * Usage in app/layout.tsx:
 *   <body>
 *     <AntiCopy isAdmin={isAdmin} />
 *     {children}
 *   </body>
 *
 * Pass isAdmin={true} to disable protection for admin users.
 */
'use client';

import { useEffect } from 'react';

export default function AntiCopy({ isAdmin = false }: { isAdmin?: boolean }) {
  useEffect(() => {
    if (isAdmin) {
      document.body.classList.add('admin-mode');
      return () => {
        document.body.classList.remove('admin-mode');
      };
    }
    document.body.classList.remove('admin-mode');

    const s = document.createElement('script');
    s.src = '/anti-copy.js';
    s.async = true;
    document.body.appendChild(s);

    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = '/anti-copy.css';
    document.head.appendChild(l);

    return () => {
      try { document.body.removeChild(s); } catch (_) {}
      try { document.head.removeChild(l); } catch (_) {}
    };
  }, [isAdmin]);

  return null;
}
