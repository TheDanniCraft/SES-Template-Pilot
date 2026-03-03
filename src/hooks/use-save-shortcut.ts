"use client";

import { useEffect, useRef } from "react";

export function useSaveShortcut(onSave: () => void, enabled = true) {
  const onSaveRef = useRef(onSave);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isSaveShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";
      if (!isSaveShortcut) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (!enabledRef.current || event.repeat) {
        return;
      }

      onSaveRef.current();
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);
}
