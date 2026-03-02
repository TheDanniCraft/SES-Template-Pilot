"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { toPreviewDocument } from "@/lib/html-utils";

type HtmlPreviewFrameProps = {
  html: string;
  className?: string;
  theme?: "dark" | "light" | "system";
};

export function HtmlPreviewFrame({
  html,
  className,
  theme = "light"
}: HtmlPreviewFrameProps) {
  const previewId = useId().replace(/:/g, "-");
  const [height, setHeight] = useState(520);
  const srcDoc = useMemo(
    () => toPreviewDocument(html, theme, previewId),
    [html, previewId, theme]
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const payload = event.data as
        | { type?: string; id?: string; height?: number }
        | undefined;
      if (!payload || payload.type !== "ses-preview-height") {
        return;
      }
      if (payload.id !== previewId) {
        return;
      }
      if (typeof payload.height !== "number" || Number.isNaN(payload.height)) {
        return;
      }

      setHeight(Math.max(320, Math.ceil(payload.height)));
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [previewId]);

  return (
    <iframe
      key={`${previewId}-${theme}`}
      className={`block w-full ${className ?? ""}`.trim()}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      scrolling="no"
      srcDoc={srcDoc}
      style={{
        height,
        colorScheme: theme === "system" ? "light dark" : theme
      }}
      title="HTML preview"
    />
  );
}
