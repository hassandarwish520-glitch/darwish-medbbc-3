"use client";

import { useEffect } from "react";

export default function ProtectionGuards() {
  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const onCopyLike = (event: ClipboardEvent) => {
      event.preventDefault();
    };

    const onDragStart = (event: DragEvent) => {
      event.preventDefault();
    };

    const onKeyDown = async (event: KeyboardEvent) => {
      const isMeta = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (isMeta && ["c", "s", "p", "u", "a"].includes(key)) {
        event.preventDefault();
      }
      if (event.key === "PrintScreen") {
        event.preventDefault();
        try {
          await navigator.clipboard.writeText("");
        } catch {}
      }
      if (isMeta && event.shiftKey && ["i", "j", "c", "s"].includes(key)) {
        event.preventDefault();
      }
      if (event.key === "F12") {
        event.preventDefault();
      }
    };

    document.body.classList.add("protected-mode");
    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("copy", onCopyLike);
    window.addEventListener("cut", onCopyLike);
    window.addEventListener("dragstart", onDragStart);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.classList.remove("protected-mode");
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("copy", onCopyLike);
      window.removeEventListener("cut", onCopyLike);
      window.removeEventListener("dragstart", onDragStart);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}
